# Script démo pilote — Établissement scolaire (15 min)

**Public :** directeurs, responsables scolarité, comptables, partenaires  
**Objectif :** montrer un parcours complet « rentrée → notes → bulletins → paiements → parents »  
**Durée :** 15 minutes (+ 3 min questions)

---

## Avant la démo (à faire hors présentation)

| Étape | Détail |
|--------|--------|
| Lancer l’app | `cd guinea-pwa` puis `npm run dev` → http://localhost:3000 |
| Migrations | Appliquer **088 → 091** sur Supabase (sinon matières / bulletins peuvent échouer) |
| Compte | `demo.ecole@konadata.demo` / `DemoKona2026!` |
| Fichiers test | `docs/exemples-test/liste-eleves-terminale.csv`, `notes-terminale-chimie.csv` |
| Optionnel | Classe **Terminale A**, matières **Chimie** / **Physique** déjà créées |

---

## Message d’ouverture (30 s)

> « KonaData remplace les fichiers dispersés par un seul espace : classes, notes, bulletins PDF et suivi des paiements.  
> Aujourd’hui je vous montre le parcours d’un établissement en **15 minutes**, avec le compte démo.  
> Ce qui n’est pas montré aujourd’hui sera affiné selon vos retours terrain. »

---

## Déroulé minute par minute

### 0:00 – 2:00 · Tableau de bord & vision

| Action | Où |
|--------|-----|
| Connexion | `/login` → compte démo |
| Accueil établissement | `/etablissement` |

**À montrer :**
- KPIs (élèves, paiements, classes)
- Bandeau **bulletins incomplets** ou checklist **démarrage** (si visible)
- Menu latéral : Candidatures, Étudiants, Formations, Résultats, Bulletins, Paiements

**À dire :**
> « Chaque rôle ne voit que ce qui le concerne : le comptable les paiements, l’enseignant ses classes, le directeur tout. »

---

### 2:00 – 4:00 · Formations — catalogue par palier

| Action | Où |
|--------|-----|
| Ouvrir | `/etablissement/formations` |

**À montrer (2 min max, ne pas tout créer) :**
1. Filtre **Palier** (collège / lycée) → périodes trimestres vs semestres
2. **Ajout rapide — classes par palier** (cocher 1–2 modèles → Créer)
3. **Import Excel / CSV** → bouton **Modèle Excel** (montrer le format, pas besoin d’importer)
4. Onglet **Matières** → presets par palier
5. Si le temps : **Modifier** / **Archiver** une ligne

**À dire :**
> « Le palier de la classe pilote automatiquement les trimestres ou semestres pour les notes et bulletins. Plus besoin d’un réglage global unique. »

---

### 4:00 – 5:30 · Assignations enseignants

| Action | Où |
|--------|-----|
| Ouvrir | `/utilisateurs/assignations` |

**À montrer :**
- Regroupement par **palier** (Collège, Lycée…)
- Cocher **classe + matière** pour un enseignant
- Bandeau orange : couples **sans enseignant**
- **Enregistrer** → cases restent cochées après refresh

**À dire :**
> « Un enseignant ne saisit que ce qu’on lui assigne. Un couple classe/matière ne peut être tenu que par un seul prof. »

---

### 5:30 – 7:30 · Inscription des élèves

| Action | Où |
|--------|-----|
| Import | `/etablissement/etudiants/import` |

**À montrer :**
1. Sélectionner classe **Terminale A** (ou une classe existante)
2. Déposer `liste-eleves-terminale.csv` (10 élèves)
3. Aperçu → **Importer**
4. Liste | `/etablissement/etudiants` → fiche élève → onglet **Scolarité** (échéancier)

**À dire :**
> « CSV, Excel ou scan de liste : l’objectif est d’éviter la ressaisie. Les matricules peuvent être générés automatiquement. »

**Plan B :** si import déjà fait, ouvrir une **fiche élève** et montrer historique + solde.

---

### 7:30 – 10:00 · Saisie des notes

| Action | Où |
|--------|-----|
| Ouvrir | `/etablissement/resultats` |

**À montrer :**
1. Filtres **Classe**, **Matière**, **Période** (S1 ou T1 selon le palier)
2. Onglet **Grille** : saisir 2–3 notes (dont un **0** volontaire → « note saisie »)
3. Laisser une case **vide** → expliquer l’alerte directeur au bulletin
4. Onglet **Import** : fichier `notes-terminale-chimie.csv` + **Modèle CSV**

**À dire :**
> « 0/20 = note réelle. Case vide = manquant : le directeur est alerté mais peut publier en provisoire avec confirmation. »

---

### 10:00 – 13:00 · Bulletins (cœur de la démo)

| Action | Où |
|--------|-----|
| Ouvrir | `/etablissement/bulletins` |

**À montrer :**
1. Choisir **classe + période + année**
2. Cocher **types d’évaluation retenus** (Devoir, Composition…)
3. Panneau **Complétude** (palier, période, % notes)
4. **Générer / recalculer (provisoire)**
5. Si notes manquantes → dialogue de confirmation (montrer le principe)
6. **Conseil CSV** (export conseil de classe)
7. Si logo + cachet OK : **PDF** ou **ZIP classe**
8. **Publier définitif + SMS** (expliquer sans forcément envoyer en prod)

**Paramètres (30 s si besoin) :** `/parametres/bulletin` — paliers, types d’évals par défaut, détail par évaluation sur PDF.

**À dire :**
> « Le bulletin reflète exactement les types de notes cochés par le directeur. Provisoire d’abord, définitif quand tout est validé. »

---

### 13:00 – 15:00 · Paiements & parents

| Action | Où |
|--------|-----|
| Paiements | `/etablissement/paiements` |

**À montrer :**
1. KPI recouvrement (impayés, créances, retards)
2. Onglet **Impayés** → filtre par classe → lien fiche élève
3. **Enregistrer un paiement** (guichet) → échéancier sous le formulaire
4. **Export impayés Excel** / encaissements
5. Nouvel onglet : **`/suivi-scolarite`** (sans compte) — matricule + SMS → solde + bulletin PDF

**À dire :**
> « Le comptable travaille sa liste d’impayés chaque matin. Les parents consultent solde et bulletin sans créer de compte. »

---

## Clôture (30 s)

> « En résumé : **catalogue par palier → assignations → notes → bulletins fiables → encaissement → parents informés**.  
> Votre pilote commencera par Formations et Import élèves ; nous accompagnons la montée en charge.  
> Questions ? »

---

## Messages clés (à répéter)

1. **Un palier = bonnes périodes** (trimestres / semestres)
2. **Directeur maîtrise les types de notes** dans le bulletin
3. **0 ≠ vide** — la complétude est transparente
4. **Provisoire puis définitif** — pas de surprise pour les familles
5. **Comptabilité scolarité intégrée** — pas un module séparé

---

## Dépannage rapide pendant la démo

| Symptôme | Cause probable | Solution |
|----------|----------------|----------|
| Liste matières vide | Migration **091** manquante | Appliquer 091, rafraîchir |
| Erreur génération bulletin | Migrations **088–090** | Appliquer 088–090 |
| PDF bloqué | Logo/cachet absents | Paramètres → Modèle bulletin |
| Écran vide sans message | Données non chargées | Bandeau rouge → lire message migrations |
| Enseignant sans notes | Pas d’assignation | Utilisateurs → Assignations |

---

## Variante « 10 min » (si pressé)

Couper : Import Excel formations, Assignations détaillées, Import notes CSV.  
Garder : Dashboard → 1 classe → Résultats (3 notes) → Bulletins → Paiements impayés → Suivi-scolarite.

---

## Variante « atelier 30 min » (après la démo)

Laisser le directeur :
1. Créer une classe via preset
2. Importer 5 élèves
3. Saisir une grille de notes
4. Générer bulletins provisoires
5. Exporter impayés Excel

---

## Ressources liées

- Comptes : `docs/demo-video/SETUP-COMPTES-DEMO.md`
- Fichiers CSV test : `docs/exemples-test/README.md`
- Vidéo marketing 3 min 30 : `docs/demo-video/SCRIPT-DEMO-KONADATA.md`
