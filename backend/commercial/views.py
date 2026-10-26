from datetime import date
from django.db import IntegrityError, transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import BasePermission
from rest_framework.response import Response

from accounts.models import User
from accounts.permissions import scoped_queryset
from accounts.views import audit
from .models import DeliveryLine, DeliveryNote, DocumentSequence, Invoice, InvoiceLine, OrderLine, Quote, SalesOrder
from .serializers import DeliverySerializer, InvoiceSerializer, OrderSerializer, QuoteSerializer
from .pdf import document_pdf_response

PREFIXES = {"DEVIS":"DEV", "COMMANDE":"BC", "LIVRAISON":"BL", "FACTURE":"FAC"}
def next_reference(company, document_type, document_date):
    document_models = {"DEVIS": Quote, "COMMANDE": SalesOrder, "LIVRAISON": DeliveryNote, "FACTURE": Invoice}
    prefix = f"{PREFIXES[document_type]}-{document_date.year}-"
    existing_numbers = []
    for reference in document_models[document_type].objects.filter(company=company, reference__startswith=prefix).values_list("reference", flat=True):
        try: existing_numbers.append(int(reference.removeprefix(prefix)))
        except ValueError: pass
    sequence, _ = DocumentSequence.objects.select_for_update().get_or_create(
        company=company, document_type=document_type, year=document_date.year,
        defaults={"next_number": max(existing_numbers, default=0) + 1},
    )
    number = sequence.next_number
    sequence.next_number = number + 1
    sequence.save(update_fields=["next_number"])
    return f"{PREFIXES[document_type]}-{document_date.year}-{number:05d}"


class CommercialPermission(BasePermission):
    allowed = {User.Role.SUPERADMIN, User.Role.COMPANY_ADMIN, User.Role.DIRECTOR,
               User.Role.ACCOUNTANT, User.Role.SALES, User.Role.OPERATIONS}
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in self.allowed


class DocumentViewSet(viewsets.ModelViewSet):
    permission_classes = [CommercialPermission]
    def get_queryset(self):
        queryset = scoped_queryset(super().get_queryset(), self.request.user)
        return queryset.filter(agency_id=self.request.user.agency_id) if self.request.user.agency_id else queryset
    @transaction.atomic
    def perform_create(self, serializer):
        extra = {"status": "DRAFT"}
        if self.request.user.role != User.Role.SUPERADMIN: extra["company"] = self.request.user.company
        if self.request.user.agency_id: extra["agency"] = self.request.user.agency
        document_types = {Quote:"DEVIS", SalesOrder:"COMMANDE", DeliveryNote:"LIVRAISON", Invoice:"FACTURE"}
        company = extra.get("company") or serializer.validated_data.get("company")
        document_date = serializer.validated_data["document_date"]
        extra["reference"] = next_reference(company, document_types[serializer.Meta.model], document_date)
        obj = serializer.save(**extra); audit(self.request, "CREATE", obj)
    def perform_update(self, serializer):
        extra = {} if self.request.user.role == User.Role.SUPERADMIN else {"company": self.request.user.company}
        if self.request.user.agency_id: extra["agency"] = self.request.user.agency
        obj = serializer.save(**extra); audit(self.request, "UPDATE", obj)
    def perform_destroy(self, instance):
        if instance.status != instance.Status.DRAFT: raise ValidationError("Un document validé ne peut pas être supprimé.")
        audit(self.request, "DELETE", instance); instance.delete()

    @action(detail=True, methods=["get"])
    def pdf(self, request, pk=None):
        return document_pdf_response(self.get_object())


class QuoteViewSet(DocumentViewSet):
    queryset = Quote.objects.prefetch_related("lines", "orders").select_related("customer", "company", "agency")
    serializer_class = QuoteSerializer
    @action(detail=True, methods=["post"])
    @transaction.atomic
    def convert_to_order(self, request, pk=None):
        quote = self.get_queryset().select_for_update(of=("self",)).get(pk=pk)
        existing = SalesOrder.objects.filter(quote=quote).first()
        if existing: return Response(OrderSerializer(existing, context={"request": request}).data)
        if quote.status == quote.Status.CANCELLED: raise ValidationError("Un devis annulé ne peut pas être validé.")
        if not quote.lines.exists(): raise ValidationError("Le devis doit contenir au moins une prestation.")
        try:
            order = SalesOrder.objects.create(company=quote.company, agency=quote.agency, customer=quote.customer,
                quote=quote, reference=next_reference(quote.company, "COMMANDE", quote.document_date),
                document_date=request.data.get("document_date") or quote.document_date,
                status=SalesOrder.Status.DRAFT, notes=quote.notes, currency=quote.currency)
            OrderLine.objects.bulk_create([OrderLine(order=order, description=line.description, quantity=line.quantity,
                unit_price=line.unit_price, tax_rate=line.tax_rate) for line in quote.lines.all()])
            quote.status = Quote.Status.CONFIRMED; quote.save(update_fields=["status", "updated_at"])
        except IntegrityError: order = SalesOrder.objects.get(quote=quote)
        audit(request, "CONVERT", order)
        return Response(OrderSerializer(order, context={"request": request}).data, status=status.HTTP_201_CREATED)


class OrderViewSet(DocumentViewSet):
    queryset = SalesOrder.objects.prefetch_related("lines", "delivery_notes").select_related("customer", "company", "agency", "quote")
    serializer_class = OrderSerializer
    @action(detail=True, methods=["post"])
    @transaction.atomic
    def convert_to_delivery(self, request, pk=None):
        order = self.get_queryset().select_for_update(of=("self",)).get(pk=pk)
        existing = DeliveryNote.objects.filter(order=order).first()
        if existing: return Response(DeliverySerializer(existing, context={"request": request}).data)
        if order.status == order.Status.CANCELLED: raise ValidationError("Une commande annulée ne peut pas être validée.")
        try:
            delivery = DeliveryNote.objects.create(company=order.company, agency=order.agency, customer=order.customer,
                order=order, reference=next_reference(order.company, "LIVRAISON", order.document_date),
                document_date=request.data.get("document_date") or order.document_date,
                status=DeliveryNote.Status.CONFIRMED, notes=order.notes, currency=order.currency)
            DeliveryLine.objects.bulk_create([DeliveryLine(delivery_note=delivery, description=line.description,
                quantity=line.quantity, unit_price=line.unit_price, tax_rate=line.tax_rate) for line in order.lines.all()])
            order.status = SalesOrder.Status.CONFIRMED; order.save(update_fields=["status", "updated_at"])
        except IntegrityError: delivery = DeliveryNote.objects.get(order=order)
        audit(request, "CONVERT", delivery)
        return Response(DeliverySerializer(delivery, context={"request": request}).data, status=status.HTTP_201_CREATED)


class DeliveryViewSet(DocumentViewSet):
    queryset = DeliveryNote.objects.prefetch_related("lines", "invoices").select_related("customer", "company", "agency", "order", "order__quote", "billed_invoice")
    serializer_class = DeliverySerializer


class InvoiceViewSet(DocumentViewSet):
    queryset = Invoice.objects.prefetch_related("lines", "billed_delivery_notes", "delivery_notes").select_related("customer", "company", "agency")
    serializer_class = InvoiceSerializer
    @action(detail=False, methods=["post"], url_path="from-deliveries")
    @transaction.atomic
    def from_deliveries(self, request):
        ids = list(dict.fromkeys(request.data.get("delivery_note_ids", [])))
        queryset = scoped_queryset(DeliveryNote.objects.prefetch_related("lines", "invoices"), request.user)
        if request.user.agency_id: queryset = queryset.filter(agency_id=request.user.agency_id)
        deliveries = list(queryset.select_for_update().filter(id__in=ids).order_by("id"))
        if not ids or len(deliveries) != len(ids): raise ValidationError("Sélection invalide ou hors de votre périmètre.")
        if any(d.status == DeliveryNote.Status.CANCELLED for d in deliveries): raise ValidationError("Un BL annulé ne peut pas être facturé.")
        if any(d.billed_invoice_id or d.invoices.exists() for d in deliveries): raise ValidationError("Un ou plusieurs BL sont déjà facturés.")
        if len({d.customer_id for d in deliveries}) != 1: raise ValidationError("Tous les BL doivent appartenir au même client.")
        if len({d.company_id for d in deliveries}) != 1: raise ValidationError("Tous les BL doivent appartenir à la même société émettrice.")
        if len({d.currency for d in deliveries}) != 1: raise ValidationError("Tous les BL doivent utiliser la même devise.")
        first = deliveries[0]
        document_date = date.fromisoformat(request.data["document_date"])
        invoice = Invoice.objects.create(company=first.company, agency=first.agency, customer=first.customer,
            reference=next_reference(first.company, "FACTURE", document_date), document_date=document_date,
            due_date=request.data.get("due_date"), status=Invoice.Status.CONFIRMED, currency=first.currency)
        invoice.delivery_notes.set(deliveries)
        InvoiceLine.objects.bulk_create([InvoiceLine(invoice=invoice, description=f"{delivery.reference} — {line.description}",
            quantity=line.quantity, unit_price=line.unit_price, tax_rate=line.tax_rate)
            for delivery in deliveries for line in delivery.lines.all()])
        DeliveryNote.objects.filter(pk__in=[d.pk for d in deliveries]).update(billed_invoice=invoice)
        audit(request, "CREATE_FROM_BL", invoice)
        return Response(self.get_serializer(invoice).data, status=status.HTTP_201_CREATED)
