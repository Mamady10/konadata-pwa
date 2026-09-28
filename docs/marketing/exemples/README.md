# Exemples à montrer aux prospects

Documents réels produits par KonaData avec les organisations de démonstration (données fictives).
Ils peuvent être envoyés tels quels par WhatsApp ou e-mail, ou projetés en rendez-vous.

| Secteur | Organisation de démonstration | Dossier |
| --- | --- | --- |
| BTP | Bâtir Guinée SARL | `btp-rapports/`, `btp-devis/` |
| École | Groupe Scolaire Horizon | `ecole/` |
| ONG | Santé & Avenir Guinée | `ong/` |
| PME / commerce | Espace Commercial Madina | `pme/` |

## BTP — rapports de chantier (`btp-rapports/`)

| Fichier | Ce qu'il montre |
| --- | --- |
| `01-rapport-hebdomadaire.pdf` / `.pptx` | Rapport de la semaine : résumé, planifié vs réalisé, courbe en S, carburant, livraisons, photos datées, signatures. Version PowerPoint prête pour la réunion de chantier. |
| `02-rapport-mensuel.pdf` / `.pptx` | Même modèle sur le mois (septembre 2026). |
| `03-rapport-trimestriel.pdf` | Synthèse du trimestre (T3 2026). |
| `04-rapport-annuel.pdf` | Bilan de l'année 2026. |
| `05-rapport-hebdomadaire-sans-montants.pdf` | Version maître d'ouvrage : même rapport, aucun montant (une case à décocher). |
| `06-dossier-cloture-chantier.pdf` | Dossier de clôture MOA : bilan final, KPI, ventilation budgétaire, historique des fiches, documents de réception. |
| `07` à `11-synthese-ia-*.pdf` | Synthèses en un clic : générale, carburant, bons de livraison, avancement terrain, stocks. |

## BTP — devis (`btp-devis/`)

| Fichier | Ce qu'il montre |
| --- | --- |
| `devis-DEV-2026-0003.pdf` | Devis d'un immeuble R+2 : 13 lots, métré détaillé (béton, fers, agglos…), récapitulatif, TVA 18 %, montant en lettres, zones de signature. |
| `devis-DEV-2026-0003.xlsx` | Le même devis en Excel, modifiable. |

## École (`ecole/`)

| Fichier | Ce qu'il montre |
| --- | --- |
| `01-bulletin-lycee.pdf` | Bulletin définitif de Terminale SM (1er semestre) : notes, coefficients, mentions, appréciations, moyenne 17,30/20, rang, décision, logo et cachet. |
| `02-bulletin-primaire.pdf` | Bulletin de CM2 (1er trimestre), même modèle. |
| `03-rapport-direction-mensuel.pdf` | Rapport de direction du mois : effectifs, encaissements, recouvrement par classe, candidatures, résultats par classe. |
| `04-rapport-direction-annuel.pdf` | Le même sur l'année scolaire 2026-2027. |
| `05-recu-paiement.pdf` | Reçu officiel de paiement : montant en lettres, situation de la scolarité, QR code de vérification. |
| `06-encaissements.xlsx` | Export Excel des encaissements (date, élève, classe, mode, n° de reçu). |
| `07-impayes-relances.xlsx` | Export Excel des impayés avec téléphone du tuteur, pour les relances. |

## ONG (`ong/`)

| Fichier | Ce qu'il montre |
| --- | --- |
| `01-rapport-sondage-cpn-kindia.pdf` | Rapport d'enquête (consultations prénatales, Kindia) : réponses, répartition des choix, localités, collecte dans le temps. |
| `02-rapport-sondage-satisfaction.pdf` | Rapport d'enquête de satisfaction des bénéficiaires, toutes zones. |
| `03-rapport-general-projets.pdf` | Rapport général de l'organisation : budget et exécution par projet, bénéficiaires, documents. |
| `04-execution-budgetaire.pdf` | Budget et exécution, projet par projet. |
| `05-beneficiaires-kindia.pdf` | Bénéficiaires du projet santé maternelle et infantile (Kindia). |
| `06-tableau-de-bord-ong.pdf` | Synthèse des rapports générés et des documents archivés. |

## PME / commerce (`pme/`)

| Fichier | Ce qu'il montre |
| --- | --- |
| `01-analyse-financiere-mensuelle.pdf` | Entrées, dépenses par catégorie et reste, semaine par semaine (septembre 2026), avec graphiques. |
| `02-analyse-financiere-trimestrielle.pdf` | Le même par mois sur le trimestre. |
| `03-analyse-financiere-annuelle.pdf` | Bilan de l'année, tableau en millions de GNF. |
| `04-analyse-boutique-madina.pdf` | Analyse du mois pour une seule boutique. |
| `05-indicateurs-synthese.pdf` | Chiffre d'affaires, dépenses, résultat, créances clients, alertes de stock. |

## Visuels pour les réseaux sociaux

`../campagne/visuels/exemples-<secteur>/`, chaque visuel en carré 1080×1080 (Facebook, Instagram),
portrait 1080×1350 (fil Instagram, WhatsApp Status) et paysage 1200×628 (LinkedIn, lien Facebook) :

- `exemples-btp/` : rapport, devis, avec ou sans montants, 4 périodes ;
- `exemples-ecole/` : bulletin, reçu de paiement, rapport de direction ;
- `exemples-ong/` : rapports bailleurs, suivi budgétaire, enquêtes terrain ;
- `exemples-pme/` : analyse financière, boutiques et périodes, bilan annuel.

## Régénérer

Serveur de développement lancé (`npm run dev`), puis :

```bash
# BTP
node scripts/tutorials/seed/seed-vitrine-devis.mjs
node scripts/tutorials/seed/seed-vitrine-cloture.mjs
node scripts/marketing/build-sample-reports.mjs      # --only=periodique,cloture,ia,devis

# École, ONG, PME
node scripts/marketing/build-sector-samples.mjs      # --only=ecole,ong,pme (ou --only=bulletins)

# Visuels
node scripts/marketing/build-sample-visuals.mjs      # --sector=btp,ecole,ong,pme --only=bulletin,analyse…
```

Sur un poste avec un antivirus qui inspecte le HTTPS (Avast, etc.), préfixer par `NODE_OPTIONS=--use-system-ca`.
