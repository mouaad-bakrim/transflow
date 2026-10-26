import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models
from core.models import TimeStampedModel

class Company(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=180)
    legal_name = models.CharField(max_length=220, blank=True)
    ice = models.CharField(max_length=15, blank=True)
    tax_id = models.CharField(max_length=30, blank=True)
    trade_register = models.CharField(max_length=40, blank=True)
    active = models.BooleanField(default=True)
    def __str__(self): return self.name

class Agency(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="agencies")
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=20)
    city = models.CharField(max_length=100, blank=True)
    active = models.BooleanField(default=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=["company", "code"], name="unique_agency_code_per_company")]
    def __str__(self): return f"{self.code} — {self.name}"

class User(AbstractUser):
    class Role(models.TextChoices):
        SUPERADMIN = "SUPERADMIN", "Superadministrateur"
        COMPANY_ADMIN = "COMPANY_ADMIN", "Administrateur société"
        DIRECTOR = "DIRECTOR", "Directeur"
        OPERATIONS = "OPERATIONS", "Responsable exploitation"
        OBC = "OBC", "Responsable OBC"
        FLEET = "FLEET", "Responsable flotte"
        MAINTENANCE = "MAINTENANCE", "Responsable maintenance"
        FUEL = "FUEL", "Responsable carburant"
        HR = "HR", "Responsable RH"
        ACCOUNTANT = "ACCOUNTANT", "Comptable"
        SALES = "SALES", "Commercial"
        DRIVER = "DRIVER", "Conducteur"
    company = models.ForeignKey(Company, null=True, blank=True, on_delete=models.PROTECT, related_name="users")
    agency = models.ForeignKey(Agency, null=True, blank=True, on_delete=models.PROTECT, related_name="users")
    role = models.CharField(max_length=24, choices=Role.choices, default=Role.DRIVER)
    phone = models.CharField(max_length=30, blank=True)
    preferred_language = models.CharField(max_length=5, choices=[("fr", "Français"), ("ar", "العربية")], default="fr")
    def clean(self):
        from django.core.exceptions import ValidationError
        if self.role != self.Role.SUPERADMIN and not self.company_id:
            raise ValidationError({"company": "Une société est obligatoire pour ce rôle."})
        if self.agency_id and self.agency.company_id != self.company_id:
            raise ValidationError({"agency": "L'agence doit appartenir à la société de l'utilisateur."})

