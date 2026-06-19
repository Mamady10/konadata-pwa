# Formation KonaData — Secteur BTP

Documentation et vidéos de formation pour les entreprises BTP (direction + chefs de chantier).

## Livrables

| Fichier | Description |
|---------|-------------|
| [GUIDE-UTILISATEUR-KONADATA-BTP.md](GUIDE-UTILISATEUR-KONADATA-BTP.md) | Guide complet — tous écrans, boutons, parcours |
| `output-btp/GUIDE-UTILISATEUR-KONADATA-BTP.pdf` | Export PDF (après génération) |
| `output-btp/GUIDE-UTILISATEUR-KONADATA-BTP.pptx` | Support présentation formateurs |
| `training/output/konadata-formation-btp-direction.mp4` | Vidéo formation direction |
| `training/output/konadata-formation-btp-chef.mp4` | Vidéo formation chef de chantier |
| [../demo-video/SCRIPT-DEMO-PILOTE-BTP-15MIN.md](../demo-video/SCRIPT-DEMO-PILOTE-BTP-15MIN.md) | Script démo live 15 min |

## Comptes démo

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Direction BTP | `demo.btp@konadata.demo` | `DemoKona2026!` |
| Chef de chantier | `demo.chef.btp@konadata.demo` | `DemoKona2026!` |

## Générer les documents

```powershell
cd C:\Users\Administrator\Projects\guinea-pwa

# 1. Captures écran (app en cours : npm run dev)
$env:DEMO_BASE_URL="http://localhost:3000"
npm run capture:demo:all

# 2. PDF + PPTX
npm run build:formation-docs:btp

# 3. Vidéos formation (voix FR + musique)
npm run build:training-videos:btp
```

Une seule vidéo :

```powershell
npm run build:training-video:btp -- direction
npm run build:training-video:btp -- chef
```

## Modèles papier chantier

Modèles HTML imprimables : [../btp/modeles/](../btp/modeles/)

- Fiche journalière terrain
- Bon de livraison
- Rapport hebdomadaire / mensuel
- Rapport carburant, HSE

## Parallèle secteur École

| École | BTP |
|-------|-----|
| `GUIDE-UTILISATEUR-KONADATA.md` | `GUIDE-UTILISATEUR-KONADATA-BTP.md` |
| `npm run build:formation-docs` | `npm run build:formation-docs:btp` |
| `npm run build:training-videos` | `npm run build:training-videos:btp` |
| 7 rôles (direction, scolarité…) | 2 rôles (direction, chef) |
