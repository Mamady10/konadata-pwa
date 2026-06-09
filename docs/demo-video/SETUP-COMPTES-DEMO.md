# Comptes démo + captures vidéo

## 1. Prérequis

Dans `.env.local`, renseignez la clé **service_role** Supabase :

```
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # Dashboard → Settings → API → service_role
```

Optionnel : exécuter la migration `069_demo_video_orgs.sql` dans le SQL Editor Supabase (active les orgs seed).

## 2. Lancer l'app

```powershell
cd C:\Users\Administrator\Projects\guinea-pwa
npm run dev
```

Notez le port (`3000` ou `3001`).

## 3. Créer les comptes + captures

```powershell
$env:DEMO_BASE_URL="http://localhost:3001"
npm run capture:demo:all
```

Ou en deux étapes :

```powershell
npm run seed:demo      # crée 4 comptes dans Supabase Auth
npm run capture:demo   # ~30 captures PNG
```

## 4. Comptes créés

| Type | Email | Mot de passe |
|------|-------|--------------|
| École | `demo.ecole@konadata.demo` | `DemoKona2026!` |
| ONG | `demo.ong@konadata.demo` | `DemoKona2026!` |
| BTP | `demo.btp@konadata.demo` | `DemoKona2026!` |
| PME | `demo.pme@konadata.demo` | `DemoKona2026!` |

Fichier généré (gitignored) : `docs/demo-video/demo-accounts.json`

## 5. Captures produites

Dossier : `docs/demo-video/captures/`

- `01`–`08` : pages publiques
- `09`–`15` : école (+ Data Factory)
- `20`–`26` : ONG (+ analytiques sondage si données seed)
- `30`–`34` : BTP
- `40`–`43` : PME

## 6. Générer la vidéo MP4 (script + captures)

```powershell
npm run build:demo-video          # ~3 min 30 — complète
npm run build:demo-video:teaser   # ~1 min — version courte
```

Fichiers produits dans `docs/demo-video/output/` :

| Fichier | Description |
|---------|-------------|
| `konadata-demo-complete.mp4` | Vidéo complète avec voix + sous-titres |
| `konadata-demo-complete.srt` | Sous-titres (import CapCut / YouTube) |
| `konadata-demo-teaser-60s.mp4` | Teaser |
| `konadata-demo-teaser.srt` | Sous-titres teaser |

La voix utilise **Microsoft Edge TTS** (`fr-FR-DeniseNeural`). Images **fixes** (sans zoom) + fondu entre scènes.

Musique de fond : ambiance générée, ou déposez `docs/demo-video/assets/background-music.mp3`.

Variables optionnelles :
```
DEMO_TTS_VOICE=fr-FR-HenriNeural   # voix masculine
DEMO_MUSIC_VOLUME=0.30            # musique plus forte (défaut 0.24)
```

## 7. Dépannage

| Erreur | Solution |
|--------|----------|
| `SERVICE_ROLE_KEY requis` | Remplir la clé dans `.env.local` |
| `Organisation absente` | Exécuter migrations `010`, `011`, `037` |
| `FAIL login` | Relancer `npm run seed:demo` |
| Navigateur introuvable | Chrome ou Edge installé sur Windows |
