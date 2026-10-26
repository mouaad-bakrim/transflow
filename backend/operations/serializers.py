from rest_framework import serializers
from .models import Customer,FuelEntry,MaintenanceIntervention,Mission,ModuleEntry

class CleanModelSerializer(serializers.ModelSerializer):
    def validate(self,attrs):
        instance=self.instance or self.Meta.model()
        for key,value in attrs.items(): setattr(instance,key,value)
        request=self.context.get("request")
        if request and request.user.role!="SUPERADMIN": instance.company=request.user.company
        try: instance.clean()
        except Exception as exc:
            if hasattr(exc,"message_dict"): raise serializers.ValidationError(exc.message_dict)
            raise
        return attrs

class CustomerSerializer(CleanModelSerializer):
    class Meta: model=Customer; fields="__all__"; read_only_fields=["id","created_at","updated_at"]

class MissionSerializer(CleanModelSerializer):
    customer_name=serializers.CharField(source="customer.name",read_only=True); vehicle_registration=serializers.CharField(source="vehicle.registration",read_only=True); driver_name=serializers.SerializerMethodField(); status_label=serializers.CharField(source="get_status_display",read_only=True); margin=serializers.DecimalField(max_digits=12,decimal_places=2,read_only=True)
    def get_driver_name(self,obj): return obj.driver.get_full_name() or obj.driver.username if obj.driver else ""
    class Meta: model=Mission; fields="__all__"; read_only_fields=["id","created_at","updated_at"]

class FuelEntrySerializer(CleanModelSerializer):
    vehicle_registration=serializers.CharField(source="vehicle.registration",read_only=True); unit_price=serializers.DecimalField(max_digits=12,decimal_places=2,read_only=True)
    class Meta: model=FuelEntry; fields="__all__"; read_only_fields=["id","created_at","updated_at"]
    def validate(self,attrs):
        attrs=super().validate(attrs); company=attrs.get("company",getattr(self.instance,"company",None)); vehicle=attrs.get("vehicle",getattr(self.instance,"vehicle",None)); mission=attrs.get("mission",getattr(self.instance,"mission",None))
        if vehicle and company and vehicle.company_id!=company.id: raise serializers.ValidationError({"vehicle":"Véhicule hors société."})
        if mission and company and mission.company_id!=company.id: raise serializers.ValidationError({"mission":"Mission hors société."})
        return attrs

class MaintenanceSerializer(CleanModelSerializer):
    vehicle_registration=serializers.CharField(source="vehicle.registration",read_only=True); kind_label=serializers.CharField(source="get_kind_display",read_only=True); status_label=serializers.CharField(source="get_status_display",read_only=True)
    class Meta: model=MaintenanceIntervention; fields="__all__"; read_only_fields=["id","created_at","updated_at"]
    def validate(self,attrs):
        attrs=super().validate(attrs); company=attrs.get("company",getattr(self.instance,"company",None)); vehicle=attrs.get("vehicle",getattr(self.instance,"vehicle",None))
        if vehicle and company and vehicle.company_id!=company.id: raise serializers.ValidationError({"vehicle":"Véhicule hors société."})
        return attrs

class ModuleEntrySerializer(CleanModelSerializer):
    section_label=serializers.CharField(source="get_section_display",read_only=True)
    status_label=serializers.CharField(source="get_status_display",read_only=True)
    agency_name=serializers.CharField(source="agency.name",read_only=True)
    class Meta:
        model=ModuleEntry
        fields="__all__"
        read_only_fields=["id","created_at","updated_at","created_by"]
