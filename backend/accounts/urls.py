from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import AgencyViewSet, CompanyViewSet, DashboardView, MeView, UserViewSet

router = DefaultRouter()
router.register("companies", CompanyViewSet, basename="company")
router.register("agencies", AgencyViewSet, basename="agency")
router.register("users", UserViewSet, basename="user")
urlpatterns = [
    path("auth/token/", TokenObtainPairView.as_view(), name="token"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="refresh"),
    path("auth/me/", MeView.as_view(), name="me"),
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("", include(router.urls)),
]

