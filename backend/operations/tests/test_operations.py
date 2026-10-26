import datetime
import pytest
from rest_framework.test import APIClient
from accounts.models import Company,User
from fleet.models import Vehicle
from operations.models import Customer,Mission

@pytest.mark.django_db
def test_mission_rejects_vehicle_conflict():
    company=Company.objects.create(name="Atlas")
    admin=User.objects.create_user(username="ops",password="Strong-pass-123",company=company,role=User.Role.COMPANY_ADMIN)
    vehicle=Vehicle.objects.create(company=company,registration="123-A-45")
    customer=Customer.objects.create(company=company,name="Client A")
    Mission.objects.create(company=company,reference="M-001",customer=customer,mission_date=datetime.date(2026,10,21),origin="Casa",destination="Rabat",vehicle=vehicle,status=Mission.Status.PLANNED)
    client=APIClient(); client.force_authenticate(admin)
    response=client.post("/api/v1/missions/",{"company":str(company.id),"reference":"M-002","customer":str(customer.id),"mission_date":"2026-10-21","origin":"Casa","destination":"Fès","vehicle":str(vehicle.id),"status":"ASSIGNED"},format="json")
    assert response.status_code==400
    assert "déjà affecté" in str(response.data)

@pytest.mark.django_db
def test_customer_list_is_tenant_scoped():
    a,b=Company.objects.create(name="Atlas"),Company.objects.create(name="Rif")
    Customer.objects.create(company=a,name="Client Atlas"); Customer.objects.create(company=b,name="Client Rif")
    user=User.objects.create_user(username="sales",password="Strong-pass-123",company=a,role=User.Role.SALES)
    client=APIClient(); client.force_authenticate(user)
    response=client.get("/api/v1/customers/")
    assert response.status_code==200
    assert response.data["count"]==1
    assert response.data["results"][0]["name"]=="Client Atlas"
