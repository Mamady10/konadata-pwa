# Fichiers de test — Terminale (10 élèves)

Exemples pour tester l’inscription par import et la saisie de notes **Chimie** + **Physique**.

## Prérequis

1. Créer la classe **Terminale A** (ou **Terminale**) dans l’établissement, année `2025-2026`.
2. Créer les matières **Chimie** et **Physique** dans **Formations** (catalogue matières), si elles n’existent pas encore.

## 1. Liste d’élèves (inscription)

**Fichiers :**

- `liste-eleves-terminale.csv` — import direct (recommandé)
- `liste-eleves-terminale.pdf` — test extraction PDF / KonaAI Vision

| Étape | Où |
|--------|-----|
| Import | **Établissement → Étudiants → Importer** (`/etablissement/etudiants/import`) |
| Classe | Sélectionner **Terminale A** |
| Statut | **Inscrit** (`enrolled`) |
| Fichier | Déposer le CSV ou le PDF |

**PDF :** couche texte (pas une photo) — l’aperçu doit montrer ~10 élèves avec matricules `TER-26-001` … `TER-26-010`. Si l’extraction locale échoue, KonaAI Vision prend le relais (si activé).

Les matricules `TER-26-001` … `TER-26-010` sont déjà renseignés (vous pouvez aussi laisser KonaData les générer en vidant la colonne matricule).

Après import, la liste apparaît dans **Étudiants** filtrée sur la classe Terminale.

## 2. Notes — deux matières en un fichier (capture)

**Fichier :** `notes-terminale-chimie-physique.csv`

| Étape | Où |
|--------|-----|
| Upload | **Établissement → Rapports** → capture **Relevé de notes (grille)** |
| Classe | **Terminale A** |
| Évaluation | Semestre **S1**, type **Devoir**, année **2025-2026** |
| Action | **Enregistrer les notes** |

Colonnes : `nom`, `code_eleve` (matricule), `chimie`, `physique` — notes sur 20.

## 3. Notes — une matière à la fois (import Résultats)

Alternative si vous préférez l’onglet **Import** des résultats :

| Fichier | Matière à choisir dans le sélecteur |
|---------|-------------------------------------|
| `notes-terminale-chimie.csv` | Chimie |
| `notes-terminale-physique.csv` | Physique |

**Où :** **Établissement → Résultats** → onglet **Import** — format `matricule;nom;note;sur`.

## Vérification

- **Résultats** : grille par matière
- **Bulletins** : génération auto si seuil atteint (≥ 60 % des notes saisies)
