# Guide utilisateur KonaData — Établissements scolaires

**Public :** formateurs internes, directeurs, scolarité, comptables, enseignants  
**Objectif :** former les collègues à l'utilisation de la plateforme par rôle  
**Compte démo :** `demo.ecole@konadata.demo` / `DemoKona2026!`

---

## 1. Vue d'ensemble

KonaData centralise la gestion d'un établissement scolaire :

- **Catalogue** : classes et matières par palier (collège / lycée)
- **Inscriptions** : candidatures, import élèves, dossiers
- **Notes** : saisie par enseignant, import CSV
- **Bulletins** : génération PDF, provisoire puis définitif
- **Paiements** : encaissements, impayés, exports Excel
- **Parents** : portail public sans compte (`/suivi-scolarite`)

Chaque utilisateur ne voit que les menus autorisés pour son rôle.

---

## 2. Connexion et premiers pas

### 2.1 Se connecter

| Étape | Action |
|--------|--------|
| 1 | Ouvrir `/login` |
| 2 | Onglet **Email** (ou téléphone + SMS) |
| 3 | Saisir identifiants fournis par l'établissement |
| 4 | Arrivée sur `/dashboard` puis redirection vers le module métier |

### 2.2 Rôles établissement

| Rôle | Libellé interface | Accès principal |
|------|-------------------|-----------------|
| `org_admin` / `deputy_director` | Direction | Tout le module établissement |
| `registrar` | Scolarité | Inscriptions, élèves, catalogue, paiements (lecture/encaissement selon paramètre) |
| `accountant` | Comptable | Paiements, impayés, effectifs en lecture seule |
| `teacher` | Enseignant | Classes assignées, saisie notes |
| `student` | Élève | Mon inscription, mon bulletin |
| `candidate` | Candidat | Demande d'inscription uniquement |
| *(aucun compte)* | Parent / tuteur | `/suivi-scolarite` (matricule + SMS) |

### 2.3 Matrice rôle × page

| Page | Direction | Scolarité | Comptable | Enseignant | Élève | Candidat |
|------|:---------:|:---------:|:---------:|:----------:|:-----:|:--------:|
| Tableau de bord | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Candidatures | ✓ | ✓ | ✓ (lecture) | — | ✓ | ✓ |
| Étudiants | ✓ | ✓ | ✓ (lecture) | — | — | — |
| Formations | ✓ | ✓ | ✓ (lecture) | Mes classes | — | — |
| Résultats | ✓ | — | — | ✓ (assigné) | — | — |
| Bulletins | ✓ | — | — | — | Mon bulletin | — |
| Paiements | ✓ | ✓ | ✓ | — | — | — |
| Rapports | ✓ | ✓ | ✓ | — | — | — |
| Assignations | ✓ (direction) | — | — | — | — | — |

---

## 3. Direction (`org_admin`, `deputy_director`)

### 3.1 Tableau de bord `/etablissement`

**À montrer en formation :**
- KPIs : effectifs, paiements, classes
- Bandeau bulletins incomplets ou checklist démarrage (si visible)
- Menu latéral complet

**Boutons / zones :** cartes statistiques cliquables, liens rapides vers modules.

### 3.2 Formations `/etablissement/formations`

**Onglet Classes**
- Filtre **Palier** : collège (trimestres) / lycée (semestres)
- **Ajout rapide** : cocher modèles → **Créer**
- **Import Excel / CSV** : bouton import + **Modèle Excel**
- **Modifier** / **Archiver** sur chaque ligne

**Onglet Matières**
- Presets par palier
- Création, édition, archivage (`is_active`)

**Règle clé :** le palier de la classe pilote les périodes pour notes et bulletins.

### 3.3 Assignations `/utilisateurs/assignations`

- Regroupement par palier
- Cocher **classe + matière** pour chaque enseignant
- Bandeau orange : couples sans enseignant
- **Enregistrer** — un seul prof par couple classe/matière

### 3.4 Candidatures `/etablissement/candidatures`

- Liste des demandes (nouveau, en cours, validé, refusé)
- Ouvrir dossier → pièces jointes → **Valider** / **Refuser**
- Notification SMS possible à la confirmation

### 3.5 Étudiants `/etablissement/etudiants`

- Recherche, filtre par classe
- **Nouvel élève** ou **Import** (`/etablissement/etudiants/import`)
- Fiche élève : identité, tuteur, documents, onglet **Scolarité** (échéancier)

### 3.6 Import élèves `/etablissement/etudiants/import`

1. Choisir la classe cible
2. Déposer CSV, Excel ou photo (KonaAI)
3. Aperçu → **Importer**
4. Matricules auto si colonne absente

### 3.7 Résultats `/etablissement/resultats`

- Filtres : Classe, Matière, Période
- Onglet **Grille** : saisie directe
- Onglet **Import** : CSV + **Modèle CSV**
- **0/20** = note saisie · **case vide** = manquant

### 3.8 Bulletins `/etablissement/bulletins`

1. Classe + période + année
2. Cocher **types d'évaluation retenus** (devoir, composition…)
3. Panneau **Complétude**
4. **Générer / recalculer (provisoire)**
5. **Conseil CSV** · **PDF** · **ZIP classe**
6. **Publier définitif + SMS**

**Paramètres :** `/parametres/bulletin` — logo, cachet, paliers, types par défaut.

### 3.9 Paiements `/etablissement/paiements`

- KPI recouvrement
- Onglet **Encaissements** : **Enregistrer un paiement**
- Onglet **Impayés** : filtre classe, lien fiche élève
- **Export Excel** impayés / encaissements

### 3.10 Rapports `/etablissement/rapports`

- Exports et synthèses pour la direction et la scolarité

---

## 4. Scolarité (`registrar`)

### 4.1 Missions quotidiennes

- Traiter les **candidatures**
- Importer et mettre à jour les **élèves**
- Maintenir le **catalogue** classes/matières
- Suivre les **paiements par classe**
- Consulter les **rapports**

### 4.2 Ce que la scolarité ne fait pas (par défaut)

- Génération des bulletins (réservée direction)
- Saisie des notes (enseignants assignés)
- Gestion des assignations (direction)

### 4.3 Encaissement

Si le paramètre *« la scolarité peut encaisser »* est activé dans les paramètres établissement, le rôle peut **Enregistrer un paiement** comme le comptable.

---

## 5. Comptable (`accountant`)

### 5.1 Tableau de bord

Vue **Comptabilité** : indicateurs financiers, impayés, créances.

### 5.2 Paiements `/etablissement/paiements`

**Routine matinale recommandée :**
1. Ouvrir onglet **Impayés**
2. Filtrer par classe si besoin
3. Contacter familles / noter actions
4. **Enregistrer un paiement** au guichet
5. **Exporter impayés Excel** pour reporting

### 5.3 Effectifs en lecture seule

Menu **Effectifs élèves** (étudiants) et **Classes** (formations) : consultation uniquement, pas de modification catalogue.

### 5.4 Dossiers inscription

Accès **Dossiers inscription** pour vérifier pièces avant validation financière.

---

## 6. Enseignant (`teacher`)

### 6.1 Mon espace

Titre : **Mon espace enseignant**. Pas de KPI établissement complet.

### 6.2 Mes classes `/etablissement/formations`

Liste des classes et matières **assignées** uniquement.

### 6.3 Saisie des notes `/etablissement/resultats`

1. Sélectionner classe assignée + matière + période
2. Saisir dans la **Grille**
3. Ou **Import CSV** pour une classe entière

**Si aucune classe n'apparaît :** vérifier les assignations (direction).

### 6.4 Vie scolaire `/etablissement/vie-scolaire`

Suivi disciplinaire et présences selon configuration établissement.

---

## 7. Élève (`student`)

### 7.1 Mon espace élève

- **Mon inscription** : statut dossier, dépôt de pièces
- **Mon bulletin** : bulletins publiés en définitif uniquement

### 7.2 Actions

- Créer une demande de réinscription
- Téléverser des documents sur son dossier

---

## 8. Candidat (`candidate`)

### 8.1 Parcours

1. Connexion ou inscription
2. **Mon inscription** : formulaire demande
3. Téléversement pièces (acte de naissance, photos…)
4. Suivi du statut jusqu'à validation par la scolarité

---

## 9. Parents et tuteurs (sans compte)

### 9.1 Suivi scolarité `/suivi-scolarite`

**Étapes :**
1. Saisir le **matricule** de l'élève
2. Recevoir un **code par SMS** sur le numéro enregistré
3. Consulter le **solde** des frais
4. Télécharger le **bulletin PDF** (si publié en définitif)

**À dire en formation :** pas d'application à installer ; lien partageable par WhatsApp.

---

## 10. Règles métier essentielles

| Sujet | Règle |
|--------|--------|
| Paliers | Collège = trimestres · Lycée = semestres (automatique selon classe) |
| Note 0 | Zéro sur vingt est une note **saisie** |
| Case vide | Note **manquante** → alerte bulletin, publication provisoire possible |
| Types d'évals | Seuls les types **cochés** entrent dans moyenne, complétude et PDF |
| Bulletins | **Provisoire** d'abord → **Définitif** + SMS |
| Assignations | **Un seul enseignant** par couple classe/matière |
| PDF bulletin | Bloqué sans **logo** et **cachet** (paramètres) |

---

## 11. Parcours formation recommandé (atelier 30 min)

1. **5 min** — Connexion direction, tableau de bord, rôles
2. **5 min** — Formations : créer une classe via preset
3. **5 min** — Import 5 élèves (CSV test dans `docs/exemples-test/`)
4. **5 min** — Assigner un enseignant
5. **5 min** — Saisir une grille de notes
6. **5 min** — Bulletins provisoires + paiements impayés

**Fichiers test :** `liste-eleves-terminale.csv`, `notes-terminale-chimie.csv`

---

## 12. Dépannage (FAQ formateurs)

| Symptôme | Cause probable | Solution |
|----------|----------------|----------|
| Liste matières vide | Migration 091 non appliquée | Appliquer migration 091, rafraîchir |
| Erreur génération bulletin | Migrations 088–090 | Appliquer 088 → 090 |
| PDF bloqué | Logo/cachet absents | `/parametres/bulletin` |
| Écran vide | Données non chargées | Lire bandeau rouge (migrations) |
| Enseignant sans notes | Pas d'assignation | `/utilisateurs/assignations` |
| Parent sans bulletin | Non publié en définitif | Direction → Publier définitif |

---

## 13. Ressources complémentaires

| Ressource | Emplacement |
|-----------|-------------|
| Vidéo formation école | `docs/demo-video/output/konadata-formation-ecole.mp4` |
| Teaser réseaux | `docs/demo-video/output/konadata-formation-ecole-teaser.mp4` |
| Script démo live 15 min | `docs/demo-video/SCRIPT-DEMO-PILOTE-ECOLE-15MIN.md` |
| Comptes démo tous secteurs | `docs/demo-video/SETUP-COMPTES-DEMO.md` |
| Vidéo marketing multi-secteur | `docs/demo-video/output/konadata-demo-complete.mp4` |

---

## 14. Autres secteurs (aperçu)

KonaData couvre aussi **ONG**, **BTP** et **PME** avec des comptes démo dédiés. Les principes sont identiques : un rôle = un menu filtré, tableau de bord métier, exports et KonaAI.

| Secteur | Compte démo | Module |
|---------|-------------|--------|
| ONG | `demo.ong@konadata.demo` | Projets, bénéficiaires, sondages |
| BTP | `demo.btp@konadata.demo` | Chantiers, carburant, personnel |
| PME | `demo.pme@konadata.demo` | Ventes, stocks, clients |

Mot de passe commun démo : `DemoKona2026!`

---

## 15. Support

- Site : [konadatagn.com](https://konadatagn.com)
- Contact : contact@konadatagn.com
- Migrations Supabase : dossier `supabase/migrations/` (ordre 088 → 091 pour établissements)
