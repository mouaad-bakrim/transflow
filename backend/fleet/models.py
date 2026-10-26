import uuid
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
from core.models import TimeStampedModel
from accounts.models import Agency, Company


class Vehicle(TimeStampedModel):
    class Type(models.TextChoices):
        TRACTOR = "TRACTOR", "Tracteur"
        TRUCK = "TRUCK", "Porteur"
        TRAILER = "TRAILER", "Remorque"
        SEMI_TRAILER = "SEMI_TRAILER", "Semi-remorque"
        UTILITY = "UTILITY", "Utilitaire"

    class Status(models.TextChoices):
        AVAILABLE = "AVAILABLE", "Disponible"
        ON_MISSION = "ON_MISSION", "En mission"
        MAINTENANCE = "MAINTENANCE", "En maintenance"
        IMMOBILIZED = "IMMOBILIZED", "Immobilisé"
        OUT_OF_SERVICE = "OUT_OF_SERVICE", "Hors service"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="vehicles")
    agency = models.ForeignKey(Agency, null=True, blank=True, on_delete=models.PROTECT, related_name="vehicles")
    registration = models.CharField(max_length=30)
    vin = models.CharField(max_length=50, blank=True)
    vehicle_type = models.CharField(max_length=24, choices=Type.choices, default=Type.TRUCK)
    brand = models.CharField(max_length=80, blank=True)
    model = models.CharField(max_length=80, blank=True)
    year = models.PositiveSmallIntegerField(null=True, blank=True)
    odometer_km = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.AVAILABLE)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ["registration"]
        constraints = [models.UniqueConstraint(fields=["company", "registration"], name="unique_vehicle_registration_per_company")]
        indexes = [models.Index(fields=["company", "status"])]

    def clean(self):
        if self.agency_id and self.agency.company_id != self.company_id:
            raise ValidationError({"agency": "L’agence doit appartenir à la société du véhicule."})


class DocumentType(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="vehicle_document_types")
    name = models.CharField(max_length=100)
    requires_expiry = models.BooleanField(default=True)
    is_mandatory = models.BooleanField(default=False)
    blocking_for_assignment = models.BooleanField(default=False)
    default_reminder_days = models.PositiveSmallIntegerField(default=30)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        constraints = [models.UniqueConstraint(fields=["company", "name"], name="unique_vehicle_document_type_per_company")]


class VehicleDocument(TimeStampedModel):
    class Verification(models.TextChoices):
        PENDING = "PENDING", "À vérifier"
        VERIFIED = "VERIFIED", "Vérifié"
        REJECTED = "REJECTED", "Rejeté"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="vehicle_documents")
    agency = models.ForeignKey(Agency, null=True, blank=True, on_delete=models.PROTECT, related_name="vehicle_documents")
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name="documents")
    document_type = models.ForeignKey(DocumentType, on_delete=models.PROTECT, related_name="documents")
    reference_number = models.CharField(max_length=100, blank=True)
    issued_at = models.DateField(null=True, blank=True)
    expires_at = models.DateField(null=True, blank=True)
    verification_status = models.CharField(max_length=16, choices=Verification.choices, default=Verification.PENDING)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="created_vehicle_documents")
    is_archived = models.BooleanField(default=False)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["expires_at", "vehicle__registration"]
        indexes = [models.Index(fields=["company", "expires_at"]), models.Index(fields=["company", "is_archived"])]

    def clean(self):
        if self.vehicle_id and self.vehicle.company_id != self.company_id:
            raise ValidationError({"vehicle": "Véhicule hors société."})
        if self.document_type_id and self.document_type.company_id != self.company_id:
            raise ValidationError({"document_type": "Type de document hors société."})
        if self.agency_id and self.agency.company_id != self.company_id:
            raise ValidationError({"agency": "Agence hors société."})
        if self.document_type_id and self.document_type.requires_expiry and not self.expires_at:
            raise ValidationError({"expires_at": "La date d’expiration est obligatoire pour ce type."})
        if self.issued_at and self.expires_at and self.expires_at < self.issued_at:
            raise ValidationError({"expires_at": "La date d’expiration doit suivre la date d’émission."})

    @property
    def computed_status(self):
        if not self.expires_at:
            return "NO_EXPIRY"
        today = timezone.localdate()
        if self.expires_at < today:
            return "EXPIRED"
        if (self.expires_at - today).days <= self.document_type.default_reminder_days:
            return "EXPIRING_SOON"
        return "VALID"
