/**
 * Définition des slides formation — titres, captures, boutons, parcours.
 * Images : docs/demo-video/captures/
 */
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
export const CAPTURES = path.join(__dir, '..', 'docs', 'demo-video', 'captures');

/** @typedef {{ text: string; bold?: boolean }} Bullet */
/** @typedef {{
 *   kind: 'title' | 'content' | 'screen' | 'table' | 'steps';
 *   title: string;
 *   subtitle?: string;
 *   route?: string;
 *   image?: string;
 *   bullets?: Bullet[];
 *   steps?: string[];
 *   headers?: string[];
 *   rows?: string[][];
 * }} FormationSlide */

/** @type {FormationSlide[]} */
export const FORMATION_SLIDES = [
  {
    kind: 'title',
    title: 'Guide utilisateur KonaData',
    subtitle: 'Établissements scolaires — Formation par rôle',
  },
  {
    kind: 'content',
    title: "Vue d'ensemble",
    bullets: [
      { text: 'Catalogue : classes et matières par palier (collège / lycée)' },
      { text: 'Inscriptions : candidatures, import élèves, dossiers' },
      { text: 'Notes : saisie enseignant, import CSV' },
      { text: 'Bulletins : PDF provisoire → définitif + SMS' },
      { text: 'Paiements : encaissements, impayés, export Excel' },
      { text: 'Parents : portail public /suivi-scolarite (sans compte)' },
      { text: 'Chaque rôle ne voit que les menus autorisés', bold: true },
    ],
  },
  {
    kind: 'screen',
    title: 'Connexion',
    route: '/login',
    image: '05-login.png',
    bullets: [
      { text: 'Onglet Email ou Téléphone + SMS' },
      { text: 'Saisir identifiants fournis par l\'établissement' },
      { text: 'Redirection vers /dashboard puis module métier' },
      { text: 'Démo : demo.ecole@konadata.demo / DemoKona2026!', bold: true },
    ],
  },
  {
    kind: 'table',
    title: 'Rôles établissement',
    headers: ['Rôle', 'Interface', 'Accès principal'],
    rows: [
      ['Direction', 'org_admin / deputy_director', 'Tout le module'],
      ['Scolarité', 'registrar', 'Inscriptions, élèves, catalogue'],
      ['Comptable', 'accountant', 'Paiements, impayés, effectifs'],
      ['Enseignant', 'teacher', 'Classes assignées, notes'],
      ['Élève', 'student', 'Inscription, mon bulletin'],
      ['Candidat', 'candidate', 'Demande d\'inscription'],
      ['Parent', '(sans compte)', '/suivi-scolarite'],
    ],
  },
  {
    kind: 'table',
    title: 'Matrice rôle × page',
    headers: ['Page', 'Dir.', 'Scol.', 'Compt.', 'Ens.', 'Élève', 'Cand.'],
    rows: [
      ['Tableau de bord', '✓', '✓', '✓', '✓', '✓', '✓'],
      ['Candidatures', '✓', '✓', '✓', '—', '✓', '✓'],
      ['Étudiants', '✓', '✓', 'lecture', '—', '—', '—'],
      ['Formations', '✓', '✓', 'lecture', 'assigné', '—', '—'],
      ['Résultats', '✓', '—', '—', 'assigné', '—', '—'],
      ['Bulletins', '✓', '—', '—', '—', '✓', '—'],
      ['Paiements', '✓', '✓', '✓', '—', '—', '—'],
      ['Assignations', '✓', '—', '—', '—', '—', '—'],
    ],
  },
  {
    kind: 'screen',
    title: 'Tableau de bord — Direction',
    route: '/etablissement',
    image: '09-school-dashboard.png',
    bullets: [
      { text: 'KPIs : effectifs, paiements, classes' },
      { text: 'Bandeau bulletins incomplets / checklist démarrage' },
      { text: 'Menu : Candidatures, Étudiants, Formations…' },
      { text: 'Cartes statistiques cliquables → modules' },
    ],
  },
  {
    kind: 'screen',
    title: 'Formations — Catalogue',
    route: '/etablissement/formations',
    image: '16-school-formations.png',
    bullets: [
      { text: 'Onglet Classes : filtre Palier (trimestres / semestres)' },
      { text: 'Bouton Ajout rapide → cocher modèles → Créer' },
      { text: 'Import Excel / CSV + Modèle Excel' },
      { text: 'Modifier / Archiver sur chaque ligne' },
      { text: 'Onglet Matières : presets par palier', bold: true },
    ],
  },
  {
    kind: 'screen',
    title: 'Assignations enseignants',
    route: '/utilisateurs/assignations',
    image: '17-school-assignations.png',
    bullets: [
      { text: 'Regroupement par palier (Collège, Lycée…)' },
      { text: 'Cocher classe + matière pour chaque enseignant' },
      { text: 'Bandeau orange : couples sans enseignant' },
      { text: 'Bouton Enregistrer — 1 seul prof par couple', bold: true },
    ],
  },
  {
    kind: 'screen',
    title: 'Candidatures',
    route: '/etablissement/candidatures',
    image: '14-school-candidatures.png',
    bullets: [
      { text: 'Statuts : nouveau, en cours, validé, refusé' },
      { text: 'Ouvrir dossier → pièces jointes' },
      { text: 'Boutons Valider / Refuser' },
      { text: 'SMS de confirmation possible' },
    ],
  },
  {
    kind: 'screen',
    title: 'Liste des étudiants',
    route: '/etablissement/etudiants',
    image: '10-school-etudiants.png',
    bullets: [
      { text: 'Recherche par nom ou matricule' },
      { text: 'Filtre par classe' },
      { text: 'Bouton Nouvel élève' },
      { text: 'Bouton Import → /etablissement/etudiants/import' },
      { text: 'Fiche : onglet Scolarité (échéancier)', bold: true },
    ],
  },
  {
    kind: 'screen',
    title: 'Import élèves',
    route: '/etablissement/etudiants/import',
    image: '11-school-import-ia.png',
    steps: [
      'Choisir la classe cible',
      'Déposer CSV, Excel ou photo (KonaAI)',
      'Vérifier l\'aperçu',
      'Cliquer Importer',
      'Matricules auto si colonne absente',
    ],
  },
  {
    kind: 'screen',
    title: 'Saisie des notes',
    route: '/etablissement/resultats',
    image: '12-school-resultats.png',
    bullets: [
      { text: 'Filtres : Classe, Matière, Période' },
      { text: 'Onglet Grille : saisie directe' },
      { text: 'Onglet Import : CSV + Modèle CSV' },
      { text: '0/20 = note saisie', bold: true },
      { text: 'Case vide = manquant → alerte bulletin', bold: true },
    ],
  },
  {
    kind: 'screen',
    title: 'Bulletins',
    route: '/etablissement/bulletins',
    image: '13-school-bulletins.png',
    steps: [
      'Choisir classe + période + année',
      'Cocher types d\'évaluation retenus',
      'Consulter panneau Complétude',
      'Générer / recalculer (provisoire)',
      'Conseil CSV · PDF · ZIP classe',
      'Publier définitif + SMS',
    ],
  },
  {
    kind: 'content',
    title: 'Paramètres bulletin',
    route: '/parametres/bulletin',
    bullets: [
      { text: 'Logo et cachet (obligatoires pour PDF)' },
      { text: 'Paliers et périodes par défaut' },
      { text: 'Types d\'évaluations cochés par défaut' },
      { text: 'Affichage détail par évaluation sur PDF' },
    ],
  },
  {
    kind: 'screen',
    title: 'Paiements & impayés',
    route: '/etablissement/paiements',
    image: '18-school-paiements.png',
    bullets: [
      { text: 'KPI recouvrement : impayés, créances, retards' },
      { text: 'Onglet Encaissements → Enregistrer un paiement' },
      { text: 'Onglet Impayés → filtre par classe' },
      { text: 'Export Excel impayés / encaissements', bold: true },
    ],
  },
  {
    kind: 'content',
    title: 'Rôle Scolarité (registrar)',
    bullets: [
      { text: 'Traiter candidatures et dossiers inscription' },
      { text: 'Importer et mettre à jour les élèves' },
      { text: 'Maintenir catalogue classes / matières' },
      { text: 'Suivre paiements par classe' },
      { text: 'Ne génère pas les bulletins (direction)' },
      { text: 'Encaissement si paramètre activé', bold: true },
    ],
  },
  {
    kind: 'content',
    title: 'Rôle Comptable (accountant)',
    bullets: [
      { text: 'Routine : onglet Impayés chaque matin' },
      { text: 'Filtrer par classe → lien fiche élève' },
      { text: 'Enregistrer un paiement au guichet' },
      { text: 'Exporter impayés Excel pour reporting' },
      { text: 'Effectifs élèves et Classes : lecture seule' },
      { text: 'Dossiers inscription : vérification pièces', bold: true },
    ],
  },
  {
    kind: 'content',
    title: 'Rôle Enseignant (teacher)',
    bullets: [
      { text: 'Mon espace enseignant — pas de KPI global' },
      { text: 'Mes classes : formations (assignations uniquement)' },
      { text: 'Résultats : grille ou import CSV' },
      { text: 'Filtres classe + matière + période assignées' },
      { text: 'Si aucune classe : vérifier assignations (direction)', bold: true },
    ],
  },
  {
    kind: 'content',
    title: 'Élève & Candidat',
    bullets: [
      { text: 'Élève : Mon inscription + Mon bulletin (définitif)' },
      { text: 'Élève : réinscription et dépôt de pièces' },
      { text: 'Candidat : formulaire demande d\'inscription' },
      { text: 'Candidat : téléversement acte naissance, photos…' },
      { text: 'Suivi statut jusqu\'à validation scolarité', bold: true },
    ],
  },
  {
    kind: 'screen',
    title: 'Portail parents',
    route: '/suivi-scolarite',
    image: '19-suivi-scolarite.png',
    steps: [
      'Saisir le matricule de l\'élève',
      'Recevoir code par SMS',
      'Consulter solde des frais',
      'Télécharger bulletin PDF (si définitif)',
    ],
  },
  {
    kind: 'table',
    title: 'Règles métier essentielles',
    headers: ['Sujet', 'Règle'],
    rows: [
      ['Paliers', 'Collège = trimestres · Lycée = semestres'],
      ['Note 0', 'Zéro = note saisie (pas un manquant)'],
      ['Case vide', 'Manquant → alerte, provisoire possible'],
      ['Types évals', 'Seuls les types cochés → moyenne & PDF'],
      ['Bulletins', 'Provisoire → Définitif + SMS'],
      ['Assignations', '1 seul enseignant par classe/matière'],
      ['PDF', 'Bloqué sans logo et cachet'],
    ],
  },
  {
    kind: 'steps',
    title: 'Atelier formation 30 min',
    steps: [
      '5 min — Connexion, tableau de bord, rôles',
      '5 min — Formations : créer classe via preset',
      '5 min — Import 5 élèves (CSV test)',
      '5 min — Assigner un enseignant',
      '5 min — Saisir grille de notes',
      '5 min — Bulletins provisoires + impayés',
    ],
  },
  {
    kind: 'table',
    title: 'Dépannage (FAQ)',
    headers: ['Symptôme', 'Solution'],
    rows: [
      ['Matières vides', 'Migration 091 + rafraîchir'],
      ['Erreur bulletin', 'Migrations 088 → 090'],
      ['PDF bloqué', '/parametres/bulletin logo + cachet'],
      ['Écran vide', 'Lire bandeau rouge migrations'],
      ['Ens. sans notes', '/utilisateurs/assignations'],
      ['Parent sans bulletin', 'Publier définitif (direction)'],
    ],
  },
  {
    kind: 'content',
    title: 'Ressources & support',
    bullets: [
      { text: 'Vidéo formation : docs/demo-video/output/konadata-formation-ecole.mp4' },
      { text: 'Script démo 15 min : SCRIPT-DEMO-PILOTE-ECOLE-15MIN.md' },
      { text: 'Fichiers test : docs/exemples-test/' },
      { text: 'konadatagn.com · contact@konadatagn.com', bold: true },
    ],
  },
];
