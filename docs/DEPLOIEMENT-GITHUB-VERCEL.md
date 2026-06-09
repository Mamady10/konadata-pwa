# Déploiement GitHub + Vercel — KonaData

Ce guide met en place **sauvegarde Git**, **historique des versions** et **déploiement automatique** à chaque `git push`.

---

## Prérequis (une seule fois)

| Outil | Rôle |
|-------|------|
| [Git](https://git-scm.com/) | Versionner le code |
| Compte [GitHub](https://github.com) | Héberger le dépôt |
| Compte [Vercel](https://vercel.com) | Héberger l’app (konadatagn.com) |

Git est installé sur cette machine. Redémarrez le terminal après installation si `git` n’est pas reconnu.

---

## Étape 1 — Dépôt Git local (déjà préparé)

Le projet est initialisé avec un premier commit. Vérifier :

```powershell
cd C:\Users\Administrator\Projects\guinea-pwa
git status
git log --oneline -3
```

**Jamais commité (protégé par `.gitignore`) :**
- `.env.local` — clés secrètes
- `node_modules/`
- `docs/demo-video/demo-accounts.json` — mots de passe démo

---

## Étape 2 — Créer le dépôt GitHub

### Option A — Site GitHub (recommandé)

1. Aller sur https://github.com/new
2. Nom du dépôt : `guinea-pwa` ou `konadata-pwa`
3. **Private** (recommandé — contient la logique métier)
4. Ne pas cocher « Add README » (le projet existe déjà)
5. Créer le dépôt
6. Copier l’URL HTTPS, ex. `https://github.com/VOTRE-COMPTE/guinea-pwa.git`

### Option B — GitHub CLI

```powershell
winget install GitHub.cli
gh auth login
cd C:\Users\Administrator\Projects\guinea-pwa
gh repo create guinea-pwa --private --source=. --remote=origin --push
```

---

## Étape 3 — Lier et pousser le code

Remplacez `VOTRE-COMPTE` par votre identifiant GitHub :

```powershell
cd C:\Users\Administrator\Projects\guinea-pwa
git remote add origin https://github.com/VOTRE-COMPTE/guinea-pwa.git
git branch -M main
git push -u origin main
```

À la première connexion, GitHub demandera une authentification (navigateur ou **Personal Access Token**).

---

## Étape 4 — Connecter Vercel

1. Aller sur https://vercel.com/new
2. **Import Git Repository** → choisir `guinea-pwa`
3. Framework : **Next.js** (détecté automatiquement)
4. Root Directory : `./` (racine)
5. **Ne pas déployer tout de suite** — configurer les variables d’environnement d’abord

### Variables d’environnement (Production)

Copier depuis votre `.env.local` (Dashboard Vercel → Settings → Environment Variables) :

| Variable | Obligatoire | Notes |
|----------|:-----------:|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | URL projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | Clé anon |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | Serveur uniquement — **jamais** côté client |
| `NEXT_PUBLIC_APP_URL` | ✓ | `https://konadatagn.com` |
| `OPENAI_API_KEY` | ✓ | KonaAI |
| `CRON_SECRET` | ✓ | Crons Vercel (`vercel.json`) |
| `RESEND_API_KEY` | selon usage | Emails |
| `TWILIO_*` | selon usage | SMS OTP |
| `ORANGE_MONEY_WEBHOOK_SECRET` | selon usage | Paiements |

6. Cliquer **Deploy**

### Domaine personnalisé

Vercel → Project → **Settings → Domains** → ajouter `konadatagn.com` et suivre les instructions DNS.

---

## Étape 5 — Déploiement automatique (le flux quotidien)

Après configuration, **chaque push sur `main` redéploie l’app** :

```powershell
cd C:\Users\Administrator\Projects\guinea-pwa
# … modifications (Cursor, VS Code, etc.) …
git add .
git commit -m "Description courte du changement"
git push
```

Vercel build automatiquement (~2–5 min). Suivi sur https://vercel.com/dashboard.

### Branches (optionnel)

- `main` → production (konadatagn.com)
- `develop` → préproduction (URL preview Vercel)

---

## Migrations Supabase après un déploiement

Le code se déploie via Git/Vercel ; la **base de données** se met à jour séparément :

```powershell
# Appliquer les nouvelles migrations SQL
npm run deploy:schema
# ou via le dashboard Supabase → SQL
```

Ordre établissements : migrations **088 → 091**.

---

## Script rapide (Windows)

```powershell
.\scripts\git-push.ps1 -Message "Correction bulletins Terminale"
```

---

## Dépannage

| Problème | Solution |
|----------|----------|
| `git` non reconnu | Redémarrer le terminal ou réinstaller Git |
| Push refusé (auth) | Token GitHub : Settings → Developer settings → PAT |
| Build Vercel échoue | Vérifier les variables d’env manquantes dans les logs |
| Site OK mais données vides | Migrations Supabase non appliquées |
| Cron ne tourne pas | `CRON_SECRET` défini + plan Vercel compatible crons |

---

## Sécurité

- Ne jamais committer `.env.local`
- `SUPABASE_SERVICE_ROLE_KEY` uniquement sur Vercel (server), pas dans le navigateur
- Dépôt GitHub en **privé** recommandé
