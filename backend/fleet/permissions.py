from rest_framework.permissions import BasePermission, SAFE_METHODS


class FleetPermission(BasePermission):
    read_roles = {"SUPERADMIN", "COMPANY_ADMIN", "DIRECTOR", "OPERATIONS", "FLEET", "MAINTENANCE"}
    write_roles = {"SUPERADMIN", "COMPANY_ADMIN", "FLEET"}

    def has_permission(self, request, view):
        roles = self.read_roles if request.method in SAFE_METHODS else self.write_roles
        return bool(request.user.is_authenticated and request.user.role in roles)
