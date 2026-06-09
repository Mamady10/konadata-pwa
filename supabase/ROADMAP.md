# Roadmap KonaData — Backend puis Frontend par secteur

## État actuel (validé par vous)

- ✅ Schéma Supabase v2 installé
- ✅ Connexion `director@isc.gn` fonctionnelle
- ⚠️ Écrans actuels = **données mock** (ex. page Rapports que vous voyez)

---

## Phase A — Validation backend (en cours)

**Objectif :** confirmer RLS, rôles et données ISC avant tout écran.

| Action | Commande / outil |
|--------|------------------|
| Validation automatique | `npm run validate:backend` |
| Doc détaillée | `supabase/BACKEND_VALIDATION.md` |

**Critères de succès :** 0 échec sur le script de validation.

---

## Phase B — Établissements scolaires (Phase 1 frontend)

**Objectif :** remplacer les mocks par Supabase pour le secteur `school`.

| Priorité | Route | Données Supabase |
|----------|-------|------------------|
| 1 | `/etablissement` | KPIs (élèves, paiements, classes) |
| 2 | `/etablissement/etudiants` | `school_students` + `core_persons` |
| 3 | `/etablissement/candidatures` | `school_enrollments` |
| 4 | `/etablissement/formations` | classes, matières, enseignants |
| 5 | `/etablissement/paiements` | `school_payments` |
| 6 | `/etablissement/resultats` | `school_grades` |
| 7 | `/etablissement/bulletins` | `school_report_cards` |
| 8 | `/data-factory` | `documents` + Storage |

**Aussi :**
- Redirection login → `/etablissement` si org type = `school`
- Aligner `types/database.ts` sur schéma v2 (`type`, `app_role`)
- Permissions UI par rôle (directeur / enseignant / comptable)

---

## Phase C — ONG (Phase 2)

Même méthode que Établissements :

1. `npm run validate:backend` avec utilisateur ONG (`director@fdg.gn`)
2. Routes `/ong/*` → tables `ngo_*`
3. Dashboard, projets, sondages, bénéficiaires, rapports

---

## Phase D — BTP / Industries (Phase 3)

1. Validation backend utilisateur BTP
2. Routes `/btp/*` → tables `btp_*`
3. Chantiers, stocks, carburant, bons de livraison, personnel

---

## Ordre strict

```
Backend validé → Établissements → ONG → BTP
```

Ne pas développer les écrans ONG/BTP tant que :
- le backend du secteur n'est pas validé
- le secteur précédent n'est pas connecté aux vraies données

---

## Comptes démo à créer (plus tard)

| Email | Organisation | Rôle |
|-------|--------------|------|
| director@isc.gn | ISC | org_admin ✅ |
| director@fdg.gn | FDG (ONG) | org_admin |
| director@guineebtp.gn | Guinée BTP | org_admin |

SQL après création Auth :

```sql
SELECT setup_demo_user('director@fdg.gn', '11111111-1111-1111-1111-111111111102', 'org_admin', 'Fatoumata Camara');
SELECT setup_demo_user('director@guineebtp.gn', '11111111-1111-1111-1111-111111111103', 'org_admin', 'Ibrahima Bah');
```
