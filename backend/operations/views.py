from django.db.models import Q,Sum
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from accounts.models import User
from accounts.permissions import scoped_queryset
from accounts.views import audit
from .models import Customer,FuelEntry,MaintenanceIntervention,Mission,ModuleEntry
from .serializers import CustomerSerializer,FuelEntrySerializer,MaintenanceSerializer,MissionSerializer,ModuleEntrySerializer

class TenantViewSet(viewsets.ModelViewSet):
    permission_classes=[IsAuthenticated]
    def get_queryset(self): return scoped_queryset(super().get_queryset(),self.request.user)
    def perform_create(self,serializer):
        extra={} if self.request.user.role==User.Role.SUPERADMIN else {"company":self.request.user.company}
        obj=serializer.save(**extra); audit(self.request,"CREATE",obj)
    def perform_update(self,serializer):
        extra={} if self.request.user.role==User.Role.SUPERADMIN else {"company":self.request.user.company}
        obj=serializer.save(**extra); audit(self.request,"UPDATE",obj)

class CustomerViewSet(TenantViewSet):
    queryset=Customer.objects.select_related("company","agency"); serializer_class=CustomerSerializer
    def get_queryset(self):
        qs=super().get_queryset(); q=self.request.query_params.get("search"); return qs.filter(Q(name__icontains=q)|Q(ice__icontains=q)) if q else qs
class MissionViewSet(TenantViewSet):
    queryset=Mission.objects.select_related("company","agency","customer","vehicle","driver"); serializer_class=MissionSerializer
    @action(detail=False,methods=["get"])
    def summary(self,request):
        qs=self.get_queryset(); totals=qs.aggregate(revenue=Sum("transport_price"),expenses=Sum("expenses")); return Response({"count":qs.count(),"revenue":totals["revenue"] or 0,"expenses":totals["expenses"] or 0,"margin":(totals["revenue"] or 0)-(totals["expenses"] or 0)})
class FuelEntryViewSet(TenantViewSet):
    queryset=FuelEntry.objects.select_related("company","agency","vehicle","mission"); serializer_class=FuelEntrySerializer
class MaintenanceViewSet(TenantViewSet):
    queryset=MaintenanceIntervention.objects.select_related("company","agency","vehicle"); serializer_class=MaintenanceSerializer

class ModuleEntryViewSet(TenantViewSet):
    queryset=ModuleEntry.objects.select_related("company","agency","created_by")
    serializer_class=ModuleEntrySerializer
    def get_queryset(self):
        qs=super().get_queryset(); section=self.request.query_params.get("section"); search=self.request.query_params.get("search")
        if section: qs=qs.filter(section=section)
        if search: qs=qs.filter(Q(reference__icontains=search)|Q(title__icontains=search)|Q(entry_type__icontains=search))
        return qs
    def perform_create(self,serializer):
        extra={"created_by":self.request.user}
        if self.request.user.role!=User.Role.SUPERADMIN: extra["company"]=self.request.user.company
        obj=serializer.save(**extra); audit(self.request,"CREATE",obj)
