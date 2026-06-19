# Récapitulatif plateforme KonaData — Tous secteurs

**Public :** formateurs, partenaires, directions (École, ONG, BTP, PME)  
**Site :** https://www.konadatagn.com  
**Mot de passe démo (tous comptes) :** `DemoKona2026!`

Ce document synthétise l'ensemble de la plateforme. Pour le détail écran par écran, voir les guides sectoriels listés en section 8.

---

## 1. Architecture générale

KonaData est une **PWA multi-tenant** : chaque organisation (école, ONG, entreprise BTP, PME) dispose de son espace isolé. Les données ne sont pas partagées entre organisations (PostgreSQL + Row Level Security Supabase).

### 1.1 Quatre secteurs métier

| Secteur | Route d'accueil | Public principal |
|---------|-----------------|------------------|
| **Établissement** | `/etablissement` | Écoles, collèges, lycées, universités |
| **ONG** | `/ong` | Associations, fondations, bailleurs |
| **BTP** | `/btp` | Entreprises de construction, travaux publics |
| **PME** | `/pme` | Commerces, boutiques, TPE |

### 1.2 Outils communs (tous secteurs)

| Outil | Route | Usage |
|-------|-------|-------|
| Tableau de bord global | `/dashboard` | Vue transversale, changement de secteur |
| Data Factory | `/data-factory` | Import / extraction IA de documents |
| Analyste IA | `/analyste-ia` | Chat sur les données de l'organisation |
| Connecteurs | `/connecteurs` | Intégrations (WhatsApp, etc.) |
| Utilisateurs | `/utilisateurs` | Comptes, rôles, codes d'accès |
| Assignations | `/…/assignations` | Lier staff aux ressources (classes, chantiers, projets) |
| Paramètres | `/parametres` | Facturation plateforme, modèles IA, options secteur |

### 1.3 Connexion & sécurité

| Méthode | Détail |
|---------|--------|
| **Email + mot de passe** | Classique sur `/login` |
| **Téléphone + OTP** | WhatsApp (prioritaire) ou SMS — connexion et mot de passe oublié |
| **Inscription** | OTP WhatsApp/SMS ou email obligatoire (`/register`, `/register/candidat`, `/register/sondage`) |
| **Secours compte** | Direction peut réinitialiser un compte staff (perte de numéro WhatsApp) |

---

## 2. Tous les comptes démo

Fichier source : `docs/demo-video/demo-accounts-all.json`  
Seed : `npm run seed:demo:all`

| Secteur | Rôle | Email | Page d'accueil |
|---------|------|-------|----------------|
| Plateforme | Admin CEO | `demo.admin@konadata.demo` | `/dashboard` |
| École | Direction | `demo.ecole@konadata.demo` | `/etablissement` |
| École | Directeur adjoint | `demo.adjoint@konadata.demo` | `/etablissement` |
| École | Scolarité | `demo.scolarite@konadata.demo` | `/etablissement/candidatures` |
| École | Comptable | `demo.comptable@konadata.demo` | `/etablissement/paiements` |
| École | Enseignant | `demo.prof@konadata.demo` | `/etablissement/resultats` |
| École | Élève | `demo.eleve@konadata.demo` | `/mon-espace` |
| École | Candidat | `demo.candidat@konadata.demo` | `/mon-espace` |
| ONG | Direction | `demo.ong@konadata.demo` | `/ong` |
| ONG | Chargé de projet | `demo.staff.ong@konadata.demo` | `/ong/projets` |
| BTP | Direction | `demo.btp@konadata.demo` | `/btp` |
| BTP | Chef de chantier | `demo.chef.btp@konadata.demo` | `/btp/avancement` |
| PME | Gérant | `demo.pme@konadata.demo` | `/pme` |
| PME | Vendeur | `demo.staff.pme@konadata.demo` | `/pme/ventes` |

---

## 3. Établissement scolaire

**Guide détaillé :** `docs/formation/GUIDE-UTILISATEUR-KONADATA.md`  
**Vidéos :** 7 profils dans `docs/formation/training/output/` (direction, scolarité, comptable, enseignant, élève, candidat, parent)  
**Démo live :** `docs/demo-video/SCRIPT-DEMO-PILOTE-ECOLE-15MIN.md`

### Pages principales

| Page | Objectif | Rôles clés |
|------|----------|------------|
| Candidatures | Dossiers d'admission, validation | Direction, scolarité |
| Étudiants | Fiches élèves, import CSV/IA | Direction, scolarité |
| Formations | Classes et matières par palier | Direction, scolarité |
| Résultats | Saisie notes, import CSV | Enseignants assignés |
| Bulletins | PDF provisoire → définitif | Direction |
| Paiements | Encaissements, impayés, export | Comptable, scolarité |
| Vie scolaire | Absences, discipline | Direction |
| Rapports | Synthèses et exports | Direction |

### Parcours type rentrée

1. Créer le catalogue (classes + matières)
2. Assigner enseignants aux couples classe × matière
3. Traiter les candidatures → valider
4. Importer ou inscrire les élèves
5. Saisir les notes (grille ou CSV)
6. Générer bulletins provisoires → vérifier → publier définitif
7. Encaisser les frais de scolarité

### Portails publics (sans compte)

| Portail | Route | Identification |
|---------|-------|----------------|
| Suivi scolarité | `/suivi-scolarite` | Matricule + téléphone tuteur (OTP SMS) |
| Payer scolarité | `/payer-scolarite` | Matricule + téléphone → Orange Money |

---

## 4. ONG

### Pages principales

| Page | Objectif | Rôles clés |
|------|----------|------------|
| Projets | Programmes et activités | Direction, staff assigné |
| Sondages | Enquêtes terrain, collecte données | Direction, staff |
| Bénéficiaires | Registre des bénéficiaires | Direction uniquement |
| Cartographie | Visualisation géographique | Direction uniquement |
| Documents | Pièces jointes, extraction IA | Tous |
| Rapports | Synthèses et exports IA | Direction, staff (lecture) |

### Matrice rôle × page

| Page | Direction | Staff ONG (`ngo_staff`) |
|------|:---------:|:-----------------------:|
| Dashboard | ✓ | ✓ |
| Projets | ✓ | ✓ (assignés) |
| Sondages | ✓ | ✓ |
| Bénéficiaires | ✓ | — |
| Cartographie | ✓ | — |
| Documents | ✓ | ✓ |
| Rapports | ✓ | ✓ |
| Assignations | ✓ | — |

### Parcours type enquête terrain

1. Créer un projet
2. Créer un sondage (questions, cibles)
3. Assigner le staff au projet
4. Collecter via QR / lien public (`/participation-ong/[token]`) — OTP WhatsApp
5. Consulter les analytiques du sondage
6. Compiler un rapport pour le bailleur

### Compte démo

- Direction : `demo.ong@konadata.demo`
- Staff : `demo.staff.ong@konadata.demo`

---

## 5. BTP

**Guide détaillé :** `docs/formation/GUIDE-UTILISATEUR-KONADATA-BTP.md`  
**Vidéos :** `konadata-formation-btp-direction.mp4` + `konadata-formation-btp-chef.mp4`  
**Démo live :** `docs/demo-video/SCRIPT-DEMO-PILOTE-BTP-15MIN.md`  
**Modèles papier :** `docs/btp/modeles/`

### Pages principales

| Page | Objectif | Rôles clés |
|------|----------|------------|
| Chantiers | Fiches chantier, budget, planning MS Project | Direction |
| Personnel | Effectifs, pointage MO, salaires Excel | Direction |
| Avancement | Relevés journaliers, planifié vs réel | Tous (terrain assigné) |
| Bons | Bons de livraison, validation → matériaux | Tous |
| Carburant | Consommation engins | Tous |
| Matériels | Stock entrées / sorties | Tous |
| Finances | Budget vs réel par poste | Direction |
| Rapports | Compilation périodique PDF/PPTX | Tous |
| Documents | Pièces chantier | Tous |

### Matrice rôle × page

| Page | Direction | Chef (`btp_staff`) |
|------|:---------:|:--------------------:|
| Chantiers | ✓ créer | ✓ lecture assignés |
| Personnel | ✓ | — |
| Finances | ✓ | — |
| Avancement | ✓ complet | ✓ terrain |
| BL / Carburant / Stock | ✓ | ✓ |
| Rapports | ✓ + archive IA | ✓ compiler |
| Assignations | ✓ | — |

### Parcours type semaine chantier

1. Direction : créer chantier, budget, planning, assigner chef
2. Chef : relevé avancement quotidien + BL à réception
3. Chef : relevé carburant, documents terrain
4. Vendredi : compiler rapport semaine → transmettre MOA
5. Direction : revue Finances, écarts par poste

### Calcul finances (rappel)

| Poste | Sources |
|-------|---------|
| Main d'œuvre | Pointages + salaires Excel + dépenses MO |
| Matériaux | BL validés + dépenses matériaux |
| Engins | Carburant + dépenses équipement |
| Sous-traitance | Contrats + paiements |
| Total | `opening_spent` + tous postes |

---

## 6. PME

### Pages principales

| Page | Objectif | Rôles clés |
|------|----------|------------|
| Ventes | Encaissements, tickets de caisse | Gérant, vendeur |
| Achats | Commandes fournisseurs | Gérant |
| Dépenses | Charges diverses | Gérant, comptable |
| Stocks | Inventaire, seuils d'alerte | Gérant, vendeur |
| Clients | Fichier clientèle | Gérant, vendeur |
| Fournisseurs | Fichier fournisseurs | Gérant |
| Documents | Factures, reçus scannés | Tous |
| Rapports | CA, marges, exports | Gérant |

### Matrice rôle × page

| Page | Gérant / Comptable | Vendeur (`pme_staff`) |
|------|:------------------:|:---------------------:|
| Dashboard | ✓ | ✓ |
| Ventes | ✓ | ✓ |
| Achats | ✓ | — |
| Dépenses | ✓ | — |
| Stocks | ✓ | ✓ |
| Clients | ✓ | ✓ |
| Fournisseurs | ✓ | — |
| Documents | ✓ | ✓ |
| Rapports | ✓ | ✓ |

### Parcours type journée boutique

1. Ouvrir le dashboard → voir CA du jour
2. Enregistrer les ventes (`/pme/ventes`)
3. Mettre à jour le stock si rupture
4. En fin de journée : consulter rapports

### Compte démo

- Gérant : `demo.pme@konadata.demo`
- Vendeur : `demo.staff.pme@konadata.demo`

---

## 7. Inscription & onboarding

| Parcours | Route | OTP |
|----------|-------|-----|
| Organisation (staff) | `/register` | WhatsApp / SMS / email |
| Candidat école | `/register/candidat` | WhatsApp / SMS / email |
| Organisation sondage ONG | `/register/sondage` | WhatsApp / SMS / email |
| Établissement scolaire (partenaire) | `/inscription-etablissement` | Selon flux |

Après inscription : connexion automatique → redirection vers le module métier.

---

## 8. Index des ressources formation

| Ressource | Emplacement |
|-----------|-------------|
| **Ce récapitulatif (PDF)** | `docs/formation/output/RECAPITULATIF-PLATEFORME-KONADATA.pdf` |
| Guide École (MD + PDF + PPTX) | `docs/formation/GUIDE-UTILISATEUR-KONADATA.*` |
| Guide BTP (MD + PDF + PPTX) | `docs/formation/GUIDE-UTILISATEUR-KONADATA-BTP.*` |
| Index formation BTP | `docs/formation/README-BTP.md` |
| Vidéos formation École (7 rôles) | `docs/formation/training/output/konadata-formation-*.mp4` |
| Vidéos formation BTP (2 rôles) | `…/konadata-formation-btp-*.mp4` |
| Vidéo marketing complète | `docs/demo-video/output/konadata-demo-complete.mp4` |
| Script démo École 15 min | `docs/demo-video/SCRIPT-DEMO-PILOTE-ECOLE-15MIN.md` |
| Script démo BTP 15 min | `docs/demo-video/SCRIPT-DEMO-PILOTE-BTP-15MIN.md` |
| Comptes démo JSON | `docs/demo-video/demo-accounts-all.json` |
| Setup comptes démo | `docs/demo-video/SETUP-COMPTES-DEMO.md` |

### Commandes de régénération

```powershell
npm run seed:demo:all              # 14 comptes démo
npm run capture:demo:all           # captures écran (app dev requise)
npm run build:formation-docs       # PDF/PPTX École
npm run build:formation-docs:btp   # PDF/PPTX BTP
npm run build:formation-docs:recap # PDF récapitulatif global
npm run build:training-videos      # vidéos École (7 rôles)
npm run build:training-videos:btp  # vidéos BTP (2 rôles)
npm run build:demo-video           # vidéo marketing
```

---

## 9. Synthèse par profil utilisateur

| Je suis… | Je me connecte avec… | J'utilise surtout… |
|----------|----------------------|-------------------|
| Directeur d'école | Email direction | Catalogue, bulletins, paiements, utilisateurs |
| Professeur | Email staff | Mes classes, saisie notes |
| Parent | Pas de compte | `/suivi-scolarite` + `/payer-scolarite` |
| Directeur ONG | Email direction | Projets, sondages, bénéficiaires, rapports bailleur |
| Agent terrain ONG | Email staff | Sondages assignés, collecte QR |
| Directeur BTP | Email direction | Chantiers, finances, personnel, rapports MOA |
| Chef de chantier | Email + WhatsApp | Avancement, BL, carburant, rapport hebdo |
| Gérant PME | Email direction | Ventes, stocks, achats, rapports CA |
| Vendeur | Email staff | Ventes, clients, stock |

---

## 10. Support

- **Email :** contact@konadatagn.com
- **Site :** https://www.konadatagn.com
- **Migrations Supabase :** `supabase/migrations/` (appliquer dans l'ordre sur le projet prod)

---

*KonaData — Récapitulatif plateforme v1 — Juin 2026*
