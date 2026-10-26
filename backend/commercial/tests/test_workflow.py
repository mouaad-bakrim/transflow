import datetime
import pytest
from rest_framework.test import APIClient
from accounts.models import Company,User
from operations.models import Customer
from commercial.models import DeliveryLine, DeliveryNote

@pytest.mark.django_db
def test_quote_to_order_to_delivery_to_invoice_and_no_double_billing():
    company=Company.objects.create(name="Workflow Co")
    customer=Customer.objects.create(company=company,name="Client Workflow")
    user=User.objects.create_user(username="accountant",password="Strong-pass-123",company=company,role=User.Role.ACCOUNTANT)
    client=APIClient();client.force_authenticate(user)
    quote=client.post("/api/v1/quotes/",{"company":str(company.id),"customer":str(customer.id),"reference":"DEV-001","document_date":"2026-10-24","status":"DRAFT","lines":[{"description":"Transport Casa-Rabat","quantity":"2","unit_price":"1000","tax_rate":"20"}]},format="json")
    assert quote.status_code==201
    assert quote.data["reference"].startswith("DEV-2026-")
    assert quote.data["total_incl_tax"]=="2400.00"
    pdf=client.get(f"/api/v1/quotes/{quote.data['id']}/pdf/")
    assert pdf.status_code==200
    assert pdf["Content-Type"]=="application/pdf"
    assert bytes(pdf.content).startswith(b"%PDF")
    order=client.post(f"/api/v1/quotes/{quote.data['id']}/convert_to_order/",{"reference":"BC-001","document_date":"2026-10-24"},format="json")
    assert order.status_code==201
    repeated_order=client.post(f"/api/v1/quotes/{quote.data['id']}/convert_to_order/",{"reference":"BC-DUPLICATE","document_date":"2026-10-24"},format="json")
    assert repeated_order.status_code==200
    assert repeated_order.data["id"]==order.data["id"]
    delivery=client.post(f"/api/v1/sales-orders/{order.data['id']}/convert_to_delivery/",{"reference":"BL-001","document_date":"2026-10-24"},format="json")
    assert delivery.status_code==201
    repeated_delivery=client.post(f"/api/v1/sales-orders/{order.data['id']}/convert_to_delivery/",{"reference":"BL-DUPLICATE","document_date":"2026-10-24"},format="json")
    assert repeated_delivery.status_code==200
    assert repeated_delivery.data["id"]==delivery.data["id"]
    payload={"delivery_note_ids":[delivery.data["id"]],"reference":"FAC-001","document_date":"2026-10-24"}
    invoice=client.post("/api/v1/invoices/from-deliveries/",payload,format="json")
    assert invoice.status_code==201
    assert invoice.data["delivery_note_references"]==[delivery.data["reference"]]
    assert order.data["reference"].startswith("BC-2026-")
    assert delivery.data["reference"].startswith("BL-2026-")
    assert invoice.data["reference"].startswith("FAC-2026-")
    assert client.post("/api/v1/invoices/from-deliveries/",{**payload,"reference":"FAC-002"},format="json").status_code==400


@pytest.mark.django_db
def test_grouped_invoice_totals_incompatibility_and_permissions():
    company=Company.objects.create(name="Group Co")
    customer=Customer.objects.create(company=company,name="Client A")
    other=Customer.objects.create(company=company,name="Client B")
    user=User.objects.create_user(username="sales",password="Strong-pass-123",company=company,role=User.Role.SALES)
    client=APIClient(); client.force_authenticate(user)
    deliveries=[]
    for index in range(2):
        delivery=DeliveryNote.objects.create(company=company,customer=customer,reference=f"BL-G{index}",document_date=datetime.date(2026,10,24),status="CONFIRMED")
        DeliveryLine.objects.create(delivery_note=delivery,description="Transport",quantity="1.5",unit_price="100",tax_rate="20")
        deliveries.append(delivery)
    response=client.post("/api/v1/invoices/from-deliveries/",{"delivery_note_ids":[str(d.id) for d in deliveries],"reference":"FAC-GROUP","document_date":"2026-10-24"},format="json")
    assert response.status_code==201
    assert response.data["total_excl_tax"]=="300.00"
    assert response.data["tax_total"]=="60.00"
    assert response.data["total_incl_tax"]=="360.00"
    incompatible=DeliveryNote.objects.create(company=company,customer=other,reference="BL-OTHER",document_date=datetime.date(2026,10,24),status="CONFIRMED")
    DeliveryLine.objects.create(delivery_note=incompatible,description="Transport",quantity=1,unit_price=100,tax_rate=20)
    fresh=DeliveryNote.objects.create(company=company,customer=customer,reference="BL-FRESH",document_date=datetime.date(2026,10,24),status="CONFIRMED")
    DeliveryLine.objects.create(delivery_note=fresh,description="Transport",quantity=1,unit_price=100,tax_rate=20)
    refused=client.post("/api/v1/invoices/from-deliveries/",{"delivery_note_ids":[str(incompatible.id),str(fresh.id)],"reference":"FAC-NO","document_date":"2026-10-24"},format="json")
    assert refused.status_code==400
    driver=User.objects.create_user(username="driver-commercial",password="Strong-pass-123",company=company,role=User.Role.DRIVER)
    client.force_authenticate(driver)
    assert client.get("/api/v1/quotes/").status_code==403
