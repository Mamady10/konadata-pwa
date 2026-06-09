# Déployer le schéma KonaData sur Supabase

## Méthode A — Automatique (RECOMMANDÉE, sans copier-coller)

### 1. Récupérer le mot de passe PostgreSQL

1. Ouvrez : https://supabase.com/dashboard/project/wrwhoqtxttthmqfocmab/settings/database
2. Section **Database password**
3. Si vous ne le connaissez pas → cliquez **Reset database password** et notez le nouveau mot de passe

### 2. Ajouter le mot de passe dans `.env.local`

Ouvrez `C:\Users\Administrator\Projects\guinea-pwa\.env.local` et ajoutez :

```
SUPABASE_DB_PASSWORD=collez_votre_mot_de_passe_ici
```

### 3. Lancer le déploiement

Dans un terminal :

```
cd C:\Users\Administrator\Projects\guinea-pwa
npm install
npm run deploy:schema
```

Le script se connecte directement à PostgreSQL et installe tout automatiquement.

---

## Méthode B — SQL Editor (manuel, étape par étape)

### Important

- Ne tapez **JAMAIS** le nom du fichier (`full_schema.sql`)
- Copiez le **contenu SQL** du fichier (Ctrl+A dans Cursor, puis Ctrl+C)

### Ordre d'exécution

| Étape | Fichier à ouvrir dans Cursor | Résultat attendu |
|-------|------------------------------|------------------|
| 0 | `supabase/sql-editor/ETAPE-0-TEST.sql` | Ligne `TEST OK` |
| 1 | `supabase/full_schema_reset.sql` | Message reset |
| 2 | `supabase/migrations/001_extensions_and_types.sql` | Success |
| 3 | `supabase/migrations/002_core_platform.sql` | Success |
| 4 | `supabase/migrations/003_rls_helpers.sql` | Success |
| 5 | `supabase/migrations/004_shared_entities.sql` | Success |
| 6 | `supabase/migrations/005_school_module.sql` | Success |
| 7 | `supabase/migrations/006_ngo_module.sql` | Success |
| 8 | `supabase/migrations/007_btp_module.sql` | Success |
| 9 | `supabase/migrations/008_konascore.sql` | Success |
| 10 | `supabase/migrations/009_rls_policies.sql` | Success |
| 11 | `supabase/migrations/010_storage_auth_seed.sql` | Tableau de vérification |

SQL Editor : https://supabase.com/dashboard/project/wrwhoqtxttthmqfocmab/sql/new

---

## Vérification

```
npm run test:supabase
```

Toutes les tables doivent être en ✅.
