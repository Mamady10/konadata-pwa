# Guide utilisateur KonaData — Secteur BTP

**Public :** directeurs d'entreprise BTP, chefs de chantier, formateurs internes  
**Objectif :** former les équipes à l'utilisation de la plateforme par rôle  
**Comptes démo :** voir section 2

---

## 1. Vue d'ensemble

KonaData BTP centralise le pilotage de vos chantiers :

- **Chantiers** : fiche chantier, budget par poste, planning de référence (jalons ou MS Project)
- **Personnel** : effectifs, pointage main d'œuvre, salaires mensuels (import Excel)
- **Terrain** : avancement physique, fiches journalières, carburant, bons de livraison
- **Stocks** : entrées / sorties matériels, alertes seuil
- **Finances** : budget vs réel par poste (MO, matériaux, engins, sous-traitance, frais généraux)
- **Rapports** : compilation périodique (semaine, mois, trimestre, année) → PDF / PPTX
- **Documents** : dépôt et extraction IA des pièces chantier

Chaque utilisateur ne voit que les menus autorisés pour son rôle.

---

## 2. Connexion et comptes démo

### 2.1 Se connecter

| Étape | Action |
|--------|--------|
| 1 | Ouvrir `/login` |
| 2 | Onglet **Email** (ou téléphone + code WhatsApp/SMS) |
| 3 | Saisir identifiants fournis par l'entreprise |
| 4 | Arrivée sur `/btp` ou la page terrain assignée |

### 2.2 Comptes démo (formation)

| Rôle | Email | Mot de passe | Page d'accueil |
|------|-------|--------------|----------------|
| **Direction BTP** | `demo.btp@konadata.demo` | `DemoKona2026!` | `/btp` |
| **Chef de chantier** | `demo.chef.btp@konadata.demo` | `DemoKona2026!` | `/btp/avancement` |

Liste complète tous secteurs : `docs/demo-video/demo-accounts-all.json`

### 2.3 Rôles BTP

| Rôle technique | Libellé | Accès |
|----------------|---------|-------|
| `org_admin` / `deputy_director` | Direction | Module BTP complet |
| `btp_staff` | Chef de chantier / terrain | Chantiers assignés uniquement — **pas** Personnel ni Finances |
| `platform_admin` | Admin KonaData | Toutes les organisations |

### 2.4 Matrice rôle × page

| Page | Direction | Chef de chantier |
|------|:---------:|:----------------:|
| Tableau de bord `/btp` | ✓ (tous chantiers) | ✓ (chantiers assignés) |
| Chantiers | ✓ créer / configurer | ✓ lecture assignés |
| Personnel | ✓ | — |
| Matériels & stock | ✓ | ✓ |
| Carburant | ✓ | ✓ |
| Bons de livraison | ✓ | ✓ |
| Finances | ✓ | — |
| Avancement | ✓ (tous champs) | ✓ (physique / terrain) |
| Documents | ✓ | ✓ (chantiers assignés) |
| Rapports | ✓ + rapports IA | ✓ compiler / transmettre |
| Assignations | ✓ | — |

---

## 3. Direction — Tableau de bord (`/btp`)

**Objectif :** vue consolidée de tous les chantiers actifs.

### Indicateurs affichés

- Nombre de chantiers en cours / en pause
- Avancement physique moyen vs planifié
- Consommation carburant (tendance 13 mois)
- Derniers bons de livraison
- Alertes stock et carburant
- Recommandations KonaAI (directeurs uniquement)

### Boutons et actions

| Élément | Action |
|---------|--------|
| Carte chantier | Ouvre le détail ou les modules liés |
| Menu latéral | Navigation vers tous les modules |
| **Assignations** (menu Utilisateurs) | Lier chefs de chantier aux chantiers |

---

## 4. Chantiers (`/btp/chantiers`)

**Objectif :** créer et paramétrer chaque chantier.

### 4.1 Créer un chantier (direction)

1. Cliquer **Ajouter**
2. Remplir le formulaire **Nouveau chantier** (voir champs ci-dessous)
3. **Enregistrer le chantier**

### 4.2 Fiche chantier (clic sur une carte)

Chaque carte dans **Chantiers** est cliquable → `/btp/chantiers/[id]`

| Onglet | Contenu |
|--------|---------|
| **Informations** | Modifier nom, budget, dates, statut, répartition % (direction) |
| **Documents** | Téléverser et lister les pièces du chantier |
| **Planning** | Références 1 et 2 (jalons, MS Project XML) |
| **Clôture MOA** | Clôturer le chantier + dossier archivé (direction) |

### 4.3 Créer un chantier — champs du formulaire

| Champ | Description |
|-------|-------------|
| Nom du chantier | Ex. « Pont Kaloum » |
| Localisation | Ville / commune |
| Client / MOA | Maître d'ouvrage |
| N° marché / contrat | Référence administrative |
| Date de début / fin | Période contractuelle |
| Budget total (GNF) | Enveloppe globale |
| Déjà engagé au démarrage | Montant déjà dépensé avant KonaData (`opening_spent`) |
| Jalons | Fondations, Gros œuvre, Finitions (par défaut) |
| Répartition budgétaire % | MO, Matériaux, Engins, Sous-traitance, Frais généraux |
| Seuil alerte budget % | Déclenche une alerte visuelle |
| Effectif moyen prévu / jour | Pour comparaison terrain |
| Carburant prévu (L/mois) | Pour suivi consommation |

3. **Enregistrer le chantier**

> **Important — `opening_spent` :** ce montant représente les dépenses déjà engagées avant la saisie dans KonaData. Il s'ajoute aux dépenses enregistrées dans l'app pour le total financier. Ne pas ressaisir ces montants en double dans les dépenses.

### 4.4 Clôturer un chantier (direction)

1. Ouvrir la fiche chantier → onglet **Clôture MOA**
2. Choisir la référence planning pour le rapport final
3. Saisir le **commentaire de clôture / réception MOA**
4. Cliquer **Clôturer le chantier**

KonaData génère automatiquement :
- un **rapport de synthèse** (période complète du chantier)
- la **liste des documents** téléversés
- le passage du statut en **Terminé**
- l'**archivage** du dossier dans Rapports (type « Dossier de clôture »)

**Migration Supabase 105** requise en production (`completed_at`, `closure_report_id`).

Pour modifier à nouveau un chantier clôturé : bouton **Rouvrir le chantier** (direction).

### 4.5 Références de planning (Ref 1 et Ref 2)

Sur chaque carte chantier, configurer **Ref 1** et/ou **Ref 2** :

| Type | Usage |
|------|-------|
| **Dates début/fin** (linéaire) | Courbe planifiée simple |
| **Jalons KonaData** | Jalons avec % physique et dates |
| **Import MS Project (XML)** | Planning détaillé exporté depuis MS Project |

**MS Project :** Fichier → Exporter → Enregistrer sous → **XML** → déposer dans KonaData → **Importer ce fichier**.

Badge **« MS Project · N tâches »** = planning actif.

**Référence par défaut (saisie)** : choisir quelle référence est utilisée par défaut dans Avancement et Rapports.

### 4.6 Statuts chantier

| Statut | Signification |
|--------|---------------|
| Planification | Pas encore démarré |
| En cours | Actif |
| En pause | Arrêt temporaire |
| Terminé | Clôturé |
| Annulé | Abandonné |

---

## 5. Assignations (`/btp/assignations`)

**Objectif :** lier chaque chef de chantier (`btp_staff`) aux chantiers qu'il gère.

1. Menu **Utilisateurs** → **Assignations**
2. Pour chaque collaborateur terrain, cocher les chantiers
3. **Enregistrer**

Sans assignation, le chef de chantier voit un bandeau d'avertissement et ne peut pas saisir sur ce chantier.

---

## 6. Personnel (`/btp/personnel`) — direction uniquement

**Objectif :** gérer les effectifs et alimenter la main d'œuvre en finances.

### 6.1 Ajout manuel

| Champ | Rôle |
|-------|------|
| Nom | Identité |
| Fonction / rôle | Ex. Maçon, Chef d'équipe |
| Téléphone | Contact |
| Salaire mensuel (GNF) | Pour cumul paie YTD en finances |
| Taux journalier (GNF) | Pour pointage jours × taux |
| Chantier assigné | Affectation principale |

### 6.2 Import Excel (direction)

1. **Modèle Excel** → télécharger le format
2. Colonnes : Nom, Salaire mensuel, Fonction
3. **Importer Excel** → choisir le chantier pour la paie → **Confirmer**

Les salaires mensuels alimentent automatiquement le poste **Main d'œuvre** en Finances (cumul depuis janvier, mois en cours proratisé).

### 6.3 Pointage main d'œuvre

| Champ | Calcul |
|-------|--------|
| Chantier | Où la MO est imputée |
| Collaborateur | Fiche personnel |
| Date | Jour travaillé |
| Nombre de jours | Ex. 1 ou 0,5 |
| Montant | = jours × taux journalier |

### 6.4 Retirer / Réactiver

Un collaborateur **Retiré** n'apparaît plus dans les listes actives mais l'historique est conservé.

---

## 7. Avancement (`/btp/avancement`)

**Objectif :** saisir l'avancement terrain (fiche journalière).

### 7.1 Nouveau relevé

1. **Saisir l'avancement** → **Nouveau relevé d'avancement**
2. Remplir :

| Champ | Qui |
|-------|-----|
| Chantier | Tous |
| Date du relevé | Tous |
| Avancement physique (%) | Tous |
| Référence planning (1 ou 2) | Tous — compare au planifié |
| Effectif sur chantier | Tous |
| Météo | Tous |
| Observations | Tous |
| Avancement financier (%) | Direction uniquement |
| Retard (jours) | Direction uniquement |

3. Le panneau **Planifié vs réel** affiche : Conforme / Vigilance / Alerte
4. **Enregistrer**

### 7.2 Historique

Table **Historique des relevés** : filtrer par chantier, consulter les saisies passées.

---

## 8. Bons de livraison (`/btp/bons`)

**Objectif :** tracer les réceptions fournisseurs et alimenter matériaux + stock.

### Workflow BL

```
Brouillon → Valider → (optionnel) mise à jour stock
```

| Étape | Bouton | Effet |
|-------|--------|-------|
| 1 | **Nouveau BL** | Formulaire brouillon |
| 2 | **Enregistrer en brouillon** | Statut « Brouillon » |
| 3 | **Valider le bon** | Statut « Validé » — montant compté en matériaux |
| Option | **Ajouter les quantités au stock à la validation** | Entrée stock automatique |

### Champs principaux

- Référence BL, Fournisseur, Date livraison
- Montant total (GNF), Catégorie (Matériaux, Équipement, Consommables…)
- Lignes : Article, Qté reçue, Unité
- Lien document scanné (optionnel, depuis Documents)

---

## 9. Carburant (`/btp/carburant`)

**Objectif :** enregistrer les relevés de consommation par chantier.

| Champ | Description |
|-------|-------------|
| Chantier | Affectation |
| Date | Jour du relevé |
| Litres | Quantité |
| Équipement / engin | Référence matériel |
| Observations | Anomalie, panne… |

Les montants carburant alimentent le poste **Engins & équipement** en Finances.

---

## 10. Matériels & stock (`/btp/materiels`)

**Objectif :** suivre le stock chantier et les mouvements.

| Action | Bouton |
|--------|--------|
| Entrée stock | **Entrée stock** |
| Sortie stock | **Sortie stock** |
| Export | **Export CSV** |

Statuts : **OK**, **Alerte**, **Critique** (selon seuil).

---

## 11. Finances (`/btp/finances`) — direction uniquement

**Objectif :** piloter le budget vs réel par poste.

### 11.1 Calcul des postes

| Poste | Sources dans KonaData |
|-------|----------------------|
| **Main d'œuvre** | Pointages (jours × taux) + salaires mensuels importés + dépenses MO manuelles |
| **Matériaux** | BL validés + dépenses catégorie matériaux |
| **Engins & équipement** | Carburant + dépenses équipement |
| **Sous-traitance** | Contrats + paiements sous-traitants |
| **Frais généraux** | Dépenses diverses |
| **Total** | `opening_spent` + tous les postes |

**% financier** = Total dépensé / Budget total × 100

### 11.2 Onglets

| Onglet | Contenu |
|--------|---------|
| **Par chantier** | Barre budget, détail MO/Matériaux/Équipement, tableau **Budget vs réel par poste** |
| **Dépenses récentes** | Liste chronologique |
| **Sous-traitance** | Contrats et paiements |

### 11.3 Actions

- **Dépense** : saisie manuelle catégorisée
- **Export CSV** : export comptable
- **Sous-traitance** : nouveau contrat + **Enregistrer paiement**

---

## 12. Documents (`/btp/documents`)

**Objectif :** centraliser les pièces chantier (BL scannés, rapports MOA, plans…).

1. Choisir le chantier
2. **Téléverser** ou photographier le document
3. KonaAI peut extraire le texte (factures, BL)
4. Filtrer par catégorie / statut

Les documents peuvent être liés aux bons de livraison.

---

## 13. Rapports (`/btp/rapports`)

**Objectif :** produire le rapport périodique chantier pour la MOA.

### 13.1 Rapport périodique chantier

1. Sélectionner le **chantier**
2. Choisir la **période** : Semaine / Mois / Trimestre / Année
3. Choisir la **référence planning** (Ref 1 ou 2)
4. **Commentaire de synthèse** (optionnel) : risques, demandes MOA, décisions
5. **Compiler le rapport**
6. Exporter : **Télécharger PDF** ou **Télécharger PPTX**

Le rapport compile : fiches journalières, carburant, BL, avancement planifié vs réel, postes budgétaires.

**Direction :** archivage automatique dans l'historique.  
**Chef de chantier :** transmettre le fichier PDF/PPTX à la direction.

### 13.2 Rapports IA (direction)

Panneau complémentaire : Rapport général, Carburant, Bons de livraison, Avancement terrain, Stocks.

### 13.3 Modèles papier

Modèles HTML imprimables : `docs/btp/modeles/` (fiche journalière, BL, rapport hebdo, rapport mensuel…).

---

## 14. Parcours métier — scénarios types

### 14.1 Démarrage d'un nouveau chantier (direction)

1. Créer le chantier avec budget et répartition %
2. Configurer Ref 1 (jalons ou MS Project)
3. Assigner le chef de chantier
4. Importer le personnel et les salaires si existants
5. Saisir `opening_spent` si reprise en cours de chantier

### 14.2 Semaine terrain (chef de chantier)

1. Lundi : relevé avancement + effectif
2. À chaque livraison : créer BL → valider
3. Chaque soir : relevé carburant si engins actifs
4. Vendredi : **Compiler le rapport** semaine → envoyer à la direction

### 14.3 Revue mensuelle (direction)

1. Consulter **Finances** → écarts par poste
2. Vérifier BL non validés
3. Compiler rapport **Mois** pour chaque chantier actif
4. Exporter PDF pour MOA

---

## 15. Erreurs fréquentes

| Message / symptôme | Cause | Solution |
|--------------------|-------|----------|
| Chantier introuvable | Mauvaise org ou chantier archivé | Vérifier le compte et le statut |
| `resolvePlanningRef is not defined` | Bug corrigé — mettre à jour l'app | Déployer la dernière version |
| % financier > 100 % | Budget sous-estimé ou double comptage | Vérifier `opening_spent` + dépenses |
| Chef sans chantier | Pas d'assignation | Direction → Assignations |
| Rapport vide | Période sans saisies | Saisir avancement / BL / carburant sur la période |
| MS Project refusé | Fichier .mpp natif | Exporter en **XML** depuis MS Project |

---

## 16. Support et ressources

| Ressource | Emplacement |
|-----------|-------------|
| Vidéos formation par rôle | `docs/formation/training/output/konadata-formation-btp-*.mp4` |
| Script démo live 15 min | `docs/demo-video/SCRIPT-DEMO-PILOTE-BTP-15MIN.md` |
| Comptes démo | `docs/demo-video/demo-accounts-all.json` |
| Modèles imprimables | `docs/btp/modeles/` |
| Support | contact@konadatagn.com |

---

*KonaData — Guide BTP v1 — Juin 2026*
