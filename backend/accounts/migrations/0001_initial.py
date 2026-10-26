import uuid
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone

class Migration(migrations.Migration):
    initial = True
    dependencies = [("auth", "0012_alter_user_first_name_max_length")]
    operations = [
        migrations.CreateModel(name="Company", fields=[
            ("created_at", models.DateTimeField(auto_now_add=True)), ("updated_at", models.DateTimeField(auto_now=True)),
            ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
            ("name", models.CharField(max_length=180)), ("legal_name", models.CharField(blank=True, max_length=220)),
            ("ice", models.CharField(blank=True, max_length=15)), ("tax_id", models.CharField(blank=True, max_length=30)),
            ("trade_register", models.CharField(blank=True, max_length=40)), ("active", models.BooleanField(default=True)),
        ]),
        migrations.CreateModel(name="Agency", fields=[
            ("created_at", models.DateTimeField(auto_now_add=True)), ("updated_at", models.DateTimeField(auto_now=True)),
            ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
            ("name", models.CharField(max_length=150)), ("code", models.CharField(max_length=20)),
            ("city", models.CharField(blank=True, max_length=100)), ("active", models.BooleanField(default=True)),
            ("company", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="agencies", to="accounts.company")),
        ]),
        migrations.CreateModel(name="User", fields=[
            ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
            ("password", models.CharField(max_length=128, verbose_name="password")), ("last_login", models.DateTimeField(blank=True, null=True, verbose_name="last login")),
            ("is_superuser", models.BooleanField(default=False, help_text="Designates that this user has all permissions without explicitly assigning them.", verbose_name="superuser status")),
            ("username", models.CharField(error_messages={"unique": "A user with that username already exists."}, help_text="Required. 150 characters or fewer.", max_length=150, unique=True, verbose_name="username")),
            ("first_name", models.CharField(blank=True, max_length=150, verbose_name="first name")), ("last_name", models.CharField(blank=True, max_length=150, verbose_name="last name")),
            ("email", models.EmailField(blank=True, max_length=254, verbose_name="email address")),
            ("is_staff", models.BooleanField(default=False, help_text="Designates whether the user can log into this admin site.", verbose_name="staff status")),
            ("is_active", models.BooleanField(default=True, help_text="Designates whether this user should be treated as active.", verbose_name="active")),
            ("date_joined", models.DateTimeField(default=django.utils.timezone.now, verbose_name="date joined")),
            ("role", models.CharField(choices=[("SUPERADMIN","Superadministrateur"),("COMPANY_ADMIN","Administrateur société"),("DIRECTOR","Directeur"),("OPERATIONS","Responsable exploitation"),("OBC","Responsable OBC"),("FLEET","Responsable flotte"),("MAINTENANCE","Responsable maintenance"),("FUEL","Responsable carburant"),("HR","Responsable RH"),("ACCOUNTANT","Comptable"),("SALES","Commercial"),("DRIVER","Conducteur")], default="DRIVER", max_length=24)),
            ("phone", models.CharField(blank=True, max_length=30)), ("preferred_language", models.CharField(choices=[("fr","Français"),("ar","العربية")], default="fr", max_length=5)),
            ("agency", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="users", to="accounts.agency")),
            ("company", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="users", to="accounts.company")),
            ("groups", models.ManyToManyField(blank=True, help_text="The groups this user belongs to.", related_name="user_set", related_query_name="user", to="auth.group", verbose_name="groups")),
            ("user_permissions", models.ManyToManyField(blank=True, help_text="Specific permissions for this user.", related_name="user_set", related_query_name="user", to="auth.permission", verbose_name="user permissions")),
        ], options={"verbose_name":"user","verbose_name_plural":"users","abstract":False}),
        migrations.AddConstraint(model_name="agency", constraint=models.UniqueConstraint(fields=("company","code"), name="unique_agency_code_per_company")),
    ]

