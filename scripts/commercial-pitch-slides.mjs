/**
 * Slides pitch commercial — établissements scolaires KonaData
 * Généré via npm run build:commercial-docs
 */

export const PITCH_SLIDES = [
  {
    kind: 'title',
    title: 'KonaData',
    subtitle: 'La plateforme intelligente pour piloter votre établissement',
    footer: 'konadatagn.com · Conakry, Guinée',
  },
  {
    kind: 'content',
    title: 'Le défi des établissements aujourd\'hui',
    bullets: [
      { text: 'Fichiers Excel dispersés, bulletins manuels, retards de paiement' },
      { text: 'Parents sans visibilité sur notes et scolarité' },
      { text: 'Enseignants : confusion sur qui saisit quoi' },
      { text: 'Direction sans tableau de bord fiable en temps réel' },
      { text: 'Connexion mobile instable (3G/4G) — outils cloud inadaptés' },
    ],
  },
  {
    kind: 'content',
    title: 'La solution KonaData',
    bullets: [
      { text: 'Une seule plateforme cloud : inscriptions → notes → bulletins → paiements', bold: true },
      { text: 'Multi-rôles : direction, enseignants, comptabilité, parents (portail)' },
      { text: 'PWA : utilisable sur mobile, adaptée au réseau guinéen' },
      { text: 'Bulletins PDF, suivi Orange Money, rapports et synthèses' },
      { text: 'Sécurité : accès par rôle, données hébergées cloud' },
    ],
  },
  {
    kind: 'table',
    title: 'Parcours démo — 15 minutes',
    headers: ['Étape', 'Module', 'Bénéfice'],
    rows: [
      ['1', 'Tableau de bord', 'KPIs élèves, paiements, alertes'],
      ['2', 'Formations & classes', 'Paliers collège/lycée, import Excel'],
      ['3', 'Assignations enseignants', 'Chaque prof ne voit que ses classes'],
      ['4', 'Élèves & inscriptions', 'Import CSV, matricules auto'],
      ['5', 'Notes & bulletins', 'Saisie → PDF officiel'],
      ['6', 'Paiements scolarité', 'Orange Money, reçus, relances'],
    ],
  },
  {
    kind: 'table',
    title: 'KonaData vs gestion traditionnelle',
    headers: ['Critère', 'Excel / papier', 'KonaData'],
    rows: [
      ['Accès mobile', 'Limité', 'PWA, 3G/4G'],
      ['Rôles & permissions', 'Confusion', 'Direction / prof / comptable'],
      ['Bulletins', 'Long, erreurs', 'PDF automatisés'],
      ['Paiements', 'Manuel', 'Suivi + reçus'],
      ['Sécurité données', 'Faible', 'Cloud + comptes sécurisés'],
      ['Coût annuel', 'Personnel + temps', 'Abonnement prévisible'],
    ],
  },
  {
    kind: 'content',
    title: 'Pour qui ?',
    bullets: [
      { text: 'Écoles privées, collèges, lycées, instituts supérieurs' },
      { text: '50 à 2 000+ élèves — Conakry et intérieur du pays' },
      { text: 'Directeurs, responsables scolarité, comptables, enseignants' },
      { text: 'Établissements qui veulent moderniser sans recruter un service IT' },
    ],
  },
  {
    kind: 'table',
    title: 'Modèle économique — transparent',
    headers: ['Poste', 'Description', 'Exemple'],
    rows: [
      ['Activation', 'Onboarding, import, formation ½ j', '1,5 – 3 M GNF'],
      ['Forfait annuel', 'Plateforme + support + mises à jour', '7 M GNF/an'],
      ['Par élève / an', 'Redevance plateforme (≠ scolarité)', '30 000 GNF'],
      ['Total 200 él.', '7 M + 6 M', '≈ 13 M GNF/an'],
      ['Essai 30 j', 'Pilote complet avant engagement', 'Gratuit ou symbolique'],
    ],
  },
  {
    kind: 'content',
    title: 'Offre pilote proposée',
    bullets: [
      { text: '30 jours d\'accès complet — 1 niveau ou 1 classe pilote', bold: true },
      { text: 'Formation initiale de votre référent (½ journée)' },
      { text: 'Import de vos listes élèves existantes (CSV/Excel)' },
      { text: 'Support WhatsApp pro & email — réponse sous 48 h ouvrées' },
      { text: 'Après validation : déploiement établissement complet + contrat annuel' },
    ],
  },
  {
    kind: 'content',
    title: 'Accompagnement KonaData',
    bullets: [
      { text: 'Équipe locale à Conakry — connaissance du terrain guinéen' },
      { text: 'Évolution produit selon vos retours (rentrée, bulletins, paiements)' },
      { text: 'Option KonaAI : rapports et synthèses assistés' },
      { text: 'Contrat clair : abonnement plateforme distinct de la scolarité familles' },
    ],
  },
  {
    kind: 'title',
    title: 'Prochaine étape',
    subtitle: 'Démo personnalisée + convention pilote sous 7 jours',
    footer: 'contact@konadatagn.com · +224 628 36 04 35 · konadatagn.com',
  },
  {
    kind: 'content',
    title: 'Script oral — 2 minutes',
    steps: [
      '« Monsieur/Madame le Directeur, vos équipes perdent du temps à recopier des notes et courir après les paiements. »',
      '« KonaData centralise tout : chaque enseignant ne voit que ses classes, la comptabilité les encaissements, les parents peuvent suivre la scolarité. »',
      '« Application web qui fonctionne même quand la connexion est faible. »',
      '« Pilote 30 jours, puis abonnement annuel clair — environ 13 M GNF/an pour 200 élèves. »',
      '« Planifions une démo avec votre responsable scolarité la semaine prochaine ? »',
    ],
  },
];
