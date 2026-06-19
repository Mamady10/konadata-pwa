# Script démo pilote — Secteur BTP (15 min)

**Public :** directeurs d'entreprise BTP, chefs de chantier, MOA / bailleurs  
**Objectif :** montrer le pilotage chantier de bout en bout — planning, terrain, finances, rapport MOA  
**Durée :** 15 minutes (+ 3 min questions)

---

## Avant la démo (hors présentation)

| Étape | Détail |
|--------|--------|
| Lancer l'app | `npm run dev` → http://localhost:3000 |
| Migrations | BTP **100 → 104** appliquées sur Supabase |
| Compte direction | `demo.btp@konadata.demo` / `DemoKona2026!` |
| Compte chef | `demo.chef.btp@konadata.demo` / `DemoKona2026!` |
| Seed chef | `npm run seed:demo-btp-chef` (assignation Pont Kaloum) |

---

## Message d'ouverture (30 s)

> « KonaData remplace les fichiers Excel dispersés par un pilotage chantier unique : avancement, BL, carburant, finances et rapports MOA.  
> En **15 minutes**, je vous montre le parcours direction puis terrain, avec les comptes démo. »

---

## Déroulé minute par minute

### 0:00 – 2:00 · Tableau de bord direction

| Action | Où |
|--------|-----|
| Connexion | `/login` → `demo.btp@konadata.demo` |
| Dashboard | `/btp` |

**À montrer :**
- Chantiers actifs, avancement moyen
- Graphique carburant, derniers BL
- Menu : Chantiers → Finances → Rapports

**À dire :**
> « La direction voit tous les chantiers. Le chef de chantier ne voit que ceux qui lui sont assignés. »

---

### 2:00 – 5:00 · Chantiers & planning

| Action | Où |
|--------|-----|
| Ouvrir | `/btp/chantiers` |

**À montrer (ne pas tout créer si le temps manque) :**
1. Carte chantier existant (Pont Kaloum)
2. **Ref 1** → type planning (jalons ou MS Project XML)
3. Budget, répartition % par poste
4. Badge **MS Project · N tâches** si import fait
5. Optionnel : **Ajouter** → aperçu formulaire nouveau chantier

**À dire :**
> « Le % planifié vient du planning — pas d'une estimation au doigt. MS Project s'importe en XML. »

---

### 5:00 – 6:30 · Assignations

| Action | Où |
|--------|-----|
| Ouvrir | `/btp/assignations` |

**À montrer :**
- Mamadou DIALLO assigné au Pont Kaloum
- Cocher / décocher un chantier

---

### 6:30 – 8:30 · Finances (direction)

| Action | Où |
|--------|-----|
| Ouvrir | `/btp/finances` |

**À montrer :**
- Barre budget / % financier
- Tableau **Budget vs réel par poste**
- Expliquer `opening_spent` (déjà engagé au démarrage)

**À dire :**
> « La MO vient du pointage + salaires Excel. Les matériaux des BL validés. Pas de double saisie si opening_spent est renseigné. »

---

### 8:30 – 10:30 · Terrain (basculer compte chef)

| Action | Où |
|--------|-----|
| Déconnexion → connexion chef | `demo.chef.btp@konadata.demo` |
| Avancement | `/btp/avancement` |

**À montrer :**
1. **Nouveau relevé** : % physique, référence planning
2. Panneau **Planifié vs réel** (Conforme / Alerte)
3. `/btp/bons` → BL brouillon → **Valider**
4. `/btp/carburant` → relevé rapide

---

### 10:30 – 13:00 · Rapport périodique MOA

| Action | Où |
|--------|-----|
| Ouvrir | `/btp/rapports` |

**À montrer :**
1. Sélecteur période : **Semaine** / Mois / Trimestre
2. Référence planning + commentaire synthèse
3. **Compiler le rapport**
4. **Télécharger PDF** ou PPTX

**À dire :**
> « Chaque vendredi, le chef compile et envoie à la direction. La direction archive pour la MOA. »

---

### 13:00 – 15:00 · Synthèse & ressources

**À récapituler :**

| Rôle | Fait | Ne fait pas |
|------|------|-------------|
| Direction | Budget, personnel, finances, validation | Saisie quotidienne terrain |
| Chef | Avancement, BL, carburant, rapport hebdo | Finances, salaires |

**Ressources à distribuer :**
- Guide PDF : `docs/formation/output-btp/GUIDE-UTILISATEUR-KONADATA-BTP.pdf`
- Vidéos : `konadata-formation-btp-direction.mp4` + `konadata-formation-btp-chef.mp4`
- Modèles papier : `docs/btp/modeles/`

---

## Questions fréquentes

| Question | Réponse courte |
|----------|----------------|
| Fichier .mpp MS Project ? | Exporter en **XML** depuis MS Project |
| Double comptage budget ? | Vérifier `opening_spent` vs dépenses saisies |
| Chef ne voit pas le chantier ? | Direction → Assignations |
| Rapport vide ? | Saisir avancement / BL sur la période choisie |

---

*KonaData — Script démo BTP — Juin 2026*
