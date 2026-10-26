import pytest
from rest_framework.test import APIClient
from accounts.models import Agency, Company, User

@pytest.mark.django_db
def test_company_admin_only_sees_own_tenant():
    a, b = Company.objects.create(name="Atlas"), Company.objects.create(name="Rif")
    Agency.objects.create(company=a, name="Casa", code="CAS")
    Agency.objects.create(company=b, name="Tanger", code="TNG")
    user = User.objects.create_user(username="admin", password="Strong-pass-123", company=a, role=User.Role.COMPANY_ADMIN)
    client = APIClient(); client.force_authenticate(user)
    response = client.get("/api/v1/agencies/")
    assert response.status_code == 200
    assert response.data["count"] == 1
    assert response.data["results"][0]["code"] == "CAS"

@pytest.mark.django_db
def test_company_admin_cannot_inject_other_company_on_create():
    a, b = Company.objects.create(name="Atlas"), Company.objects.create(name="Rif")
    user = User.objects.create_user(username="admin", password="Strong-pass-123", company=a, role=User.Role.COMPANY_ADMIN)
    client = APIClient(); client.force_authenticate(user)
    response = client.post("/api/v1/agencies/", {"company": str(b.id), "name": "Test", "code": "TST"})
    assert response.status_code == 201
    assert Agency.objects.get().company == a

@pytest.mark.django_db
def test_driver_cannot_administer_users():
    company = Company.objects.create(name="Atlas")
    driver = User.objects.create_user(username="driver", password="Strong-pass-123", company=company, role=User.Role.DRIVER)
    client = APIClient(); client.force_authenticate(driver)
    assert client.get("/api/v1/users/").status_code == 403

@pytest.mark.django_db
def test_company_admin_cannot_promote_user_to_superadmin():
    company = Company.objects.create(name="Atlas")
    admin = User.objects.create_user(username="admin", password="Strong-pass-123", company=company, role=User.Role.COMPANY_ADMIN)
    target = User.objects.create_user(username="target", password="Strong-pass-123", company=company, role=User.Role.DRIVER)
    client = APIClient(); client.force_authenticate(admin)
    response = client.patch(f"/api/v1/users/{target.id}/", {"role": User.Role.SUPERADMIN}, format="json")
    assert response.status_code == 403
    target.refresh_from_db()
    assert target.role == User.Role.DRIVER

@pytest.mark.django_db
def test_user_can_update_profile_without_changing_role():
    company = Company.objects.create(name="Atlas")
    driver = User.objects.create_user(username="driver", password="Strong-pass-123", company=company, role=User.Role.DRIVER)
    client = APIClient(); client.force_authenticate(driver)
    response = client.patch("/api/v1/auth/me/", {"first_name": "Samir", "phone": "0600000000", "role": User.Role.SUPERADMIN}, format="json")
    assert response.status_code == 200
    driver.refresh_from_db()
    assert driver.first_name == "Samir"
    assert driver.phone == "0600000000"
    assert driver.role == User.Role.DRIVER
