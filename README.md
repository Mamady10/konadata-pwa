# Guinea PWA

Application Next.js (App Router) + Tailwind CSS + PWA, optimisée pour les réseaux **3G/4G en Guinée** (bas débit, coupures fréquentes).

## Démarrage

```bash
npm install
npm run generate:icons   # génère icon-192x192.png et icon-512x512.png (#0D192F)
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

## Architecture PWA

| Fichier | Rôle |
|---------|------|
| `next.config.js` | Compression, formats d'images AVIF/WebP, en-têtes cache agressifs |
| `public/manifest.json` | Manifest PWA (couleur `#0D192F`, icônes 192/512) |
| `public/sw.js` | Service Worker : cache shell, offline fallback, file d'attente formulaires |
| `public/offline.html` | Page de secours hors-ligne |
| `components/PWAProvider.tsx` | Enregistrement SW, indicateur réseau, wrapper `<OfflineForm>` |
| `lib/offline-forms.ts` | Helpers IndexedDB + communication avec le SW |

## Stratégies de cache (sw.js)

- **Navigation** : network-first → cache shell → `offline.html`
- **Assets statiques** (`/_next/static/`, CSS, JS, fonts) : cache-first
- **API** (`/api/*`) : network-first ; si hors-ligne, formulaire mis en file IndexedDB
- **Background Sync** : envoi automatique des formulaires en attente à la reconnexion

## Test hors-ligne

1. Lancer l'app en production : `npm run build && npm start`
2. Ouvrir DevTools → Application → Service Workers
3. Cocher "Offline" et soumettre le formulaire
4. Revenir en ligne → synchronisation automatique

## Couleur de marque

`#0D192F` (interprétation de `#0Q192F` — caractère hex invalide corrigé)

## Déploiement (GitHub + Vercel)

- Guide complet : [docs/DEPLOIEMENT-GITHUB-VERCEL.md](docs/DEPLOIEMENT-GITHUB-VERCEL.md)
- Pousser une mise à jour : `.\scripts\git-push.ps1 -Message "votre message"`
