from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):
    initial = True
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [migrations.CreateModel(name="AuditLog", fields=[
        ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
        ("action", models.CharField(max_length=20)), ("resource", models.CharField(max_length=120)),
        ("resource_id", models.CharField(blank=True, max_length=64)), ("company_id", models.UUIDField(blank=True, null=True)),
        ("metadata", models.JSONField(blank=True, default=dict)), ("ip_address", models.GenericIPAddressField(blank=True, null=True)),
        ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
        ("actor", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
    ], options={"ordering": ["-created_at"]})]

