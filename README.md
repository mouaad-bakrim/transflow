# FLEETTRANSPORT PRO — Phase 1

Socle ERP/TMS multi-sociétés : authentification JWT, utilisateurs et rôles, agences,
isolation des données, journal d'audit, API REST/OpenAPI et dashboard Next.js connecté.

La tranche Flotte ajoute le parc de véhicules, les types de documents, le suivi des
documents et échéances, les alertes calculées côté serveur et le contrôle de conformité
d'un véhicule à une date donnée.

## Lancement Docker

```bash
cp .env.example .env
docker compose up --build
```

- Application : http://localhost:3000
- API : http://localhost:8000/api/v1/
- Swagger : http://localhost:8000/api/docs/

Créer le premier compte :

```bash
docker compose exec backend python manage.py createsuperuser
```

Tests : `docker compose run --rm backend pytest` puis `docker compose run --rm frontend npm test`.

## API Flotte

- `GET/POST /api/v1/vehicles/`
- `GET/PATCH /api/v1/vehicles/{id}/`
- `GET /api/v1/vehicles/{id}/compliance/?date=YYYY-MM-DD`
- `GET/POST /api/v1/vehicle-document-types/`
- `GET/POST /api/v1/vehicle-documents/`
- `GET/PATCH /api/v1/vehicle-documents/{id}/`
- `GET /api/v1/vehicle-documents/alerts/`

Après mise à jour d'une installation existante :

```bash
docker compose run --rm backend python manage.py migrate
```

## Sécurité du périmètre

Un superadministrateur peut accéder à toutes les sociétés. Tout autre utilisateur est
obligatoirement rattaché à une société ; les querysets et créations sont filtrés côté
backend. Les endpoints d'administration exigent un rôle d'administration. Les actions
sensibles sont écrites dans le journal d'audit.
