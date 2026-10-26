from datetime import timedelta
from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework import generics, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from core.models import AuditLog
from .models import Agency, Company, User
from .permissions import IsTenantAdmin, scoped_queryset
from .serializers import AgencySerializer, CompanySerializer, UserSerializer

def audit(request, action, obj):
    AuditLog.objects.create(actor=request.user, action=action, resource=obj.__class__.__name__, resource_id=str(obj.pk), company_id=getattr(obj, "company_id", None) or (obj.pk if isinstance(obj, Company) else request.user.company_id), ip_address=request.META.get("REMOTE_ADDR"))

class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    def get_object(self): return self.request.user
    def update(self, request, *args, **kwargs):
        allowed = {key: value for key, value in request.data.items() if key in {"first_name", "last_name", "email", "phone", "preferred_language", "password"}}
        serializer = self.get_serializer(self.get_object(), data=allowed, partial=True)
        serializer.is_valid(raise_exception=True)
        obj = serializer.save()
        audit(request, "UPDATE_PROFILE", obj)
        return Response(serializer.data)

class TenantModelViewSet(viewsets.ModelViewSet):
    permission_classes = [IsTenantAdmin]
    company_field = "company"
    def get_queryset(self): return scoped_queryset(super().get_queryset(), self.request.user, self.company_field)
    def perform_create(self, serializer):
        if self.request.user.role == User.Role.SUPERADMIN:
            obj = serializer.save()
        else:
            obj = serializer.save(company=self.request.user.company)
        audit(self.request, "CREATE", obj)
    def perform_update(self, serializer):
        if self.request.user.role == User.Role.SUPERADMIN:
            obj = serializer.save()
        else:
            obj = serializer.save(company=self.request.user.company)
        audit(self.request, "UPDATE", obj)
    def perform_destroy(self, instance):
        audit(self.request, "DELETE", instance); instance.delete()

class CompanyViewSet(viewsets.ModelViewSet):
    serializer_class = CompanySerializer
    permission_classes = [IsTenantAdmin]
    def get_queryset(self):
        return Company.objects.all() if self.request.user.role == User.Role.SUPERADMIN else Company.objects.filter(pk=self.request.user.company_id)
    def perform_create(self, serializer):
        if self.request.user.role != User.Role.SUPERADMIN:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Seul le superadministrateur peut créer une société.")
        obj = serializer.save(); audit(self.request, "CREATE", obj)

class AgencyViewSet(TenantModelViewSet):
    queryset = Agency.objects.select_related("company").order_by("code")
    serializer_class = AgencySerializer

class UserViewSet(TenantModelViewSet):
    queryset = User.objects.select_related("company", "agency").order_by("username")
    serializer_class = UserSerializer
    company_field = "company"
    def perform_create(self, serializer):
        requested_role = serializer.validated_data.get("role")
        if self.request.user.role != User.Role.SUPERADMIN and requested_role == User.Role.SUPERADMIN:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Ce rôle ne peut pas être attribué.")
        super().perform_create(serializer)
    def perform_update(self, serializer):
        requested_role = serializer.validated_data.get("role", serializer.instance.role)
        if self.request.user.role != User.Role.SUPERADMIN and requested_role == User.Role.SUPERADMIN:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Ce rôle ne peut pas être attribué.")
        super().perform_update(serializer)

class DashboardView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        from fleet.models import Vehicle, VehicleDocument
        from operations.models import Customer, FuelEntry, MaintenanceIntervention, Mission

        companies = Company.objects.all() if request.user.role == User.Role.SUPERADMIN else Company.objects.filter(pk=request.user.company_id)
        agencies = scoped_queryset(Agency.objects.all(), request.user)
        users = scoped_queryset(User.objects.all(), request.user)
        vehicles = scoped_queryset(Vehicle.objects.all(), request.user)
        documents = scoped_queryset(VehicleDocument.objects.filter(is_archived=False), request.user)
        customers = scoped_queryset(Customer.objects.filter(active=True), request.user)
        missions = scoped_queryset(Mission.objects.select_related("customer", "vehicle", "driver"), request.user)
        fuel = scoped_queryset(FuelEntry.objects.all(), request.user)
        maintenance = scoped_queryset(MaintenanceIntervention.objects.select_related("vehicle"), request.user)
        today = timezone.localdate()
        mission_totals = missions.aggregate(revenue=Sum("transport_price"), expenses=Sum("expenses"))
        fuel_totals = fuel.aggregate(liters=Sum("quantity_liters"), cost=Sum("total_cost"))
        maintenance_totals = maintenance.aggregate(cost=Sum("cost"))
        revenue, expenses = mission_totals["revenue"] or 0, mission_totals["expenses"] or 0
        return Response({
            "demo_mode": companies.filter(name="Transport Démo").exists(),
            "companies": companies.count(), "agencies": agencies.count(),
            "active_users": users.filter(is_active=True).count(), "customers": customers.count(),
            "users_by_role": list(users.values("role").annotate(count=Count("id")).order_by("role")),
            "vehicles": {"total": vehicles.count(), "available": vehicles.filter(status=Vehicle.Status.AVAILABLE).count(), "on_mission": vehicles.filter(status=Vehicle.Status.ON_MISSION).count(), "maintenance": vehicles.filter(status__in=[Vehicle.Status.MAINTENANCE, Vehicle.Status.IMMOBILIZED]).count()},
            "missions": {"total": missions.count(), "planned": missions.filter(status__in=[Mission.Status.PLANNED, Mission.Status.ASSIGNED]).count(), "in_progress": missions.filter(status=Mission.Status.IN_PROGRESS).count(), "completed": missions.filter(status__in=[Mission.Status.COMPLETED, Mission.Status.DELIVERED, Mission.Status.VALIDATED, Mission.Status.INVOICED]).count()},
            "finance": {"revenue": revenue, "expenses": expenses, "margin": revenue-expenses},
            "fuel": {"liters": fuel_totals["liters"] or 0, "cost": fuel_totals["cost"] or 0},
            "maintenance": {"open": maintenance.exclude(status=MaintenanceIntervention.Status.COMPLETED).count(), "cost": maintenance_totals["cost"] or 0},
            "documents": {"expired": documents.filter(expires_at__lt=today).count(), "expiring_soon": documents.filter(expires_at__range=(today, today+timedelta(days=30))).count()},
            "recent_missions": list(missions.order_by("-mission_date")[:5].values("id", "reference", "mission_date", "origin", "destination", "status", "customer__name", "vehicle__registration")),
            "upcoming_maintenance": list(maintenance.exclude(status=MaintenanceIntervention.Status.COMPLETED).order_by("scheduled_date")[:5].values("id", "title", "scheduled_date", "status", "vehicle__registration")),
        })
