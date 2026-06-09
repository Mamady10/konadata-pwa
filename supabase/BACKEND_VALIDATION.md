# Validation backend KonaData

Exécuter :

```bash
cd C:\Users\Administrator\Projects\guinea-pwa
npm run validate:backend
```

## Ce qui est testé

| # | Test | Attendu |
|---|------|---------|
| 1 | Tables schéma v2 | Toutes présentes |
| 2 | RLS anon | Aucune donnée métier visible sans login |
| 3 | Auth directeur ISC | `director@isc.gn` → profil `org_admin` |
| 4 | Données seed ISC | ≥2 élèves, 2 classes, 2 matières, 1 enseignant |
| 5 | Isolation tenant | Directeur ISC ne voit pas ONG/BTP |
| 6 | Écriture | Directeur peut créer/supprimer une classe |

## Prérequis

- Schéma `full_schema.sql` appliqué
- Utilisateur `director@isc.gn` / `Demo@Kona2026` dans Auth
- `setup_demo_user(...)` exécuté

## Rôles v2 (RBAC)

| Rôle DB | Usage Phase 1 |
|---------|---------------|
| `platform_admin` | Admin KonaData (toutes orgs) |
| `org_admin` | Directeur général |
| `deputy_director` | Directeur adjoint |
| `registrar` | Scolarité |
| `teacher` | Enseignant |
| `student` | Élève inscrit |
| `candidate` | Candidat |
| `accountant` | Comptable |
| `ngo_staff` | Phase 2 ONG |
| `btp_staff` | Phase 3 BTP |

## Types organisation

| type | Module |
|------|--------|
| `school` | Établissements |
| `ngo` | ONG |
| `btp` | BTP / Industries |

## Politiques RLS (résumé)

- Toutes les tables : `ENABLE ROW LEVEL SECURITY`
- Politiques : rôle `authenticated` uniquement (pas de `anon`)
- Filtre principal : `organization_id = get_user_organization_id()`
- Module école : `is_school_org()` + rôle (`is_school_staff`, `can_manage_finance`, etc.)
- Module ONG : `is_ngo_org()` + `is_ngo_staff_role()`
- Module BTP : `is_btp_org()` + `is_btp_staff_role()`

## Vérification manuelle SQL Editor

```sql
-- Profil directeur
SELECT p.full_name, p.role, o.name, o.type
FROM profiles p
JOIN organizations o ON o.id = p.organization_id
WHERE p.email = 'director@isc.gn';

-- Données ISC
SELECT matricule, enrollment_status FROM school_students;
SELECT name FROM school_classes;
SELECT name FROM school_subjects;

-- Comptage tables
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
```
