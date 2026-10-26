import uuid
from decimal import Decimal
from django.core.exceptions import ValidationError
from django.db import models
from accounts.models import Agency,Company
from core.models import TimeStampedModel
from operations.models import Customer

class DocumentSequence(models.Model):
    company=models.ForeignKey(Company,on_delete=models.CASCADE,related_name="commercial_sequences")
    document_type=models.CharField(max_length=12)
    year=models.PositiveSmallIntegerField()
    next_number=models.PositiveIntegerField(default=1)
    class Meta:
        constraints=[models.UniqueConstraint(fields=["company","document_type","year"],name="unique_commercial_sequence")]

class SalesDocument(TimeStampedModel):
    class Status(models.TextChoices):
        DRAFT="DRAFT","Brouillon"; CONFIRMED="CONFIRMED","Confirmé"; PARTIAL="PARTIAL","Partiel"; COMPLETED="COMPLETED","Terminé"; CANCELLED="CANCELLED","Annulé"
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    company=models.ForeignKey(Company,on_delete=models.CASCADE)
    agency=models.ForeignKey(Agency,null=True,blank=True,on_delete=models.PROTECT)
    customer=models.ForeignKey(Customer,on_delete=models.PROTECT)
    reference=models.CharField(max_length=40)
    document_date=models.DateField()
    status=models.CharField(max_length=16,choices=Status.choices,default=Status.DRAFT)
    notes=models.TextField(blank=True)
    currency=models.CharField(max_length=3,default="MAD")
    class Meta: abstract=True
    def clean(self):
        if self.customer_id and self.customer.company_id!=self.company_id: raise ValidationError({"customer":"Client hors société."})
        if self.agency_id and self.agency.company_id!=self.company_id: raise ValidationError({"agency":"Agence hors société."})
    @property
    def total_excl_tax(self): return sum((line.total_excl_tax for line in self.lines.all()),Decimal("0"))
    @property
    def tax_total(self): return sum((line.tax_amount for line in self.lines.all()),Decimal("0"))
    @property
    def total_incl_tax(self): return self.total_excl_tax+self.tax_total

class Quote(SalesDocument):
    valid_until=models.DateField(null=True,blank=True)
    class Meta: ordering=["-document_date"]; constraints=[models.UniqueConstraint(fields=["company","reference"],name="unique_quote_reference")]
class SalesOrder(SalesDocument):
    quote=models.ForeignKey(Quote,null=True,blank=True,on_delete=models.PROTECT,related_name="orders")
    class Meta: ordering=["-document_date"]; constraints=[models.UniqueConstraint(fields=["company","reference"],name="unique_order_reference")]
class DeliveryNote(SalesDocument):
    order=models.ForeignKey(SalesOrder,null=True,blank=True,on_delete=models.PROTECT,related_name="delivery_notes")
    delivered_at=models.DateField(null=True,blank=True)
    billed_invoice=models.ForeignKey("Invoice",null=True,blank=True,on_delete=models.PROTECT,related_name="billed_delivery_notes")
    class Meta: ordering=["-document_date"]; constraints=[models.UniqueConstraint(fields=["company","reference"],name="unique_delivery_reference")]
class Invoice(SalesDocument):
    class PaymentStatus(models.TextChoices): UNPAID="UNPAID","Impayée"; PARTIAL="PARTIAL","Partiellement payée"; PAID="PAID","Payée"
    due_date=models.DateField(null=True,blank=True)
    delivery_notes=models.ManyToManyField(DeliveryNote,related_name="invoices")
    payment_status=models.CharField(max_length=12,choices=PaymentStatus.choices,default=PaymentStatus.UNPAID)
    class Meta: ordering=["-document_date"]; constraints=[models.UniqueConstraint(fields=["company","reference"],name="unique_invoice_reference")]

class DocumentLine(TimeStampedModel):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    description=models.CharField(max_length=220)
    quantity=models.DecimalField(max_digits=12,decimal_places=3,default=1)
    unit_price=models.DecimalField(max_digits=12,decimal_places=2)
    tax_rate=models.DecimalField(max_digits=5,decimal_places=2,default=20)
    class Meta: abstract=True
    @property
    def total_excl_tax(self): return self.quantity*self.unit_price
    @property
    def tax_amount(self): return self.total_excl_tax*self.tax_rate/Decimal("100")
class QuoteLine(DocumentLine): quote=models.ForeignKey(Quote,on_delete=models.CASCADE,related_name="lines")
class OrderLine(DocumentLine): order=models.ForeignKey(SalesOrder,on_delete=models.CASCADE,related_name="lines")
class DeliveryLine(DocumentLine): delivery_note=models.ForeignKey(DeliveryNote,on_delete=models.CASCADE,related_name="lines")
class InvoiceLine(DocumentLine): invoice=models.ForeignKey(Invoice,on_delete=models.CASCADE,related_name="lines")
