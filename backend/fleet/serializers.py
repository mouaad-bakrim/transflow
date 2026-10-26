from rest_framework import serializers
from .models import DocumentType, Vehicle, VehicleDocument


class VehicleSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source="company.name", read_only=True)
    agency_name = serializers.CharField(source="agency.name", read_only=True)
    vehicle_type_label = serializers.CharField(source="get_vehicle_type_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Vehicle
        fields = ["id", "company", "company_name", "agency", "agency_name", "registration", "vin", "vehicle_type", "vehicle_type_label", "brand", "model", "year", "odometer_km", "status", "status_label", "active", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate(self, attrs):
        instance = self.instance
        company = attrs.get("company", getattr(instance, "company", None))
        agency = attrs.get("agency", getattr(instance, "agency", None))
        if agency and company and agency.company_id != company.id:
            raise serializers.ValidationError({"agency": "Agence hors société."})
        return attrs


class DocumentTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentType
        fields = ["id", "company", "name", "requires_expiry", "is_mandatory", "blocking_for_assignment", "default_reminder_days", "active"]
        read_only_fields = ["id"]


class VehicleDocumentSerializer(serializers.ModelSerializer):
    vehicle_registration = serializers.CharField(source="vehicle.registration", read_only=True)
    document_type_name = serializers.CharField(source="document_type.name", read_only=True)
    status = serializers.CharField(source="computed_status", read_only=True)

    class Meta:
        model = VehicleDocument
        fields = ["id", "company", "agency", "vehicle", "vehicle_registration", "document_type", "document_type_name", "reference_number", "issued_at", "expires_at", "verification_status", "status", "is_archived", "notes", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        instance = self.instance
        company = attrs.get("company", getattr(instance, "company", None))
        vehicle = attrs.get("vehicle", getattr(instance, "vehicle", None))
        doc_type = attrs.get("document_type", getattr(instance, "document_type", None))
        agency = attrs.get("agency", getattr(instance, "agency", None))
        if vehicle and company and vehicle.company_id != company.id:
            raise serializers.ValidationError({"vehicle": "Véhicule hors société."})
        if doc_type and company and doc_type.company_id != company.id:
            raise serializers.ValidationError({"document_type": "Type hors société."})
        if agency and company and agency.company_id != company.id:
            raise serializers.ValidationError({"agency": "Agence hors société."})
        expires = attrs.get("expires_at", getattr(instance, "expires_at", None))
        issued = attrs.get("issued_at", getattr(instance, "issued_at", None))
        if doc_type and doc_type.requires_expiry and not expires:
            raise serializers.ValidationError({"expires_at": "Date d’expiration obligatoire."})
        if issued and expires and expires < issued:
            raise serializers.ValidationError({"expires_at": "Date d’expiration invalide."})
        return attrs
