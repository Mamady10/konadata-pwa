# Campagne KonaData — Plan de communication

> **Simple, connecté, local.**
> Site : [www.konadatagn.com](https://www.konadatagn.com) · WhatsApp : +224 628 36 04 35 / +224 627 71 77 85 · contact@konadatagn.com

## 1. Objectifs

| Objectif | Indicateur | Cible à 4 semaines |
|---|---|---|
| Faire connaître la marque | Portée cumulée (Facebook + Instagram + TikTok) | 150 000 personnes |
| Générer des contacts | Messages WhatsApp + formulaires | 200 conversations |
| Créer des comptes | Organisations inscrites sur konadatagn.com | 40 organisations |
| Activer l'offre | Organisations ayant activé leur période gratuite | 25 |

**Offre de lancement (à citer telle quelle) :** établissements scolaires **12 mois gratuits** · ONG, BTP, PME **6 mois gratuits**. Activation unique, dans les 2 mois suivant l'inscription, puis abonnement mensuel.

## 2. Messages clés

1. **Le problème** : cahiers perdus, fichiers Excel éparpillés, rapports en retard.
2. **La solution** : une seule plateforme par secteur, sur ordinateur et téléphone.
3. **Pensée pour la Guinée** : fonctionne en 3G, saisie hors-ligne, support local par WhatsApp.
4. **L'IA au service des chiffres** : alertes (stock, carburant, retards), rapports rédigés en un clic.
5. **Sans risque** : jusqu'à 12 mois gratuits.

Ton : direct, concret, bienveillant. On vouvoie toujours. On parle de résultats (« gagnez des heures »), pas de technique.

## 3. Inventaire des supports

Tous les fichiers sont dans `docs/marketing/campagne/`.

| Dossier | Contenu | Usage |
|---|---|---|
| `visuels/carre-1080x1080/` | 14 publications (01 à 14) | Fil Facebook, Instagram, LinkedIn, statut WhatsApp |
| `visuels/story-1080x1920/` | Les 14 publications en vertical | Stories Facebook/Instagram, statut WhatsApp, TikTok (photo) |
| `visuels/paysage-1200x628/` | Les 14 publications en paysage | LinkedIn, Facebook liens, publicités Meta « lien », site |
| `visuels/carrousel-secteurs/` | 6 diapositives (couverture, 4 secteurs, offre) | Carrousel Instagram / LinkedIn (document PDF) |
| `visuels/affiches-a4/` | 5 affiches PNG + PDF (marque + 4 secteurs), avec QR code | Impression : écoles, IRE/DPE, chantiers, marchés, bureaux d'ONG |
| `visuels/bannieres/` | Couverture Facebook, couverture et bandeau LinkedIn, photo de profil | Habillage des pages |
| `videos/` | 5 vidéos × 2 formats (9:16 et 16:9) + sous-titres `.srt` | Reels, TikTok, stories, YouTube, publicités vidéo |
| `photos/` | Photos d'ambiance (IA) utilisées dans les visuels | Réutilisation (site, présentations) |
| `captures/` | Captures HD de la plateforme (ordinateur et mobile) | Présentations commerciales, site, presse |

**Vidéos :** `konadata-marque`, `konadata-ecoles`, `konadata-ong`, `konadata-btp`, `konadata-pme` — chacune en `-9x16.mp4` (vertical) et `-16x9.mp4` (horizontal).

> Les sous-titres sont **déjà incrustés** dans les vidéos. N'importez pas le fichier `.srt` en même temps sur Facebook/YouTube (double sous-titrage). Le `.srt` sert uniquement si vous remontez la vidéo sans sous-titres.

### Régénérer les supports

```bash
node scripts/marketing/capture-marketing-screens.mjs   # captures depuis la prod (comptes démo)
node scripts/marketing/build-campaign-visuals.mjs      # visuels (option --only=01-marque,carrousel,bannieres)
node scripts/marketing/build-campaign-videos.mjs       # vidéos (options --only=konadata-btp --format=9x16)
```

Les textes se modifient dans `scripts/marketing/campaign-content.mjs` (visuels) et `scripts/marketing/campaign-videos.mjs` (vidéos). Pour une musique sous licence, déposez `docs/marketing/campagne/musique.mp3` puis relancez les vidéos.

## 4. Rôle de chaque canal

| Canal | Rôle | Formats | Fréquence |
|---|---|---|---|
| **Facebook** (page + groupes) | Canal principal en Guinée, publicités ciblées | Carré, vidéo 9:16, carrousel, paysage | 4 à 5 publications / semaine |
| **WhatsApp** (statut, Business, groupes) | Conversion : c'est là que les prospects écrivent | Story, vidéo 9:16, affiche PDF | Statut quotidien |
| **Instagram** | Image de marque, jeunes entrepreneurs | Carré, Reels, carrousel | 3 publications + 3 Reels / semaine |
| **TikTok** | Portée organique, notoriété | Vidéos 9:16 | 3 à 4 vidéos / semaine |
| **LinkedIn** | ONG, bailleurs, entreprises BTP, directions d'écoles privées | Paysage, carrousel PDF, vidéo 16:9 | 2 à 3 publications / semaine |
| **YouTube** | Hébergement des vidéos, lien dans les messages | 16:9 | Toutes les vidéos |
| **Terrain / imprimé** | Écoles, chantiers, marchés, rencontres ONG | Affiches A4 avec QR code | Semaine 2 et 3 |

## 5. Calendrier sur 4 semaines

Heures conseillées (heure de Conakry) : **12 h 30 – 14 h** et **19 h 30 – 21 h 30**. Statut WhatsApp le matin (7 h 30 – 8 h 30).

### Semaine 1 — Lancement de la marque

| Jour | Canal | Support | Angle |
|---|---|---|---|
| Lun | Toutes les pages | Bannières + photo de profil | Habillage des pages |
| Lun | Facebook, Instagram, LinkedIn | `01-marque` (carré / paysage) | Annonce du lancement |
| Mar | Facebook, TikTok, Reels, WhatsApp | Vidéo `konadata-marque-9x16` | Présentation en 30 s |
| Mer | Facebook, Instagram | `03-probleme` | Le problème |
| Jeu | LinkedIn, Instagram | Carrousel `carrousel-secteurs` | 4 secteurs |
| Ven | Facebook, WhatsApp, Instagram | `02-offre` | Offre de lancement |
| Sam | TikTok, Reels | Vidéo `konadata-marque-9x16` (nouvelle légende) | Relance |
| Dim | Stories / statut | `12-mobile` (story) | Fonctionne en 3G |

### Semaine 2 — Écoles et ONG

| Jour | Canal | Support | Angle |
|---|---|---|---|
| Lun | Facebook, Instagram | `04-ecole` | Directeurs d'école |
| Mar | Facebook, TikTok, Reels, WhatsApp | Vidéo `konadata-ecoles-9x16` | Démonstration école |
| Mer | LinkedIn, Facebook | `05-ong` (paysage) | ONG et bailleurs |
| Jeu | LinkedIn, YouTube | Vidéo `konadata-ong-16x9` | Démonstration ONG |
| Ven | Facebook, Instagram | `08-ecole-produit` | Le tableau de bord école |
| Sam | TikTok, Reels | Vidéo `konadata-ong-9x16` | Collecte terrain |
| Dim | Stories / statut | `14-etapes` (story) | Démarrer en 3 étapes |

Terrain : affiches `affiche-04-ecole` et `affiche-05-ong` (écoles privées, rencontres d'ONG).

### Semaine 3 — BTP et PME

| Jour | Canal | Support | Angle |
|---|---|---|---|
| Lun | Facebook, LinkedIn | `06-btp` | Entreprises du BTP |
| Mar | Facebook, TikTok, Reels, WhatsApp | Vidéo `konadata-btp-9x16` | Démonstration chantier |
| Mer | Facebook, Instagram | `07-pme` | Commerçants |
| Jeu | Facebook, TikTok, Reels, WhatsApp | Vidéo `konadata-pme-9x16` | Démonstration commerce |
| Ven | LinkedIn, Facebook | `10-btp-produit` (paysage) | Rapports chantier |
| Sam | Facebook, Instagram | `11-pme-produit` | Tableau de bord PME |
| Dim | Stories / statut | `02-offre` (story) | Rappel de l'offre |

Terrain : affiches `affiche-06-btp` (chantiers, fournisseurs de matériaux) et `affiche-07-pme` (marchés, boutiques).

### Semaine 4 — Preuve et conversion

| Jour | Canal | Support | Angle |
|---|---|---|---|
| Lun | Facebook, LinkedIn, Instagram | `13-ia` | KonaAI |
| Mar | Facebook, Instagram | `09-ong-produit` | Tableau de bord ONG |
| Mer | Facebook, WhatsApp | `14-etapes` | Démarrer en 3 étapes |
| Jeu | LinkedIn, YouTube | Vidéo `konadata-marque-16x9` | Récapitulatif |
| Ven | Toutes | `02-offre` + témoignage d'un premier client (si disponible) | Urgence : activer l'offre |
| Sam | TikTok, Reels | Meilleure vidéo des semaines 1 à 3 | Relance |
| Dim | Stories / statut | `12-mobile` | Sur votre téléphone |

## 6. Légendes prêtes à publier

Remplacez `[lien]` par `https://www.konadatagn.com` (ou le lien court de suivi, voir §8).

### 01 — Marque
**Facebook / Instagram**
> 📊 Vos données enfin organisées.
> Écoles, ONG, chantiers BTP, PME : KonaData réunit la collecte, le suivi et l'analyse de vos données sur une seule plateforme — sur ordinateur comme sur téléphone, même en 3G.
> ✅ Rapports automatiques ✅ Données sécurisées ✅ Support local
> 👉 Essai gratuit : [lien]
> 💬 WhatsApp : +224 628 36 04 35

**LinkedIn**
> Nous lançons KonaData, une plateforme de gestion des données conçue pour les organisations guinéennes : établissements scolaires, ONG, entreprises du BTP et PME.
> Notre conviction : une donnée bien saisie une seule fois doit servir partout — au tableau de bord, au rapport mensuel, au bailleur.
> La plateforme fonctionne sur ordinateur et téléphone, y compris en connexion faible, et intègre une IA qui signale les anomalies et rédige les synthèses.
> Offre de lancement : jusqu'à 12 mois gratuits. [lien]

**WhatsApp (statut / message)**
> KonaData est lancé 🇬🇳 Écoles, ONG, BTP, PME : gérez vos données simplement, même en 3G. Jusqu'à 12 mois gratuits 👉 [lien]

### 02 — Offre de lancement
> 🎁 Offre de lancement KonaData
> 🏫 Établissements scolaires : 12 mois gratuits
> 🤝 ONG · 🏗️ BTP · 🛒 PME : 6 mois gratuits
> Activation unique dans les 2 mois suivant votre inscription.
> Créez votre organisation en quelques minutes 👉 [lien]

### 03 — Le problème
> Cahiers perdus, chiffres introuvables, rapports rendus en retard… ça vous parle ? 😅
> Avec KonaData, chaque donnée est saisie une fois, rangée automatiquement et retrouvée en un clic.
> Passez au numérique 👉 [lien]

### 04 / 08 — Écoles
> 🏫 Directeurs, fondateurs d'écoles : gagnez des heures chaque semaine.
> Inscriptions, notes, bulletins, paiements de scolarité : tout est réuni au même endroit.
> ✅ Bulletins PDF générés automatiquement
> ✅ Paiements suivis par classe
> ✅ Espace parents et élèves
> 🎁 12 mois gratuits pour les établissements scolaires 👉 [lien]

### 05 / 09 — ONG
> 🤝 Du terrain au rapport bailleur, sans ressaisie.
> Projets, bénéficiaires, budget, sondages et cartographie : KonaData réunit tout sur un seul tableau de bord. Vos agents collectent sur téléphone, même sans réseau.
> 🎁 6 mois gratuits pour les ONG 👉 [lien]

**LinkedIn (ONG)**
> Combien d'heures votre équipe passe-t-elle à consolider des fichiers avant chaque rapport bailleur ?
> Avec KonaData, la collecte terrain (mobile, QR code, hors-ligne) alimente directement les indicateurs, la carte des localités couvertes et le suivi budgétaire prévu / dépensé.
> 6 mois offerts pour les ONG qui démarrent maintenant. [lien]

### 06 / 10 — BTP
> 🏗️ Plusieurs chantiers ? Gardez le contrôle.
> Avancement, carburant, bons de livraison, personnel : suivis chaque jour, chantier par chantier.
> ⛽ Alertes sur les anomalies de carburant
> 📑 Rapport hebdomadaire PDF et PowerPoint en un clic
> 📐 Devis avec métré automatique
> 🎁 6 mois gratuits pour les entreprises du BTP 👉 [lien]

### 07 / 11 — PME
> 🛒 Commerçant, savez-vous exactement combien vous avez gagné ce mois-ci ?
> Ventes, stocks, dépenses et crédits clients suivis depuis votre téléphone. KonaData vous prévient quand un stock est bas.
> 🎁 6 mois gratuits pour les PME et commerces 👉 [lien]

### 12 — Mobile
> 📱 Pas d'ordinateur ? Pas de problème.
> KonaData s'installe comme une application sur votre téléphone, fonctionne en 3G/4G et garde vos saisies même sans réseau. Elles partent automatiquement au retour de la connexion.
> Ouvrez [lien] sur votre téléphone.

### 13 — KonaAI
> 🤖 L'IA qui lit vos chiffres pour vous.
> KonaAI repère ce qui cloche (stock bas, chantier en retard, consommation de carburant anormale) et rédige vos synthèses en un clic.
> Découvrez-la 👉 [lien]

### 14 — Démarrer en 3 étapes
> Démarrer avec KonaData, c'est 3 étapes :
> 1️⃣ Créez votre organisation sur [lien]
> 2️⃣ Invitez votre équipe avec un code
> 3️⃣ Pilotez : saisie, tableaux de bord, rapports
> Besoin d'aide ? WhatsApp +224 628 36 04 35

### Vidéos (TikTok / Reels)
Légende courte + 3 à 5 hashtags. Exemples :
- **marque** : « Vos données sont encore dans des cahiers ? 📚➡️📱 Découvrez KonaData. »
- **écoles** : « Directeur d'école ? Voici comment gagner des heures chaque semaine 🏫 »
- **ONG** : « Du terrain au rapport bailleur, sans ressaisie 🤝 »
- **BTP** : « Vos chantiers sous contrôle, même depuis le bureau 🏗️ »
- **PME** : « Combien avez-vous gagné ce mois-ci ? 🛒 »

## 7. Hashtags

- **Marque (toujours)** : `#KonaData` `#Guinée` `#Conakry`
- **Général** : `#TransformationDigitale` `#GuinéeNumérique` `#MadeInGuinea` `#Innovation` `#StartupAfrique`
- **Écoles** : `#Éducation` `#ÉcolePrivée` `#GestionScolaire` `#Bulletins`
- **ONG** : `#ONG` `#Humanitaire` `#SuiviÉvaluation` `#CollecteDeDonnées`
- **BTP** : `#BTP` `#Construction` `#Chantier` `#GestionDeChantier`
- **PME** : `#PME` `#Commerce` `#Entrepreneuriat` `#GestionDeStock`

Facebook / LinkedIn : 3 à 5 hashtags. Instagram : 8 à 12. TikTok : 3 à 5.

## 8. Publicité payante (Meta : Facebook + Instagram)

**Budget indicatif** : 25 à 40 USD / jour pendant 4 semaines, réparti 40 % marque, 60 % secteurs.

| Campagne | Objectif Meta | Supports | Ciblage |
|---|---|---|---|
| Notoriété | Portée / ThruPlay | `konadata-marque-9x16`, `01-marque` | Guinée, 22–55 ans, Conakry + Kindia, Boké, Kankan, Labé, N'Zérékoré |
| Écoles | Messages (WhatsApp) | `konadata-ecoles-9x16`, `04-ecole`, `08-ecole-produit` | Intérêts : éducation, enseignement, école privée ; postes : directeur, fondateur, enseignant |
| ONG | Trafic / prospects | `konadata-ong-16x9`, `05-ong`, carrousel | Intérêts : ONG, développement, humanitaire, UNICEF, USAID, Plan International |
| BTP | Messages (WhatsApp) | `konadata-btp-9x16`, `06-btp`, `10-btp-produit` | Intérêts : construction, génie civil, BTP, matériaux ; administrateurs de pages d'entreprise |
| PME | Messages (WhatsApp) | `konadata-pme-9x16`, `07-pme`, `11-pme-produit` | Intérêts : petite entreprise, commerce, entrepreneuriat, Orange Money |

Bonnes pratiques :
- Bouton **« Envoyer un message WhatsApp »** : en Guinée, le contact direct convertit mieux qu'un formulaire.
- Placements : fil et Reels en priorité ; exclure l'Audience Network.
- Tester 2 à 3 visuels par ensemble de publicités, couper au bout de 3 jours ceux dont le coût par message est le double de la moyenne.
- Recibler (reciblage) les personnes ayant vu 50 % d'une vidéo avec `02-offre` et `14-etapes`.
- Préparer des réponses types WhatsApp (voir §9) pour répondre en moins de 15 minutes.

**LinkedIn** : publications sponsorisées ciblant les directeurs d'ONG, de projets, les responsables de travaux et les directeurs d'école privée en Guinée (budget réduit, 10 USD / jour, semaines 2 et 3).

**TikTok** : organique d'abord ; sponsoriser uniquement la vidéo qui fait le meilleur taux de visionnage complet.

## 9. Réponses types WhatsApp

**Premier contact**
> Bonjour et merci pour votre intérêt pour KonaData 🙏 Pour vous orienter, pouvez-vous nous dire votre secteur (école, ONG, BTP ou commerce) et la taille de votre équipe ?

**Démarrer**
> Vous pouvez créer votre organisation dès maintenant sur https://www.konadatagn.com (bouton « Créer mon organisation »). La période gratuite (12 mois pour les écoles, 6 mois pour les autres secteurs) s'active une seule fois, dans les 2 mois suivant l'inscription. Voulez-vous que l'on vous accompagne par appel ?

**Démonstration**
> Avec plaisir ! Nous pouvons faire une démonstration de 20 minutes par appel vidéo ou dans vos locaux à Conakry. Quel jour vous convient ?

## 10. Suivi des résultats

- Ajouter des paramètres UTM au lien selon le canal, par exemple `https://www.konadatagn.com/?utm_source=facebook&utm_medium=paid&utm_campaign=lancement&utm_content=btp`.
- Tableau hebdomadaire : portée, clics, messages WhatsApp, inscriptions, activations, coût par message, coût par inscription.
- Chaque lundi : garder les 3 meilleurs supports, remplacer les moins bons, ajuster le budget vers le secteur qui convertit le mieux.

## 11. Points d'attention

- **Données de démonstration** : les captures proviennent des comptes de démonstration. Le tableau de bord PME affiche un résultat négatif (−1 480 000 FG) ; c'est réaliste mais peut être remplacé par des données plus positives avant la diffusion payante.
- **Photos IA** : les personnes représentées sont générées par IA. Dès que possible, les remplacer par de vraies photos d'utilisateurs (avec leur accord écrit) : l'authenticité convertit mieux.
- **Logos partenaires** : non utilisés dans les visuels. Les ajouter uniquement avec l'accord écrit des partenaires.
- **Musique** : les vidéos utilisent une nappe sonore générée. Pour TikTok/Reels, vous pouvez ajouter un son tendance directement dans l'application (baisser alors la musique d'origine), ou déposer une musique libre de droits dans `musique.mp3` et régénérer.
- **Cohérence de l'offre** : les anciennes affiches mentionnant « 30 jours » ne doivent plus être diffusées.
