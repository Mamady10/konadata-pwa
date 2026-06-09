/** Textes de la page d'accueil publique — modifiables sans toucher au layout. */

import { LANDING_LINKS } from '@/lib/marketing/landing-links';

export const LANDING_BRAND = {
  name: 'KonaData',
  logoAccent: 'KONA',
  logoRest: 'DATA',
  heroPrefix: 'La plateforme intelligente de',
  heroHighlight: 'gestion de données',
  heroSuffix: 'au service de votre organisation',
  description:
    'Collectez, analysez et valorisez vos données — écoles, ONG, chantiers BTP et PME. Pensée pour le terrain et les réseaux mobiles.',
};

export const LANDING_HERO_PILLS = [
  { label: 'Sécurité cloud', icon: 'shield' as const },
  { label: 'Multi-secteur', icon: 'layers' as const },
  { label: 'IA connectée', icon: 'sparkles' as const },
  { label: 'PWA terrain', icon: 'wifi' as const },
] as const;

export const LANDING_TRUST_PARTNERS = [
  'UNICEF',
  'Orange Money',
  'Min. Éducation',
  'Bailleurs',
  'ONG locales',
  'Entreprises BTP',
] as const;

export const LANDING_SECTORS = [
  {
    id: 'school',
    title: 'Établissements',
    description:
      'Inscriptions, notes, bulletins et finances par classe. Modèles IA pour vos documents officiels.',
    iconBg: 'bg-blue-600',
    href: LANDING_LINKS.registerOrganization,
  },
  {
    id: 'ngo',
    title: 'ONG',
    description:
      'Projets, bénéficiaires, cartographie et rapports bailleurs — ou lancez un sondage seul sans abonnement complet.',
    iconBg: 'bg-teal-500',
    href: LANDING_LINKS.registerSurveyOnly,
  },
  {
    id: 'btp',
    title: 'BTP & Industrie',
    description:
      'Chantiers, carburant, bons de livraison, stocks et rapports IA par site.',
    iconBg: 'bg-amber-500',
    href: LANDING_LINKS.registerOrganization,
  },
  {
    id: 'pme',
    title: 'PME & Commerce',
    description:
      'Ventes, stocks et fournisseurs — module en déploiement pour votre gestion quotidienne.',
    iconBg: 'bg-violet-600',
    href: LANDING_LINKS.registerOrganization,
  },
] as const;

export const LANDING_AI_STRIP = [
  { title: 'Automatisation', icon: 'zap' as const },
  { title: 'Analyse prédictive', icon: 'trending' as const },
  { title: 'OCR documents', icon: 'scan' as const },
  { title: 'Rapports automatiques', icon: 'file' as const },
] as const;

export const LANDING_FEATURES = [
  {
    title: 'Rapports IA archivés',
    description:
      'Synthèses par chantier, projet ou classe — archivage, copie, export et impression PDF.',
  },
  {
    title: 'Modèles de documents',
    description:
      'Un exemple par type de livrable : l’équipe reçoit des consignes à chaque dépôt.',
  },
  {
    title: 'Rôles & assignations',
    description:
      'Chaque collaborateur ne voit que son périmètre. Tableaux de bord sans données fictives.',
  },
  {
    title: 'PWA & hors-ligne',
    description:
      'Installable sur mobile, cache 3G/4G et envoi des formulaires à la reconnexion.',
  },
] as const;

export const LANDING_STEPS = [
  {
    step: '1',
    title: 'Créer ou rejoindre',
    description:
      'La direction crée l’organisation ; les équipes rejoignent avec un code d’invitation.',
  },
  {
    step: '2',
    title: 'Se connecter',
    description: 'Espace sécurisé par secteur — navigateur ou application installée.',
  },
  {
    step: '3',
    title: 'Piloter & diffuser',
    description: 'Saisie, documents, rapports IA et diffusion vers vos partenaires.',
  },
] as const;
