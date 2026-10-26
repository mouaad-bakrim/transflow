import uuid
from decimal import Decimal
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from accounts.models import Agency, Company
from core.models import TimeStampedModel
from fleet.models import Vehicle

class TenantRecord(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(Company, on_delete=models.CASCADE)
    agency = models.ForeignKey(Agency, null=True, blank=True, on_delete=models.PROTECT)
    class Meta: abstract = True
    def clean(self):
        if self.agency_id and self.agency.company_id != self.company_id:
            raise ValidationError({"agency":"Agence hors société."})

class Customer(TenantRecord):
    name = models.CharField(max_length=180)
    ice = models.CharField(max_length=15, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    active = models.BooleanField(default=True)
    class Meta:
        ordering = ["name"]
        constraints = [models.UniqueConstraint(fields=["company","name"], name="unique_customer_name_per_company")]

class Mission(TenantRecord):
    class TransportType(models.TextChoices):
        GOODS="GOODS","Marchandises"; PERSONNEL="PERSONNEL","Personnel"; TOURISM="TOURISM","Touristique"; MIXED="MIXED","Mixte"
    class Status(models.TextChoices):
        DRAFT="DRAFT","Brouillon"; PLANNED="PLANNED","Planifiée"; ASSIGNED="ASSIGNED","Affectée"; IN_PROGRESS="IN_PROGRESS","En cours"; COMPLETED="COMPLETED","Terminée"; DELIVERED="DELIVERED","Livrée"; VALIDATED="VALIDATED","Validée"; INVOICED="INVOICED","Facturée"
    reference = models.CharField(max_length=30)
    transport_type = models.CharField(max_length=16, choices=TransportType.choices, default=TransportType.GOODS)
    delivery_note_number = models.CharField(max_length=60, blank=True)
    nature = models.CharField(max_length=100, blank=True)
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="missions")
    mission_date = models.DateField()
    origin = models.CharField(max_length=180)
    destination = models.CharField(max_length=180)
    driver = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="missions")
    vehicle = models.ForeignKey(Vehicle, null=True, blank=True, on_delete=models.PROTECT, related_name="missions")
    cargo = models.CharField(max_length=180, blank=True)
    planned_distance_km = models.PositiveIntegerField(default=0)
    transport_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    expenses = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    class Meta:
        ordering=["-mission_date","reference"]
        constraints=[models.UniqueConstraint(fields=["company","reference"],name="unique_mission_reference_per_company")]
    @property
    def margin(self): return self.transport_price-self.expenses
    def clean(self):
        super().clean()
        if self.customer_id and self.customer.company_id != self.company_id: raise ValidationError({"customer":"Client hors société."})
        if self.vehicle_id and self.vehicle.company_id != self.company_id: raise ValidationError({"vehicle":"Véhicule hors société."})
        if self.driver_id and self.driver.company_id != self.company_id: raise ValidationError({"driver":"Conducteur hors société."})
        active=[self.Status.PLANNED,self.Status.ASSIGNED,self.Status.IN_PROGRESS]
        conflict=Mission.objects.filter(company_id=self.company_id,mission_date=self.mission_date,status__in=active).exclude(pk=self.pk)
        if self.status in active and self.vehicle_id and conflict.filter(vehicle_id=self.vehicle_id).exists(): raise ValidationError({"vehicle":"Ce véhicule est déjà affecté à cette date."})
        if self.status in active and self.driver_id and conflict.filter(driver_id=self.driver_id).exists(): raise ValidationError({"driver":"Ce conducteur est déjà affecté à cette date."})

class FuelEntry(TenantRecord):
    vehicle = models.ForeignKey(Vehicle,on_delete=models.PROTECT,related_name="fuel_entries")
    mission = models.ForeignKey(Mission,null=True,blank=True,on_delete=models.SET_NULL,related_name="fuel_entries")
    date = models.DateField()
    quantity_liters = models.DecimalField(max_digits=10,decimal_places=2)
    total_cost = models.DecimalField(max_digits=12,decimal_places=2)
    odometer_km = models.PositiveIntegerField()
    station = models.CharField(max_length=160,blank=True)
    class Meta: ordering=["-date","-created_at"]
    @property
    def unit_price(self): return self.total_cost/self.quantity_liters if self.quantity_liters else Decimal("0")

class MaintenanceIntervention(TenantRecord):
    class Kind(models.TextChoices): PREVENTIVE="PREVENTIVE","Préventive"; CORRECTIVE="CORRECTIVE","Corrective"
    class Status(models.TextChoices): PLANNED="PLANNED","Planifiée"; IN_PROGRESS="IN_PROGRESS","En cours"; COMPLETED="COMPLETED","Terminée"
    vehicle = models.ForeignKey(Vehicle,on_delete=models.PROTECT,related_name="interventions")
    title = models.CharField(max_length=180)
    kind = models.CharField(max_length=16,choices=Kind.choices)
    status = models.CharField(max_length=16,choices=Status.choices,default=Status.PLANNED)
    scheduled_date = models.DateField()
    completed_date = models.DateField(null=True,blank=True)
    odometer_km = models.PositiveIntegerField(default=0)
    cost = models.DecimalField(max_digits=12,decimal_places=2,default=0)
    notes = models.TextField(blank=True)
    class Meta: ordering=["-scheduled_date"]

class ModuleEntry(TenantRecord):
    class Section(models.TextChoices):
        PLANNING="PLANNING","Planning & transport"
        TELEMATICS="TELEMATICS","OBC / Télématique"
        FINANCE="FINANCE","Commercial & Finance"
        SUBCONTRACTING="SUBCONTRACTING","Sous-traitance"
        HR="HR","Ressources humaines"
        REPORTING="REPORTING","Analyse & Reporting"
    class Status(models.TextChoices):
        DRAFT="DRAFT","Brouillon"
        PLANNED="PLANNED","Planifié"
        IN_PROGRESS="IN_PROGRESS","En cours"
        COMPLETED="COMPLETED","Terminé"
        CANCELLED="CANCELLED","Annulé"
    section=models.CharField(max_length=24,choices=Section.choices)
    entry_type=models.CharField(max_length=80)
    reference=models.CharField(max_length=50)
    title=models.CharField(max_length=180)
    event_date=models.DateField()
    status=models.CharField(max_length=16,choices=Status.choices,default=Status.DRAFT)
    amount=models.DecimalField(max_digits=12,decimal_places=2,default=0)
    description=models.TextField(blank=True)
    created_by=models.ForeignKey(settings.AUTH_USER_MODEL,null=True,on_delete=models.SET_NULL,related_name="module_entries")
    class Meta:
        ordering=["-event_date","-created_at"]
        constraints=[models.UniqueConstraint(fields=["company","section","reference"],name="unique_module_entry_reference")]
