# Formations vidéo par profil utilisateur — KonaData École

Vidéos **pédagogiques** (pas marketing) : une formation par rôle, avec voix off pas-à-pas.

## Vidéos générées

| Fichier | Public | Durée approx. |
|---------|--------|---------------|
| `konadata-formation-direction.mp4` | Directeur · Directeur adjoint | ~5 min |
| `konadata-formation-scolarite.mp4` | Agent scolarité | ~4 min |
| `konadata-formation-comptable.mp4` | Comptable / trésorier | ~4 min |
| `konadata-formation-enseignant.mp4` | Enseignant | ~4 min |
| `konadata-formation-eleve.mp4` | Élève inscrit | ~3 min |
| `konadata-formation-candidat.mp4` | Candidat admission | ~3 min |
| `konadata-formation-parent.mp4` | Parent / tuteur (sans compte) | ~3 min |

Chaque vidéo a un fichier `.srt` (sous-titres) du même nom.

## Générer les vidéos

```powershell
cd C:\Users\Administrator\Projects\guinea-pwa

# 1. Serveur local
npm run dev

# 2. Captures écran (autre terminal)
$env:DEMO_BASE_URL="http://localhost:3000"
npm run capture:demo:all

# 3. Toutes les formations
npm run build:training-videos

# Ou une seule :
npm run build:training-video -- direction
npm run build:training-video -- parent
```

Variables optionnelles :

- `DEMO_TTS_VOICE=fr-FR-DeniseNeural`
- `DEMO_MUSIC_VOLUME=0.20` (plus bas = voix plus audible)

## Diffusion recommandée

| Audience | Vidéo à envoyer |
|----------|-----------------|
| Réunion direction | `direction` |
| Équipe scolarité rentrée | `scolarite` |
| Comptabilité | `comptable` |
| Conseil des profs | `enseignant` |
| Assemblée élèves / 3e trimestre | `eleve` |
| Affichage admissions | `candidat` |
| WhatsApp groupes parents | `parent` |

## Scripts & personnalisation

- Timeline voix + sous-titres : `scripts/training-video-timeline.mjs`
- Guide formateur complet : `docs/formation/GUIDE-UTILISATEUR-KONADATA.md`
- Vidéos **présentation** (marketing) : `docs/demo-video/` — ne pas confondre

## Rôles disponibles (CLI)

`direction` · `scolarite` · `comptable` · `enseignant` · `eleve` · `candidat` · `parent`
