import random
from datetime import date, timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction
from accounts.models import Agency, Company, User
from fleet.models import DocumentType, Vehicle, VehicleDocument
from operations.models import Customer, FuelEntry, MaintenanceIntervention, Mission, ModuleEntry

class Command(BaseCommand):
    help = "Crée un jeu de démonstration transport fictif et idempotent."

    @transaction.atomic
    def handle(self, *args, **options):
        rng = random.Random(20261023)
        company, _ = Company.objects.get_or_create(name="Transport Démo", defaults={"legal_name":"DONNÉES DE DÉMONSTRATION", "ice":"000000000000001"})
        casa, _ = Agency.objects.get_or_create(company=company, code="CAS-DEMO", defaults={"name":"Agence Casablanca Démo", "city":"Casablanca"})
        rabat, _ = Agency.objects.get_or_create(company=company, code="RBT-DEMO", defaults={"name":"Agence Rabat Démo", "city":"Rabat"})
        agencies = [casa, rabat]
        drivers=[]
        for i in range(1, 41):
            user, created = User.objects.get_or_create(username=f"demo.chauffeur{i:02d}", defaults={"first_name":"Chauffeur", "last_name":f"Démo {i:02d}", "company":company, "agency":agencies[i%2], "role":User.Role.DRIVER, "is_active":True})
            if created: user.set_unusable_password(); user.save(update_fields=["password"])
            drivers.append(user)
        vehicles=[]
        statuses=[Vehicle.Status.AVAILABLE]*22+[Vehicle.Status.ON_MISSION]*7+[Vehicle.Status.MAINTENANCE]*4+[Vehicle.Status.IMMOBILIZED]*3
        for i in range(1, 37):
            vehicle, _ = Vehicle.objects.get_or_create(company=company, registration=f"{10000+i}-A-6", defaults={"agency":agencies[i%2], "vehicle_type":Vehicle.Type.TRACTOR if i<=28 else Vehicle.Type.TRUCK, "brand":["Volvo","Renault","Mercedes","Scania"][i%4], "model":f"Démo {i:02d}", "year":2018+i%7, "odometer_km":180000+i*7300, "status":statuses[i-1]})
            vehicles.append(vehicle)
        customers=[]
        for i in range(1,13):
            customer,_=Customer.objects.get_or_create(company=company,name=f"Client Démo {i:02d}",defaults={"agency":agencies[i%2],"ice":f"999999999{i:05d}","phone":f"060000{i:04d}","email":f"client{i:02d}@demo.invalid"})
            customers.append(customer)
        mission_statuses=list(Mission.Status.values)
        cities=["Casablanca","Rabat","Tanger","Agadir","Marrakech","Fès","Kénitra","El Jadida"]
        missions=[]
        for i in range(1,51):
            mission,_=Mission.objects.get_or_create(company=company,reference=f"DEMO-M-{i:04d}",defaults={"agency":agencies[i%2],"transport_type":Mission.TransportType.GOODS,"delivery_note_number":f"DEMO-BL-{i:04d}","nature":["Ciment","Matériel BTP","Engrais","Ferraille"][i%4],"customer":customers[i%12],"mission_date":date.today()-timedelta(days=45-i),"origin":cities[i%len(cities)],"destination":cities[(i+3)%len(cities)],"driver":drivers[i%40] if i%5 else None,"vehicle":vehicles[i%36] if i%5 else None,"cargo":"Donnée fictive de démonstration","planned_distance_km":120+(i*17)%780,"transport_price":Decimal(2500+(i%9)*650),"expenses":Decimal(700+(i%7)*130),"status":mission_statuses[i%len(mission_statuses)]})
            missions.append(mission)
        for i in range(1,101):
            FuelEntry.objects.get_or_create(company=company, station=f"Station Démo {i%4+1}", date=date.today()-timedelta(days=i%45), vehicle=vehicles[i%36], odometer_km=vehicles[i%36].odometer_km-i*12, defaults={"agency":agencies[i%2],"mission":missions[i%50] if i%3 else None,"quantity_liters":Decimal(180+(i%8)*20),"total_cost":Decimal(2300+(i%8)*260)})
        for i in range(1,16):
            MaintenanceIntervention.objects.get_or_create(company=company,vehicle=vehicles[(i*2)%36],title=f"Intervention Démo {i:02d}",scheduled_date=date.today()+timedelta(days=i-7),defaults={"agency":agencies[i%2],"kind":MaintenanceIntervention.Kind.PREVENTIVE if i%2 else MaintenanceIntervention.Kind.CORRECTIVE,"status":MaintenanceIntervention.Status.COMPLETED if i<5 else MaintenanceIntervention.Status.PLANNED,"odometer_km":vehicles[(i*2)%36].odometer_km,"cost":Decimal(800+i*175),"notes":"Donnée fictive de démonstration"})
        doc_types=[]
        for name,expiry,blocking in [("Carte grise",False,True),("Assurance",True,True),("Visite technique",True,True),("Vignette",True,False),("Autorisation",True,False)]:
            kind,_=DocumentType.objects.get_or_create(company=company,name=name,defaults={"requires_expiry":expiry,"is_mandatory":True,"blocking_for_assignment":blocking,"default_reminder_days":30})
            doc_types.append(kind)
        for vehicle in vehicles:
            for j,kind in enumerate(doc_types):
                VehicleDocument.objects.get_or_create(company=company,vehicle=vehicle,document_type=kind,reference_number=f"DEMO-{vehicle.registration}-{j}",defaults={"agency":vehicle.agency,"issued_at":date.today()-timedelta(days=300),"expires_at":None if not kind.requires_expiry else date.today()+timedelta(days=((vehicles.index(vehicle)+j*13)%120)-25),"verification_status":VehicleDocument.Verification.VERIFIED,"notes":"Document fictif de démonstration"})
        module_types={"PLANNING":["Affectation","Étape / livraison"],"TELEMATICS":["Import CSV / Excel","Rapport mouvements"],"FINANCE":["Devis","Paiement"],"SUBCONTRACTING":["Sous-traitant","Opération sous-traitée"],"HR":["Pointage","Congé / absence"],"REPORTING":["Rapport exploitation","Export PDF / XLSX / CSV"]}
        for section,types in module_types.items():
            for i in range(1,7):
                ModuleEntry.objects.get_or_create(company=company,section=section,reference=f"DEMO-{section[:3]}-{i:03d}",defaults={"agency":agencies[i%2],"entry_type":types[i%2],"title":f"{types[i%2]} Démo {i:02d}","event_date":date.today()-timedelta(days=i*2),"status":["DRAFT","PLANNED","IN_PROGRESS","COMPLETED"][i%4],"amount":Decimal(i*450 if section in {"FINANCE","SUBCONTRACTING","HR"} else 0),"description":"Donnée fictive de démonstration"})
        self.stdout.write(self.style.SUCCESS("Données de démonstration prêtes : 36 véhicules, 40 conducteurs, 12 clients, 50 missions, 100 pleins, 15 interventions."))
