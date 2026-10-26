from rest_framework.permissions import BasePermission

ADMIN_ROLES = {"SUPERADMIN", "COMPANY_ADMIN"}
class IsTenantAdmin(BasePermission):
    message = "Un rôle administrateur est requis."
    def has_permission(self, request, view):
        return bool(request.user.is_authenticated and request.user.role in ADMIN_ROLES)

def scoped_queryset(queryset, user, company_field="company"):
    if user.role == "SUPERADMIN":
        return queryset
    return queryset.filter(**{f"{company_field}_id": user.company_id})

