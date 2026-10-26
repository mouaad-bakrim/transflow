from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from accounts.models import Company
from commercial.models import Quote, QuoteLine
from commercial.views import next_reference
from operations.models import Customer


EXAMPLES = [
    ("Casablanca → Agadir — transport complet", "1", "6500", "20", "Livraison sous 48 heures."),
    ("Tanger → Casablanca — transport routier", "1", "4500", "20", "Chargement inclus."),
    ("Chargement et déchargement", "1", "800", "20", "Manutention sur site client."),
    ("Casablanca → Rabat — rotation", "5", "1200", "20", "Une rotation par jour ouvrable."),
    ("Marrakech → Fès — palettes", "12", "425", "20", "Marchandise palettisée non dangereuse."),
    ("Rabat → Tanger — livraison express", "1", "3200", "20", "Enlèvement le matin, livraison le jour même."),
]


class Command(BaseCommand):
    help = "Ajoute des devis de démonstration sans dupliquer les données existantes."

    def handle(self, *args, **options):
        company = Company.objects.filter(name="Transport Démo").first() or Company.objects.first()
        if not company:
            self.stderr.write("Aucune société disponible.")
            return
        customers = list(Customer.objects.filter(company=company, active=True).order_by("name"))
        if not customers:
            self.stderr.write("Aucun client actif disponible pour cette société.")
            return
        today = timezone.localdate()
        created = 0
        for index, (description, quantity, price, tax, note) in enumerate(EXAMPLES, start=1):
            marker = f"[DEMO-DEVIS-{index}]"
            if Quote.objects.filter(company=company, notes__contains=marker).exists():
                continue
            customer = customers[(index - 1) % len(customers)]
            with transaction.atomic():
                quote = Quote.objects.create(
                    company=company,
                    agency=customer.agency,
                    customer=customer,
                    reference=next_reference(company, "DEVIS", today),
                    document_date=today - timedelta(days=index - 1),
                    valid_until=today + timedelta(days=30),
                    status=Quote.Status.DRAFT,
                    currency="MAD",
                    notes=f"{note} {marker}",
                )
                QuoteLine.objects.create(
                    quote=quote,
                    description=description,
                    quantity=Decimal(quantity),
                    unit_price=Decimal(price),
                    tax_rate=Decimal(tax),
                )
                created += 1
        self.stdout.write(self.style.SUCCESS(f"{created} devis de test ajoutés."))
