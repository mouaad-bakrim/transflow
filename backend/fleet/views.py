from datetime import date, timedelta
from django.db.models import Q
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from accounts.models import User
from accounts.permissions import scoped_queryset
from accounts.views import audit
from .models import DocumentType, Vehicle, VehicleDocument
from .permissions import FleetPermission
from .serializers import DocumentTypeSerializer, VehicleDocumentSerializer, VehicleSerializer


class TenantFleetViewSet(viewsets.ModelViewSet):
    permission_classes = [FleetPermission]

    def get_queryset(self):
        return scoped_queryset(super().get_queryset(), self.request.user)

    def perform_create(self, serializer):
        extra = {} if self.request.user.role == User.Role.SUPERADMIN else {"company": self.request.user.company}
        obj = serializer.save(**extra)
        audit(self.request, "CREATE", obj)

    def perform_update(self, serializer):
        extra = {} if self.request.user.role == User.Role.SUPERADMIN else {"company": self.request.user.company}
        obj = serializer.save(**extra)
        audit(self.request, "UPDATE", obj)


class VehicleViewSet(TenantFleetViewSet):
    queryset = Vehicle.objects.select_related("company", "agency")
    serializer_class = VehicleSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get("search")
        status = self.request.query_params.get("status")
        if search:
            qs = qs.filter(Q(registration__icontains=search) | Q(brand__icontains=search) | Q(model__icontains=search) | Q(vin__icontains=search))
        if status:
            qs = qs.filter(status=status)
        return qs

    @action(detail=True, methods=["get"])
    def compliance(self, request, pk=None):
        vehicle = self.get_object()
        target_date = date.fromisoformat(request.query_params.get("date", timezone.localdate().isoformat()))
        mandatory = DocumentType.objects.filter(company=vehicle.company, is_mandatory=True, active=True)
        documents = {d.document_type_id: d for d in vehicle.documents.filter(is_archived=False)}
        errors, warnings = [], []
        for doc_type in mandatory:
            document = documents.get(doc_type.id)
            if not document:
                (errors if doc_type.blocking_for_assignment else warnings).append(f"{doc_type.name} manquant")
            elif document.expires_at and document.expires_at < target_date:
                (errors if doc_type.blocking_for_assignment else warnings).append(f"{doc_type.name} expiré")
        return Response({"vehicle": str(vehicle.id), "date": target_date, "compliant": not errors, "blocking_errors": errors, "warnings": warnings})


class DocumentTypeViewSet(TenantFleetViewSet):
    queryset = DocumentType.objects.select_related("company")
    serializer_class = DocumentTypeSerializer


class VehicleDocumentViewSet(TenantFleetViewSet):
    queryset = VehicleDocument.objects.select_related("company", "agency", "vehicle", "document_type").filter(is_archived=False)
    serializer_class = VehicleDocumentSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get("search")
        vehicle = self.request.query_params.get("vehicle_id")
        status = self.request.query_params.get("status")
        if search:
            qs = qs.filter(Q(vehicle__registration__icontains=search) | Q(document_type__name__icontains=search) | Q(reference_number__icontains=search))
        if vehicle:
            qs = qs.filter(vehicle_id=vehicle)
        if status == "EXPIRED":
            qs = qs.filter(expires_at__lt=timezone.localdate())
        elif status == "EXPIRING_SOON":
            max_days = max(DocumentType.objects.filter(company_id=self.request.user.company_id).values_list("default_reminder_days", flat=True), default=30)
            qs = qs.filter(expires_at__range=(timezone.localdate(), timezone.localdate() + timedelta(days=max_days)))
        return qs

    def perform_create(self, serializer):
        extra = {"created_by": self.request.user}
        if self.request.user.role != User.Role.SUPERADMIN:
            extra["company"] = self.request.user.company
        obj = serializer.save(**extra)
        audit(self.request, "CREATE", obj)

    @action(detail=False, methods=["get"])
    def alerts(self, request):
        documents = [doc for doc in self.get_queryset() if doc.computed_status in {"EXPIRED", "EXPIRING_SOON"}]
        page = self.paginate_queryset(documents)
        serializer = self.get_serializer(page if page is not None else documents, many=True)
        return self.get_paginated_response(serializer.data) if page is not None else Response(serializer.data)
