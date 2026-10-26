from rest_framework.routers import DefaultRouter
from .views import DocumentTypeViewSet, VehicleDocumentViewSet, VehicleViewSet

router = DefaultRouter()
router.register("vehicles", VehicleViewSet, basename="vehicle")
router.register("vehicle-document-types", DocumentTypeViewSet, basename="vehicle-document-type")
router.register("vehicle-documents", VehicleDocumentViewSet, basename="vehicle-document")
urlpatterns = router.urls
