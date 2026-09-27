/**
 * Contenus de la campagne KonaData (visuels + vidéos).
 * Les offres reprennent lib/marketing/landing-content.ts : à garder alignées.
 */

export const CONTACT = {
  site: 'www.konadatagn.com',
  url: 'https://www.konadatagn.com',
  whatsapp: '+224 628 36 04 35',
  whatsapp2: '+224 627 71 77 85',
  email: 'contact@konadatagn.com',
  slogan: 'Simple, connecté, local.',
};

export const OFFER = {
  ecoles: '12 mois gratuits',
  autres: '6 mois gratuits',
  rule: "Activation unique, dans les 2 mois suivant l'inscription.",
};

/** Dégradés d'accent (lisibles sur fond bleu nuit). */
export const ACCENTS = {
  brand: ['#22D3EE', '#3B82F6'],
  ecole: ['#60A5FA', '#818CF8'],
  ong: ['#34D399', '#2DD4BF'],
  btp: ['#FB923C', '#FBBF24'],
  pme: ['#A78BFA', '#E879F9'],
  offre: ['#34D399', '#22D3EE'],
};

export const SECTOR_LABELS = {
  ecole: 'Établissements scolaires',
  ong: 'ONG & projets',
  btp: 'BTP & chantiers',
  pme: 'PME & commerce',
};

/**
 * Série de publications. `layout` :
 *  - photo   : photo en situation + message
 *  - product : captures dans un ordinateur + téléphone
 *  - phones  : trois téléphones (usage mobile)
 *  - offer   : offre de lancement
 *  - steps   : démarrage en 3 étapes
 * Dans `title`, le texte entre *astérisques* est mis en valeur (dégradé).
 */
export const POSTS = [
  {
    id: '01-marque',
    layout: 'photo',
    accent: 'brand',
    photo: 'photo-marque.png',
    kicker: 'Nouveau en Guinée',
    title: 'Vos données enfin *organisées*.',
    sub: 'Écoles, ONG, chantiers BTP, PME : une seule plateforme pour collecter, suivre et analyser — même en 3G.',
    bullets: ['Sur ordinateur et téléphone', 'Rapports automatiques', 'Données sécurisées'],
    cta: 'Essai gratuit sur konadatagn.com',
  },
  {
    id: '02-offre',
    layout: 'offer',
    accent: 'offre',
    kicker: 'Offre de lancement',
    title: "Jusqu'à *12 mois* gratuits",
    cta: 'Créez votre organisation sur konadatagn.com',
  },
  {
    id: '03-probleme',
    layout: 'photo',
    accent: 'brand',
    photo: 'photo-probleme.png',
    kicker: 'Ça vous parle ?',
    title: 'Cahiers perdus, chiffres introuvables, *rapports en retard* ?',
    sub: 'Avec KonaData, chaque donnée est saisie une fois, rangée automatiquement et retrouvée en un clic.',
    bullets: ['Fini les registres papier', 'Fini les fichiers Excel éparpillés', 'Des chiffres fiables, à jour'],
    cta: 'Passez au numérique : konadatagn.com',
  },
  {
    id: '04-ecole',
    layout: 'photo',
    accent: 'ecole',
    photo: 'photo-ecole.png',
    kicker: SECTOR_LABELS.ecole,
    title: 'Votre école, *connectée et organisée*.',
    sub: 'Inscriptions, notes, bulletins et paiements de scolarité réunis au même endroit.',
    bullets: ['Bulletins PDF générés automatiquement', 'Suivi des paiements par classe', 'Espace parents et élèves'],
    badge: OFFER.ecoles,
    cta: 'Inscrivez votre établissement',
  },
  {
    id: '05-ong',
    layout: 'photo',
    accent: 'ong',
    photo: 'photo-ong.png',
    kicker: SECTOR_LABELS.ong,
    title: 'Du terrain au rapport bailleur, *sans ressaisie*.',
    sub: 'Projets, bénéficiaires, sondages et cartographie — même dans les zones à faible réseau.',
    bullets: ['Collecte mobile et par QR code', 'Carte des localités couvertes', 'Rapports prêts à partager'],
    badge: OFFER.autres,
    cta: 'Inscrivez votre ONG',
  },
  {
    id: '06-btp',
    layout: 'photo',
    accent: 'btp',
    photo: 'photo-btp.png',
    kicker: SECTOR_LABELS.btp,
    title: 'Tous vos chantiers, *sous contrôle*.',
    sub: 'Avancement, carburant, bons de livraison et personnel suivis chaque jour, chantier par chantier.',
    bullets: ['Alertes sur les anomalies carburant', 'Rapports PDF et PowerPoint en 1 clic', 'Devis avec métré automatique'],
    badge: OFFER.autres,
    cta: 'Inscrivez votre entreprise',
  },
  {
    id: '07-pme',
    layout: 'photo',
    accent: 'pme',
    photo: 'photo-pme.png',
    kicker: SECTOR_LABELS.pme,
    title: 'Votre commerce, *dans votre poche*.',
    sub: 'Ventes, stocks, dépenses et crédits clients suivis depuis votre téléphone.',
    bullets: ['Alerte quand le stock est bas', 'Suivi des crédits et des dettes', 'Votre résultat en un coup d’œil'],
    badge: OFFER.autres,
    cta: 'Inscrivez votre commerce',
  },
  {
    id: '08-ecole-produit',
    layout: 'product',
    accent: 'ecole',
    desktop: 'ecole-dashboard-desktop.png',
    mobile: 'ecole-dashboard-mobile.png',
    kicker: SECTOR_LABELS.ecole,
    title: 'Toute votre école sur *un seul tableau de bord*.',
    chips: ['Candidatures', 'Élèves', 'Paiements', 'Bulletins', 'Résultats'],
    bullets: ['Effectifs et paiements en temps réel', 'Bulletins et relevés en PDF', 'Accès parents, élèves et enseignants'],
    badge: OFFER.ecoles,
    cta: 'konadatagn.com',
  },
  {
    id: '09-ong-produit',
    layout: 'product',
    accent: 'ong',
    desktop: 'ong-dashboard-desktop.png',
    mobile: 'ong-dashboard-mobile.png',
    kicker: SECTOR_LABELS.ong,
    title: 'Tous vos projets, *une seule vue*.',
    chips: ['Projets', 'Bénéficiaires', 'Sondages', 'Cartographie', 'Rapports'],
    bullets: ['Budget prévu et dépensé par projet', 'Bénéficiaires par localité', 'Sondages et collecte terrain'],
    badge: OFFER.autres,
    cta: 'konadatagn.com',
  },
  {
    id: '10-btp-produit',
    layout: 'product',
    accent: 'btp',
    desktop: 'btp-dashboard-desktop.png',
    mobile: 'btp-dashboard-mobile.png',
    kicker: SECTOR_LABELS.btp,
    title: 'Pilotez chaque chantier *en temps réel*.',
    chips: ['Chantiers', 'Carburant', 'Bons de livraison', 'Avancement', 'Devis', 'Rapports'],
    bullets: ['Planifié vs réalisé, semaine par semaine', 'Carburant et matériels suivis', 'Rapport hebdomadaire automatique'],
    badge: OFFER.autres,
    cta: 'konadatagn.com',
  },
  {
    id: '11-pme-produit',
    layout: 'product',
    accent: 'pme',
    desktop: 'pme-dashboard-desktop.png',
    mobile: 'pme-dashboard-mobile.png',
    kicker: SECTOR_LABELS.pme,
    title: 'Chiffre d’affaires, dépenses, résultat : *en direct*.',
    chips: ['Ventes', 'Achats', 'Stocks', 'Clients', 'Crédits & dettes'],
    bullets: ['Recommandations automatiques', 'Stock bas signalé à temps', 'Créances clients suivies'],
    badge: OFFER.autres,
    cta: 'konadatagn.com',
  },
  {
    id: '12-mobile',
    layout: 'phones',
    accent: 'brand',
    phones: ['btp-dashboard-mobile.png', 'ecole-dashboard-mobile.png', 'pme-dashboard-mobile.png'],
    kicker: 'Pensée pour le terrain',
    title: 'Fonctionne en 3G/4G, *même hors-ligne*.',
    bullets: ["S'installe comme une application", 'Saisie possible sans réseau', 'Envoi automatique au retour du réseau'],
    cta: 'Ouvrez konadatagn.com sur votre téléphone',
  },
  {
    id: '13-ia',
    layout: 'product',
    accent: 'brand',
    desktop: 'pme-dashboard-desktop.png',
    card: 'ia-card.png',
    kicker: 'KonaAI intégré',
    title: "L'IA qui *lit vos chiffres* pour vous.",
    chips: ['Alertes', 'Synthèses', 'Rapports', 'OCR'],
    bullets: ['Alertes automatiques : stock, retards, carburant', 'Rapports rédigés en un clic', 'Documents scannés lus automatiquement'],
    cta: 'konadatagn.com',
  },
  {
    id: '14-etapes',
    layout: 'steps',
    accent: 'brand',
    kicker: 'Simple à démarrer',
    title: 'Démarrez en *3 étapes*',
    steps: [
      ['Créez votre organisation', "La direction s'inscrit en quelques minutes sur konadatagn.com."],
      ['Invitez votre équipe', 'Chacun rejoint avec un code et ne voit que son périmètre.'],
      ['Pilotez', 'Saisie, tableaux de bord et rapports, sur ordinateur ou téléphone.'],
    ],
    cta: 'Commencez gratuitement',
  },
];

/** Affiches A4 (impression) : une de marque + une par secteur. */
export const POSTERS = ['01-marque', '04-ecole', '05-ong', '06-btp', '07-pme'];

/** Carrousel LinkedIn / Instagram « 4 secteurs ». */
export const CAROUSEL = {
  id: 'carrousel-secteurs',
  cover: {
    kicker: 'Une plateforme',
    title: '*4 secteurs*, un seul outil.',
    sub: 'Écoles · ONG · BTP · PME',
  },
  slides: ['08-ecole-produit', '09-ong-produit', '10-btp-produit', '11-pme-produit'],
  end: '02-offre',
};
