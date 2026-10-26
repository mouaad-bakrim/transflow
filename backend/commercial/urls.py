from rest_framework.routers import DefaultRouter
from .views import DeliveryViewSet,InvoiceViewSet,OrderViewSet,QuoteViewSet
router=DefaultRouter();router.register("quotes",QuoteViewSet);router.register("sales-orders",OrderViewSet);router.register("delivery-notes",DeliveryViewSet);router.register("invoices",InvoiceViewSet)
urlpatterns=router.urls
