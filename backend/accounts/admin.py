from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Agency, Company, User
admin.site.register(Company)
admin.site.register(Agency)
@admin.register(User)
class FleetUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (("FLEETTRANSPORT", {"fields": ("company", "agency", "role", "phone", "preferred_language")}),)

