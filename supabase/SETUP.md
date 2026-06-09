# Appliquer le schéma dans Supabase SQL Editor

## Pourquoi « ça ne donne rien » ?

Dans le SQL Editor Supabase, les commandes `CREATE TABLE`, `CREATE TYPE`, etc. **ne retournent aucune ligne**.  
Vous voyez seulement : **Success. No rows returned** — cela signifie que **ça a fonctionné**.

Le nouveau `full_schema.sql` se termine par des **SELECT de vérification** qui affichent un tableau avec les tables créées.

---

## Étapes (projet wrwhoqtxttthmqfocmab)

### 1. Ouvrir le SQL Editor

https://supabase.com/dashboard/project/wrwhoqtxttthmqfocmab/sql/new

### 2. Si une exécution précédente a échoué

Exécutez d'abord **`full_schema_reset.sql`** (supprime l'ancien schéma v1 ou partiel).

### 3. Exécuter le schéma complet

1. Ouvrez le fichier **`full_schema.sql`** dans votre éditeur (VS Code / Cursor)
2. **Ctrl+A** pour tout sélectionner
3. **Ctrl+C** pour copier
4. Collez dans le SQL Editor Supabase
5. Cliquez **Run**

### 4. Résultat attendu

En bas des résultats vous devez voir :

| message |
|---------|
| KonaData schema installé avec succès |

Puis un tableau avec `organizations`, `profiles`, `school_students`, etc. en status **OK**.

Et `total_tables` ≈ **35+**.

### 5. Vérifier depuis le terminal

```bash
cd C:\Users\Administrator\Projects\guinea-pwa
npm run test:supabase
```

---

## Fichiers

| Fichier | Usage |
|---------|-------|
| `full_schema_reset.sql` | Nettoyage avant réinstallation |
| `full_schema.sql` | Schéma complet v2 (copier-coller) |
| `migrations/001-010.sql` | Migrations individuelles (CLI) |

## Après installation

1. Créer les utilisateurs dans Authentication → Users
2. Exécuter : `SELECT setup_demo_user('director@isc.gn', '11111111-1111-1111-1111-111111111101', 'org_admin', 'Amadou Diallo');`
