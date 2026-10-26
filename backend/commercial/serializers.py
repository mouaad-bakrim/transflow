from rest_framework import serializers
from .models import DeliveryLine,DeliveryNote,Invoice,InvoiceLine,OrderLine,Quote,QuoteLine,SalesOrder

class LineSerializer(serializers.Serializer):
    id=serializers.UUIDField(read_only=True); description=serializers.CharField(); quantity=serializers.DecimalField(max_digits=12,decimal_places=3); unit_price=serializers.DecimalField(max_digits=12,decimal_places=2); tax_rate=serializers.DecimalField(max_digits=5,decimal_places=2,default=20); total_excl_tax=serializers.DecimalField(max_digits=14,decimal_places=2,read_only=True); tax_amount=serializers.DecimalField(max_digits=14,decimal_places=2,read_only=True)
    def validate_quantity(self,value):
        if value <= 0: raise serializers.ValidationError("La quantité doit être supérieure à zéro.")
        return value
    def validate_unit_price(self,value):
        if value < 0: raise serializers.ValidationError("Le prix ne peut pas être négatif.")
        return value
class DocumentSerializer(serializers.ModelSerializer):
    customer_name=serializers.CharField(source="customer.name",read_only=True); company_name=serializers.CharField(source="company.name",read_only=True); agency_name=serializers.CharField(source="agency.name",read_only=True); lines=LineSerializer(many=True); total_excl_tax=serializers.DecimalField(max_digits=14,decimal_places=2,read_only=True); tax_total=serializers.DecimalField(max_digits=14,decimal_places=2,read_only=True); total_incl_tax=serializers.DecimalField(max_digits=14,decimal_places=2,read_only=True)
    line_model=None; parent_field=""
    def validate(self,attrs):
        company=attrs.get("company",getattr(self.instance,"company",None)); customer=attrs.get("customer",getattr(self.instance,"customer",None)); agency=attrs.get("agency",getattr(self.instance,"agency",None)); request=self.context.get("request")
        if request and request.user.role!="SUPERADMIN": company=request.user.company
        if customer and company and customer.company_id!=company.id: raise serializers.ValidationError({"customer":"Client hors société."})
        if agency and company and agency.company_id!=company.id: raise serializers.ValidationError({"agency":"Agence hors société."})
        if request and request.user.agency_id and customer and customer.agency_id not in (None,request.user.agency_id): raise serializers.ValidationError({"customer":"Client hors agence."})
        return attrs
    def create(self,validated):
        lines=validated.pop("lines",[]); obj=super().create(validated)
        for line in lines: self.line_model.objects.create(**{self.parent_field:obj},**line)
        return obj
    def update(self,instance,validated):
        if instance.status != "DRAFT": raise serializers.ValidationError("Un document validé ne peut plus être modifié.")
        lines=validated.pop("lines",None); obj=super().update(instance,validated)
        if lines is not None:
            obj.lines.all().delete()
            for line in lines:self.line_model.objects.create(**{self.parent_field:obj},**line)
        return obj
class QuoteSerializer(DocumentSerializer):
    order_id=serializers.SerializerMethodField(); order_reference=serializers.SerializerMethodField()
    def get_order_id(self,obj):
        order=obj.orders.order_by("created_at").first(); return order.id if order else None
    def get_order_reference(self,obj):
        order=obj.orders.order_by("created_at").first(); return order.reference if order else ""
    line_model=QuoteLine; parent_field="quote"
    class Meta: model=Quote; fields="__all__"; extra_kwargs={"reference":{"required":False,"allow_blank":True}}
class OrderSerializer(DocumentSerializer):
    line_model=OrderLine; parent_field="order"; quote_reference=serializers.CharField(source="quote.reference",read_only=True); delivery_note_id=serializers.SerializerMethodField(); delivery_note_reference=serializers.SerializerMethodField()
    def get_delivery_note_id(self,obj):
        delivery=obj.delivery_notes.order_by("created_at").first(); return delivery.id if delivery else None
    def get_delivery_note_reference(self,obj):
        delivery=obj.delivery_notes.order_by("created_at").first(); return delivery.reference if delivery else ""
    class Meta: model=SalesOrder; fields="__all__"; extra_kwargs={"reference":{"required":False,"allow_blank":True}}
class DeliverySerializer(DocumentSerializer):
    line_model=DeliveryLine; parent_field="delivery_note"; order_reference=serializers.CharField(source="order.reference",read_only=True); quote_reference=serializers.CharField(source="order.quote.reference",read_only=True); invoiced=serializers.SerializerMethodField(); invoice_id=serializers.UUIDField(source="billed_invoice.id",read_only=True); invoice_reference=serializers.CharField(source="billed_invoice.reference",read_only=True)
    def get_invoiced(self,obj): return bool(obj.billed_invoice_id or obj.invoices.exists())
    class Meta: model=DeliveryNote; fields="__all__"; extra_kwargs={"reference":{"required":False,"allow_blank":True}}
class InvoiceSerializer(DocumentSerializer):
    line_model=InvoiceLine; parent_field="invoice"; delivery_note_references=serializers.SerializerMethodField(); delivery_note_ids=serializers.SerializerMethodField()
    def _deliveries(self,obj):
        billed=list(obj.billed_delivery_notes.all()); return billed or list(obj.delivery_notes.all())
    def get_delivery_note_references(self,obj): return [delivery.reference for delivery in self._deliveries(obj)]
    def get_delivery_note_ids(self,obj): return [delivery.id for delivery in self._deliveries(obj)]
    class Meta: model=Invoice; fields="__all__"; extra_kwargs={"reference":{"required":False,"allow_blank":True}}
