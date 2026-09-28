# Exemples à montrer aux prospects (BTP)

Documents réels produits par KonaData avec l'organisation de démonstration « Bâtir Guinée SARL »
(données fictives). Ils peuvent être envoyés tels quels par WhatsApp ou e-mail, ou projetés en rendez-vous.

## Rapports de chantier (`btp-rapports/`)

| Fichier | Ce qu'il montre |
| --- | --- |
| `01-rapport-hebdomadaire.pdf` / `.pptx` | Rapport de la semaine : résumé, planifié vs réalisé, courbe en S, carburant, livraisons, photos datées, signatures. Version PowerPoint prête pour la réunion de chantier. |
| `02-rapport-mensuel.pdf` / `.pptx` | Même modèle sur le mois (septembre 2026). |
| `03-rapport-trimestriel.pdf` | Synthèse du trimestre (T3 2026). |
| `04-rapport-annuel.pdf` | Bilan de l'année 2026. |
| `05-rapport-hebdomadaire-sans-montants.pdf` | Version maître d'ouvrage : même rapport, aucun montant (une case à décocher). |
| `06-dossier-cloture-chantier.pdf` | Dossier de clôture MOA : bilan final, KPI, ventilation budgétaire, historique des fiches, documents de réception. |
| `07` à `11-synthese-ia-*.pdf` | Synthèses en un clic : générale, carburant, bons de livraison, avancement terrain, stocks. |

## Devis (`btp-devis/`)

| Fichier | Ce qu'il montre |
| --- | --- |
| `devis-DEV-2026-0003.pdf` | Devis d'un immeuble R+2 : 13 lots, métré détaillé (béton, fers, agglos…), récapitulatif, TVA 18 %, montant en lettres, zones de signature. |
| `devis-DEV-2026-0003.xlsx` | Le même devis en Excel, modifiable. |

## Visuels pour les réseaux sociaux

`../campagne/visuels/exemples-btp/` : 4 visuels (rapport, devis, avec ou sans montants, 4 périodes),
chacun en carré 1080×1080 (Facebook, Instagram), portrait 1080×1350 (fil Instagram, WhatsApp Status)
et paysage 1200×628 (LinkedIn, lien Facebook).

## Régénérer

Serveur de développement lancé (`npm run dev`), puis :

```bash
node scripts/tutorials/seed/seed-vitrine-devis.mjs
node scripts/tutorials/seed/seed-vitrine-cloture.mjs
node scripts/marketing/build-sample-reports.mjs      # --only=periodique,cloture,ia,devis
node scripts/marketing/build-sample-visuals.mjs      # --only=rapport,devis,sans-montants,periodes
```

Sur un poste avec un antivirus qui inspecte le HTTPS (Avast, etc.), préfixer par `NODE_OPTIONS=--use-system-ca`.
