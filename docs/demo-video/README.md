# Démonstration KonaData

## Vidéos prêtes

| Fichier | Durée | Usage |
|---------|-------|-------|
| [output/konadata-demo-complete.mp4](output/konadata-demo-complete.mp4) | ~2 min 46 | Site web, présentations, bailleurs |
| [output/konadata-demo-teaser-60s.mp4](output/konadata-demo-teaser-60s.mp4) | ~1 min 33 | WhatsApp, LinkedIn, réseaux |
| [output/konadata-formation-ecole.mp4](output/konadata-formation-ecole.mp4) | ~4 min 34 | **Formation établissement** (voix FR + musique) |
| [output/konadata-formation-ecole-teaser.mp4](output/konadata-formation-ecole-teaser.mp4) | ~2 min 36 | Teaser formation / réseaux |
| [output/konadata-formation-ecole.srt](output/konadata-formation-ecole.srt) | — | Sous-titres formation |
| [output/konadata-demo-complete.srt](output/konadata-demo-complete.srt) | — | Sous-titres version complète |

**Contenu :** accueil → école (import IA, bulletins) → ONG (sondages, QR, analytiques) → voix française + musique de fond.

## Démo live pilote école (15 min)

Script pas à pas pour directeurs / scolarité / comptables : **[SCRIPT-DEMO-PILOTE-ECOLE-15MIN.md](SCRIPT-DEMO-PILOTE-ECOLE-15MIN.md)**

## Démo live pilote BTP (15 min)

Script direction + chef de chantier : **[SCRIPT-DEMO-PILOTE-BTP-15MIN.md](SCRIPT-DEMO-PILOTE-BTP-15MIN.md)**

## Formation BTP

Guide, PDF, PPTX et vidéos : **[../formation/README-BTP.md](../formation/README-BTP.md)**

## Démo live (comptes test)

| Secteur | Email | Mot de passe |
|---------|-------|--------------|
| École | `demo.ecole@konadata.demo` | `DemoKona2026!` |
| ONG | `demo.ong@konadata.demo` | `DemoKona2026!` |
| BTP | `demo.btp@konadata.demo` | `DemoKona2026!` |
| BTP chef | `demo.chef.btp@konadata.demo` | `DemoKona2026!` |
| PME | `demo.pme@konadata.demo` | `DemoKona2026!` |

Connexion : onglet **Email** sur `/login`.

## Régénérer

```powershell
cd C:\Users\Administrator\Projects\guinea-pwa
npm run dev
# autre terminal :
$env:DEMO_BASE_URL="http://localhost:3001"
npm run capture:demo:all
$env:DEMO_MUSIC_VOLUME="0.28"
npm run build:demo-video
npm run build:demo-video:teaser
npm run build:demo-video:school
npm run build:demo-video:school-teaser
```

## Guide formation (PDF / PPTX)

| Fichier | Usage |
|---------|-------|
| [../formation/output/GUIDE-UTILISATEUR-KONADATA.pdf](../formation/output/GUIDE-UTILISATEUR-KONADATA.pdf) | Guide complet tous rôles — à distribuer |
| [../formation/output/GUIDE-UTILISATEUR-KONADATA.pptx](../formation/output/GUIDE-UTILISATEUR-KONADATA.pptx) | Support présentation formateurs |

```powershell
npm run build:formation-docs
```

Voir [SETUP-COMPTES-DEMO.md](SETUP-COMPTES-DEMO.md) et [SCRIPT-DEMO-KONADATA.md](SCRIPT-DEMO-KONADATA.md).
