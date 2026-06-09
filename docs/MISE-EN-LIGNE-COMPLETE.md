# Mise en ligne complète — KonaData

Guide pas à pas : **GitHub → Vercel → Supabase → Resend → domaine konadatagn.com**

Durée estimée : **1 à 2 h** (DNS domaine : jusqu’à 48 h, souvent < 1 h).

---

## Vue d’ensemble

```
[Votre PC]  git push  →  [GitHub]  auto  →  [Vercel]  →  https://konadatagn.com
                                              ↓
                                         [Supabase]  (déjà en cloud)
                                              ↓
                                         [Resend]    (emails transactionnels)
```

**Deux phases recommandées :**

| Phase | Objectif | URL emails |
|-------|----------|------------|
| **A** | En ligne rapidement | `onboarding@resend.dev` (test) |
| **B** | Production pro | `noreply@konadatagn.com` |

---

## ÉTAPE 1 — GitHub (sauvegarde + déclencheur Vercel)

### 1.1 Connexion GitHub CLI

PowerShell :

```powershell
cd C:\Users\Administrator\Projects\guinea-pwa
& "C:\Program Files\GitHub CLI\gh.exe" auth login
```

Choisir : **GitHub.com** → **HTTPS** → **Login with a web browser**.

### 1.2 Créer le dépôt et pousser

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" repo create guinea-pwa --private --source=. --remote=origin --push
```

✅ **Vérification :** ouvrir `https://github.com/VOTRE-COMPTE/guinea-pwa` — les fichiers doivent être visibles.

---

## ÉTAPE 2 — Vercel (hébergement 24h/24)

### 2.1 Importer le projet

1. https://vercel.com → se connecter (compte GitHub recommandé)
2. **Add New… → Project**
3. Importer **guinea-pwa**
4. Framework : **Next.js** (auto)
5. **Ne pas cliquer Deploy** tout de suite

### 2.2 Variables d’environnement (Production)

**Settings → Environment Variables** (ou à l’import, section Environment Variables).

Copier les valeurs depuis votre fichier local `.env.local` (ne jamais les coller dans GitHub).

#### Obligatoires pour démarrer

| Variable | Exemple / format | Où la trouver |
|----------|------------------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ…` | Supabase → Settings → API → anon |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ…` | Supabase → Settings → API → service_role (**secret**) |
| `NEXT_PUBLIC_APP_URL` | Phase A : `https://guinea-pwa-xxx.vercel.app` puis Phase B : `https://konadatagn.com` | Vercel après 1er deploy |
| `OPENAI_API_KEY` | `sk-…` | platform.openai.com |
| `CRON_SECRET` | Chaîne aléatoire longue (ex. `openssl rand -hex 32`) | Vous la créez |

Générer un `CRON_SECRET` sous PowerShell :

```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

#### Resend (emails)

| Variable | Phase A (test) | Phase B (prod) |
|----------|----------------|----------------|
| `RESEND_API_KEY` | `re_…` depuis resend.com → API Keys | idem |
| `RESEND_FROM_EMAIL` | `KonaData <onboarding@resend.dev>` | `KonaData <noreply@konadatagn.com>` |
| `KONA_CONTACT_INBOX` | `contact@konadatagn.com` (ou votre Gmail pour tests) | `contact@konadatagn.com` |

#### Recommandées (selon fonctionnalités activées)

| Variable | Usage |
|----------|--------|
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM` | SMS OTP / bulletins |
| `ORANGE_MONEY_WEBHOOK_SECRET` | Paiements Orange Money |
| `RESEND_REPLY_TO` | Optionnel si différent de `KONA_CONTACT_INBOX` |

Pour chaque variable : cocher **Production** (et **Preview** si vous voulez les mêmes valeurs sur les URLs de test Vercel).

### 2.3 Premier déploiement

1. **Deploy**
2. Attendre 2–5 min
3. Ouvrir l’URL fournie : `https://guinea-pwa-xxxxx.vercel.app`

✅ **Vérification :** la page d’accueil KonaData s’affiche, `/login` fonctionne.

### 2.4 Mettre à jour `NEXT_PUBLIC_APP_URL`

Après le 1er deploy :

1. Vercel → Project → **Settings → Environment Variables**
2. Modifier `NEXT_PUBLIC_APP_URL` → URL Vercel exacte (puis `https://konadatagn.com` à l’étape 5)
3. **Deployments → … → Redeploy** (obligatoire après changement d’env)

---

## ÉTAPE 3 — Supabase (auth en production)

Projet existant : `wrwhoqtxttthmqfocmab` (d’après `.env.example`).

### 3.1 URLs d’authentification

Supabase Dashboard → **Authentication → URL Configuration** :

| Champ | Valeur |
|-------|--------|
| **Site URL** | `https://konadatagn.com` (ou URL Vercel en phase A) |
| **Redirect URLs** | Ajouter : |
| | `https://konadatagn.com/**` |
| | `https://*.vercel.app/**` |
| | `http://localhost:3000/**` (dev local) |

### 3.2 Migrations base de données

Si pas déjà fait en production :

```powershell
cd C:\Users\Administrator\Projects\guinea-pwa
# .env.local doit contenir SUPABASE_DB_PASSWORD ou DATABASE_URL
npm run deploy:schema
```

Établissements : migrations **088 → 091** obligatoires.

✅ **Vérification :** connexion avec `demo.ecole@konadata.demo` sur l’URL Vercel (après `npm run seed:demo` si comptes absents en prod).

---

## ÉTAPE 4 — Resend (emails transactionnels)

Resend envoie : formulaire contact, codes d’accès, rappels facturation, notifications inscription, etc.

### 4.1 Créer le compte et la clé API

1. https://resend.com → **Sign up**
2. **API Keys → Create API Key** → nom `konadata-production`
3. Copier la clé `re_…` → Vercel → `RESEND_API_KEY`
4. Redeploy Vercel

### 4.2 Phase A — Mode test (immédiat, sans domaine)

Dans Vercel :

```
RESEND_FROM_EMAIL=KonaData <onboarding@resend.dev>
KONA_CONTACT_INBOX=votre-email@exemple.com
```

**Limite Resend en mode test :** les emails partent **uniquement vers l’adresse email de votre compte Resend** (pas vers les clients réels).

✅ **Test :** formulaire contact sur le site → email reçu sur votre boîte Resend.

### 4.3 Phase B — Domaine vérifié (production)

Quand `konadatagn.com` est acheté :

1. Resend → **Domains → Add Domain** → `konadatagn.com`
2. Resend affiche des **enregistrements DNS** (DKIM, SPF, parfois MX)
3. Les ajouter chez votre **registrar** (OVH, Cloudflare, Namecheap…) **ou** dans Vercel DNS si le domaine y est géré
4. Attendre statut **Verified** dans Resend (5 min – 48 h)
5. Mettre à jour Vercel :

```
RESEND_FROM_EMAIL=KonaData <noreply@konadatagn.com>
KONA_CONTACT_INBOX=contact@konadatagn.com
```

6. **Redeploy** Vercel

✅ **Test prod :** envoyer un email à une adresse externe (Gmail…) via formulaire contact.

### 4.4 DNS Resend — exemple d’enregistrements

(Resend affiche les valeurs exactes — ne pas inventer.)

| Type | Nom | Valeur |
|------|-----|--------|
| TXT | `@` ou `send` | SPF (fourni par Resend) |
| CNAME | `resend._domainkey` | DKIM (fourni par Resend) |

Ces enregistrements sont **en plus** de ceux de Vercel pour le site web.

---

## ÉTAPE 5 — Nom de domaine konadatagn.com

### 5.1 Acheter le domaine

Registrars courants : OVH, Gandi, Cloudflare Registrar, Namecheap.

### 5.2 Pointer vers Vercel

**Option recommandée — DNS chez Vercel :**

1. Vercel → Project → **Settings → Domains**
2. Ajouter `konadatagn.com` et `www.konadatagn.com`
3. Vercel indique les nameservers (ex. `ns1.vercel-dns.com`)
4. Chez le registrar : remplacer les nameservers par ceux de Vercel

**Option alternative — enregistrements chez le registrar :**

| Type | Nom | Valeur |
|------|-----|--------|
| A | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |

### 5.3 Finaliser l’app

1. Vercel → `NEXT_PUBLIC_APP_URL` = `https://konadatagn.com`
2. Supabase → Site URL = `https://konadatagn.com`
3. Redeploy Vercel
4. Vérifier Resend (étape 4.3) si pas encore fait

✅ **Vérification :** `https://konadatagn.com` ouvre KonaData avec cadenas HTTPS.

---

## ÉTAPE 6 — Flux de mise à jour (après lancement)

```powershell
cd C:\Users\Administrator\Projects\guinea-pwa
# … modifications …
.\scripts\git-push.ps1 -Message "Description du changement"
```

→ GitHub sauvegarde → Vercel redéploie automatiquement (~2–5 min).

Si migration SQL nouvelle :

```powershell
npm run deploy:schema
```

---

## Checklist finale

| # | Item | OK |
|---|------|:--:|
| 1 | Code sur GitHub (privé) | ☐ |
| 2 | Vercel connecté au repo | ☐ |
| 3 | Variables env Production configurées | ☐ |
| 4 | Build Vercel vert | ☐ |
| 5 | Login Supabase sur URL prod | ☐ |
| 6 | Migrations 088–091 appliquées | ☐ |
| 7 | `RESEND_API_KEY` + test email | ☐ |
| 8 | Domaine konadatagn.com → Vercel | ☐ |
| 9 | Domaine konadatagn.com → Resend (Verified) | ☐ |
| 10 | `RESEND_FROM_EMAIL` = noreply@konadatagn.com | ☐ |

---

## Dépannage rapide

| Symptôme | Cause | Action |
|----------|-------|--------|
| Build Vercel échoue | Variable manquante | Lire les logs Build → ajouter l’env |
| Login boucle / erreur | Redirect URL Supabase | Ajouter l’URL Vercel/konadatagn dans Supabase Auth |
| Email non reçu (test) | Mode `resend.dev` | Destinataire = email du compte Resend uniquement |
| Email 403 Resend | Domaine non vérifié | Finir étape 4.3 |
| Page blanche / 500 | `SUPABASE_SERVICE_ROLE_KEY` | Vérifier sur Vercel (pas d’espace en trop) |
| Crons ne tournent pas | `CRON_SECRET` absent | Ajouter + plan Vercel compatible |

---

## Support

- Guide Git/Vercel : [DEPLOIEMENT-GITHUB-VERCEL.md](./DEPLOIEMENT-GITHUB-VERCEL.md)
- Resend docs : https://resend.com/docs
- Vercel + Next.js : https://vercel.com/docs
