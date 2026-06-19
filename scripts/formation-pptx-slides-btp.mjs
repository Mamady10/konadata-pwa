/**
 * Slides formation BTP — titres, captures, parcours.
 * Images : docs/demo-video/captures/
 */
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
export const CAPTURES = path.join(__dir, '..', 'docs', 'demo-video', 'captures');

/** @type {import('./formation-pptx-slides.mjs').FORMATION_SLIDES extends infer T ? T : never} */
export const BTP_FORMATION_SLIDES = [
  {
    kind: 'title',
    title: 'Guide utilisateur KonaData',
    subtitle: 'Secteur BTP — Formation par rôle',
  },
  {
    kind: 'content',
    title: "Vue d'ensemble BTP",
    bullets: [
      { text: 'Chantiers : budget, planning (jalons ou MS Project XML)' },
      { text: 'Personnel : pointage MO + salaires Excel → Finances' },
      { text: 'Terrain : avancement, BL, carburant, stock' },
      { text: 'Finances : budget vs réel par poste (direction)' },
      { text: 'Rapports : semaine / mois / trimestre → PDF & PPTX' },
      { text: 'Chef de chantier : saisie terrain uniquement', bold: true },
    ],
  },
  {
    kind: 'screen',
    title: 'Connexion',
    route: '/login',
    image: '05-login.png',
    bullets: [
      { text: 'Email ou téléphone + WhatsApp' },
      { text: 'Direction : demo.btp@konadata.demo', bold: true },
      { text: 'Chef : demo.chef.btp@konadata.demo', bold: true },
      { text: 'Mot de passe démo : DemoKona2026!' },
    ],
  },
  {
    kind: 'table',
    title: 'Matrice rôle × page',
    headers: ['Page', 'Direction', 'Chef chantier'],
    rows: [
      ['Tableau de bord', '✓ tous', '✓ assignés'],
      ['Chantiers', '✓ créer', '✓ lecture'],
      ['Personnel', '✓', '—'],
      ['Finances', '✓', '—'],
      ['Avancement', '✓ complet', '✓ terrain'],
      ['Bons / Carburant / Stock', '✓', '✓'],
      ['Rapports', '✓ + archive', '✓ compiler'],
      ['Assignations', '✓', '—'],
    ],
  },
  {
    kind: 'screen',
    title: 'Tableau de bord BTP',
    route: '/btp',
    image: '30-btp-dashboard.png',
    bullets: [
      { text: 'KPIs chantiers actifs, avancement, carburant' },
      { text: 'Alertes stock et BL récents' },
      { text: 'Point de départ quotidien direction' },
    ],
  },
  {
    kind: 'steps',
    title: 'Créer un chantier',
    route: '/btp/chantiers',
    image: '31-btp-chantiers.png',
    steps: [
      'Ajouter → Nouveau chantier',
      'Budget total + déjà engagé (opening_spent)',
      'Répartition % MO / Matériaux / Engins / ST / FG',
      'Configurer Ref 1 : jalons ou MS Project XML',
      'Assigner le chef de chantier',
    ],
  },
  {
    kind: 'screen',
    title: 'Assignations',
    route: '/btp/assignations',
    image: '40-btp-assignations.png',
    bullets: [
      { text: 'Utilisateurs → Assignations' },
      { text: 'Cocher chantiers par chef de terrain' },
      { text: 'Enregistrer avant mise en service', bold: true },
    ],
  },
  {
    kind: 'screen',
    title: 'Personnel & MO',
    route: '/btp/personnel',
    image: '32-btp-personnel.png',
    bullets: [
      { text: 'Import Excel salaires → Finances MO' },
      { text: 'Pointage : jours × taux journalier' },
      { text: 'Direction uniquement' },
    ],
  },
  {
    kind: 'screen',
    title: 'Finances — Budget vs réel',
    route: '/btp/finances',
    image: '37-btp-finances.png',
    bullets: [
      { text: 'Postes : MO, Matériaux, Engins, ST, FG' },
      { text: 'opening_spent + dépenses app = total' },
      { text: 'Export CSV · Sous-traitance' },
    ],
  },
  {
    kind: 'steps',
    title: 'Workflow BL',
    route: '/btp/bons',
    image: '36-btp-bons.png',
    steps: [
      'Nouveau BL → brouillon',
      'Lignes articles + montant GNF',
      'Valider le bon → matériaux',
      'Option : mise à jour stock',
    ],
  },
  {
    kind: 'screen',
    title: 'Avancement terrain',
    route: '/btp/avancement',
    image: '38-btp-avancement.png',
    bullets: [
      { text: 'Nouveau relevé : % physique + planning ref' },
      { text: 'Panneau Planifié vs réel' },
      { text: 'Effectif, météo, observations' },
    ],
  },
  {
    kind: 'steps',
    title: 'Rapport périodique MOA',
    route: '/btp/rapports',
    image: '39-btp-rapports.png',
    steps: [
      'Choisir chantier + période (semaine/mois…)',
      'Référence planning + commentaire synthèse',
      'Compiler le rapport',
      'Télécharger PDF ou PPTX',
    ],
  },
  {
    kind: 'screen',
    title: 'Chef de chantier — Routine',
    route: '/btp/avancement',
    image: '42-btp-chef-avancement.png',
    bullets: [
      { text: 'Quotidien : relevé avancement' },
      { text: 'À réception : BL validé' },
      { text: 'Vendredi : rapport semaine → direction', bold: true },
    ],
  },
  {
    kind: 'content',
    title: 'Ressources & support',
    bullets: [
      { text: 'Vidéos : konadata-formation-btp-direction.mp4 & chef.mp4' },
      { text: 'Modèles papier : docs/btp/modeles/' },
      { text: 'Démo live 15 min : SCRIPT-DEMO-PILOTE-BTP-15MIN.md' },
      { text: 'contact@konadatagn.com' },
    ],
  },
];
