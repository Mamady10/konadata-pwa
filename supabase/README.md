# KonaData — Supabase Setup

## 1. Créer le projet Supabase

1. Allez sur [supabase.com](https://supabase.com) → **New Project**
2. Notez l'**URL** et la **anon key** (Settings → API)
3. Copiez `.env.example` vers `.env.local` et remplissez les valeurs

## 2. Exécuter les migrations

Dans **SQL Editor** de Supabase, exécutez les fichiers **dans l'ordre** :

```
supabase/migrations/001_core_schema.sql
supabase/migrations/002_rls_policies.sql
supabase/migrations/003_documents_module.sql
supabase/migrations/004_school_module.sql
supabase/migrations/005_ngo_module.sql
supabase/migrations/006_btp_module.sql
supabase/migrations/007_pme_module.sql
supabase/migrations/008_konascore_and_storage.sql
supabase/migrations/009_seed_data.sql
supabase/migrations/010_auth_setup.sql
supabase/migrations/011_signup_policies.sql
```

## 3. Créer les utilisateurs démo

Dans **Authentication → Users → Add user** :

| Email | Mot de passe | Organisation |
|-------|-------------|--------------|
| director@isc.gn | Demo@Kona2026 | ISC (university) |
| director@fdg.gn | Demo@Kona2026 | FDG (ngo) |
| director@guineebtp.gn | Demo@Kona2026 | Guinée BTP |
| owner@mamou.gn | Demo@Kona2026 | Mamou Commerce |
| admin@konadata.gn | Demo@Kona2026 | Super Admin |

Puis exécutez dans SQL Editor :

```sql
SELECT setup_demo_user('director@isc.gn', '11111111-1111-1111-1111-111111111101', 'director', 'Amadou Diallo');
SELECT setup_demo_user('director@fdg.gn', '11111111-1111-1111-1111-111111111102', 'country_director', 'Fatoumata Camara');
SELECT setup_demo_user('director@guineebtp.gn', '11111111-1111-1111-1111-111111111103', 'project_director', 'Ibrahima Bah');
SELECT setup_demo_user('owner@mamou.gn', '11111111-1111-1111-1111-111111111104', 'owner', 'Mariama Sow');
SELECT setup_demo_user('admin@konadata.gn', NULL, 'super_admin', 'Admin KonaData');
```

## 4. Architecture multi-tenant

- Chaque table métier contient `organization_id`
- **RLS** isole les données par organisation
- `super_admin` voit toutes les organisations
- Fonctions helper : `get_user_organization_id()`, `is_super_admin()`

## 5. Tables créées

| Module | Tables |
|--------|--------|
| Core | organizations, profiles, audit_logs, notifications |
| Documents | documents, document_extractions |
| École | school_classes, school_subjects, school_teachers, school_students, school_enrollments, school_grades, school_payments, school_schedules |
| ONG | ngo_programs, ngo_projects, ngo_activities, ngo_indicators, ngo_surveys, ngo_survey_responses, ngo_beneficiaries |
| BTP | btp_sites, btp_contracts, btp_personnel, btp_equipment, btp_stock, btp_delivery_notes, btp_fuel_logs, btp_daily_progress |
| PME | pme_customers, pme_suppliers, pme_products, pme_sales, pme_purchases, pme_expenses, pme_transactions |
| KonaScore | konascore_snapshots + fonction `calculate_konascore()` |

## 6. Lancer l'app

```bash
npm run dev
```

Connexion : http://localhost:3000/login
