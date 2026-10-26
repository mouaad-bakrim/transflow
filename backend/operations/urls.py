from rest_framework.routers import DefaultRouter
from .views import CustomerViewSet,FuelEntryViewSet,MaintenanceViewSet,MissionViewSet,ModuleEntryViewSet
router=DefaultRouter(); router.register("customers",CustomerViewSet); router.register("missions",MissionViewSet); router.register("fuel-entries",FuelEntryViewSet); router.register("maintenance",MaintenanceViewSet); router.register("module-entries",ModuleEntryViewSet)
urlpatterns=router.urls
