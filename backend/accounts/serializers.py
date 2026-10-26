from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from .models import Agency, Company, User

class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = ["id", "name", "legal_name", "ice", "tax_id", "trade_register", "active", "created_at"]
        read_only_fields = ["id", "created_at"]

class AgencySerializer(serializers.ModelSerializer):
    class Meta:
        model = Agency
        fields = ["id", "company", "name", "code", "city", "active", "created_at"]
        read_only_fields = ["id", "created_at"]

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, validators=[validate_password])
    role_label = serializers.CharField(source="get_role_display", read_only=True)
    company_name = serializers.CharField(source="company.name", read_only=True)
    agency_name = serializers.CharField(source="agency.name", read_only=True)
    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "phone", "role", "role_label", "company", "company_name", "agency", "agency_name", "preferred_language", "is_active", "password"]
        read_only_fields = ["id"]
    def validate(self, attrs):
        company = attrs.get("company", getattr(self.instance, "company", None))
        agency = attrs.get("agency", getattr(self.instance, "agency", None))
        role = attrs.get("role", getattr(self.instance, "role", User.Role.DRIVER))
        if role != User.Role.SUPERADMIN and not company:
            raise serializers.ValidationError({"company": "Une société est obligatoire."})
        if agency and agency.company_id != company.id:
            raise serializers.ValidationError({"agency": "Agence hors société."})
        return attrs
    def create(self, validated_data):
        password = validated_data.pop("password", None)
        user = User(**validated_data)
        if password: user.set_password(password)
        else: user.set_unusable_password()
        user.save()
        return user
    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        instance = super().update(instance, validated_data)
        if password:
            instance.set_password(password); instance.save(update_fields=["password"])
        return instance

