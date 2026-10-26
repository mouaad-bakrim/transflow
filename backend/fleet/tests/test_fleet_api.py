from datetime import timedelta
import pytest
from django.utils import timezone
from rest_framework.test import APIClient
from accounts.models import Company, User
from fleet.models import DocumentType, Vehicle, VehicleDocument


@pytest.mark.django_db
def test_vehicle_isolation_between_companies():
    first, second = Company.objects.create(name="Atlas"), Company.objects.create(name="Rif")
    Vehicle.objects.create(company=first, registration="111-A-1")
    Vehicle.objects.create(company=second, registration="222-B-2")
    admin = User.objects.create_user(username="admin", company=first, role=User.Role.COMPANY_ADMIN)
    client = APIClient(); client.force_authenticate(admin)
    response = client.get("/api/v1/vehicles/")
    assert response.status_code == 200
    assert response.data["count"] == 1
    assert response.data["results"][0]["registration"] == "111-A-1"


@pytest.mark.django_db
def test_document_expiry_status_is_computed_server_side():
    company = Company.objects.create(name="Atlas")
    vehicle = Vehicle.objects.create(company=company, registration="111-A-1")
    doc_type = DocumentType.objects.create(company=company, name="Assurance", is_mandatory=True, default_reminder_days=30)
    document = VehicleDocument.objects.create(company=company, vehicle=vehicle, document_type=doc_type, expires_at=timezone.localdate() - timedelta(days=1))
    admin = User.objects.create_user(username="admin", company=company, role=User.Role.COMPANY_ADMIN)
    client = APIClient(); client.force_authenticate(admin)
    response = client.get("/api/v1/vehicle-documents/alerts/")
    assert response.status_code == 200
    assert response.data["count"] == 1
    assert response.data["results"][0]["id"] == str(document.id)
    assert response.data["results"][0]["status"] == "EXPIRED"


@pytest.mark.django_db
def test_compliance_reports_missing_blocking_document():
    company = Company.objects.create(name="Atlas")
    vehicle = Vehicle.objects.create(company=company, registration="111-A-1")
    DocumentType.objects.create(company=company, name="Visite technique", is_mandatory=True, blocking_for_assignment=True)
    admin = User.objects.create_user(username="admin", company=company, role=User.Role.COMPANY_ADMIN)
    client = APIClient(); client.force_authenticate(admin)
    response = client.get(f"/api/v1/vehicles/{vehicle.id}/compliance/")
    assert response.status_code == 200
    assert response.data["compliant"] is False
    assert response.data["blocking_errors"] == ["Visite technique manquant"]


@pytest.mark.django_db
def test_fleet_manager_can_write_but_driver_cannot_read():
    company = Company.objects.create(name="Atlas")
    fleet = User.objects.create_user(username="fleet", company=company, role=User.Role.FLEET)
    driver = User.objects.create_user(username="driver", company=company, role=User.Role.DRIVER)
    client = APIClient(); client.force_authenticate(fleet)
    assert client.post("/api/v1/vehicles/", {"company": str(company.id), "registration": "111-A-1"}).status_code == 201
    client.force_authenticate(driver)
    assert client.get("/api/v1/vehicles/").status_code == 403
