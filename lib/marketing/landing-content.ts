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
    iconBg: 'bg-gradient-to-br from-blue-500 to-blue-700',
    cardBg: 'bg-gradient-to-br from-blue-50/90 via-white to-sky-50/60',
    cardBorder: 'border-blue-200/70',
    accent: 'text-blue-600',
    href: LANDING_LINKS.registerOrganization,
  },
  {
    id: 'ngo',
    title: 'ONG',
    description:
      'Projets, bénéficiaires, cartographie et rapports bailleurs — ou lancez un sondage seul sans abonnement complet.',
    iconBg: 'bg-gradient-to-br from-teal-400 to-emerald-600',
    cardBg: 'bg-gradient-to-br from-teal-50/90 via-white to-emerald-50/50',
    cardBorder: 'border-teal-200/70',
    accent: 'text-teal-600',
    href: LANDING_LINKS.registerSurveyOnly,
  },
  {
    id: 'btp',
    title: 'BTP & Industrie',
    description:
      'Chantiers, carburant, bons de livraison, stocks et rapports IA par site.',
    iconBg: 'bg-gradient-to-br from-amber-400 to-orange-600',
    cardBg: 'bg-gradient-to-br from-amber-50/90 via-white to-orange-50/50',
    cardBorder: 'border-amber-200/70',
    accent: 'text-amber-600',
    href: LANDING_LINKS.registerOrganization,
  },
  {
    id: 'pme',
    title: 'PME & Commerce',
    description:
      'Ventes, stocks et fournisseurs — module en déploiement pour votre gestion quotidienne.',
    iconBg: 'bg-gradient-to-br from-violet-500 to-purple-700',
    cardBg: 'bg-gradient-to-br from-violet-50/90 via-white to-purple-50/50',
    cardBorder: 'border-violet-200/70',
    accent: 'text-violet-600',
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
    iconBg: 'bg-cyan-100',
    iconColor: 'text-cyan-600',
  },
  {
    title: 'Modèles de documents',
    description:
      'Un exemple par type de livrable : l’équipe reçoit des consignes à chaque dépôt.',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
  },
  {
    title: 'Rôles & assignations',
    description:
      'Chaque collaborateur ne voit que son périmètre. Tableaux de bord sans données fictives.',
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-600',
  },
  {
    title: 'PWA & hors-ligne',
    description:
      'Installable sur mobile, cache 3G/4G et envoi des formulaires à la reconnexion.',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
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
