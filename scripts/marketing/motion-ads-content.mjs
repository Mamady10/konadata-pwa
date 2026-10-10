/**
 * Scénarios des publicités « motion design » (rendu : build-motion-ads.mjs).
 *
 * Chaque pub : voix (Edge TTS), style (night | aurora | clean), palette, temps de voix (`beats`)
 * et scènes. Les textes affichés sont révélés au moment où la voix prononce les mêmes mots.
 * Les promesses restent alignées sur l'appli réelle : notifications par WhatsApp (pas de SMS),
 * pas de paiement en ligne, rapports générés à la demande (pas d'envoi automatique).
 */
import path from 'path';
import { ROOT, WORK } from './campaign-html.mjs';
import { OFFER } from './campaign-content.mjs';

const EX = (p) => path.join(WORK, 'exemples', p);
const SEED = (f) => path.join(ROOT, 'scripts', 'tutorials', 'seed', 'assets', 'btp', f);

const VOICES = {
  remy: { name: 'fr-FR-RemyMultilingualNeural', rate: '+5%', pitch: '+0Hz' },
  vivienne: { name: 'fr-FR-VivienneMultilingualNeural', rate: '+4%', pitch: '+0Hz' },
  denise: { name: 'fr-FR-DeniseNeural', rate: '+6%', pitch: '+0Hz' },
  henri: { name: 'fr-FR-HenriNeural', rate: '+4%', pitch: '-2Hz' },
};

const RULE = OFFER.rule;
const OFFRE_12 = '12 mois gratuits';
const OFFRE_6 = '6 mois gratuits';

// ------------------------------------------------------------------ tuiles d'accueil par secteur
const T = (icon, label, fg, bg) => ({ icon, label, fg, bg });
const TILES = {
  btp: [
    T('clipboard', 'Fiche du jour', '#2563EB', '#DBEAFE'),
    T('fuel', 'Carburant', '#D97706', '#FEF3C7'),
    T('truck', 'Livraisons', '#059669', '#D1FAE5'),
    T('calculator', 'Devis', '#7C3AED', '#EDE9FE'),
    T('file', 'Rapports', '#0284C7', '#E0F2FE'),
    T('users', 'Équipes', '#E11D48', '#FFE4E6'),
  ],
  pme: [
    T('cart', 'Ventes', '#7C3AED', '#EDE9FE'),
    T('package', 'Stocks', '#D97706', '#FEF3C7'),
    T('users', 'Clients', '#2563EB', '#DBEAFE'),
    T('wallet', 'Crédits', '#E11D48', '#FFE4E6'),
    T('truck', 'Achats', '#059669', '#D1FAE5'),
    T('chart', 'Analyse', '#0284C7', '#E0F2FE'),
  ],
  ecole: [
    T('users', 'Élèves', '#2563EB', '#DBEAFE'),
    T('pen', 'Notes', '#7C3AED', '#EDE9FE'),
    T('file', 'Bulletins', '#0284C7', '#E0F2FE'),
    T('wallet', 'Paiements', '#059669', '#D1FAE5'),
    T('calendar', 'Vie scolaire', '#D97706', '#FEF3C7'),
    T('chart', 'Rapports', '#E11D48', '#FFE4E6'),
  ],
  ong: [
    T('folder', 'Projets', '#059669', '#D1FAE5'),
    T('clipboard', 'Sondages', '#2563EB', '#DBEAFE'),
    T('heart', 'Bénéficiaires', '#E11D48', '#FFE4E6'),
    T('pin', 'Cartographie', '#D97706', '#FEF3C7'),
    T('file', 'Rapports', '#0284C7', '#E0F2FE'),
    T('sparkles', 'KonaAI', '#7C3AED', '#EDE9FE'),
  ],
};
const icons = (sector) => TILES[sector].map(({ icon, fg }) => ({ icon, fg }));
const DEVICES = [
  { icon: 'smartphone', label: 'Téléphone', word: 'téléphone' },
  { icon: 'laptop', label: 'Ordinateur', word: 'ordinateur' },
];

const offer = (beat, n, word, sector) => ({
  type: 'counter',
  beats: [beat],
  label: 'L’OFFRE',
  kicker: `OFFRE DE LANCEMENT · ${sector}`,
  to: n,
  word,
  unit: ['mois', '*gratuits.*'],
  rule: RULE,
});

const end = (beat, tagline, offerText) => ({ type: 'end', beats: [beat], tone: 'dark', tagline, offer: offerText });

// ================================================================== BTP
const btpPhone = {
  org: 'Bâtir Guinée SARL · BTP',
  site: { title: 'Immeuble R+4 · Kipé', label: 'Avancement global', pct: 62 },
  tiles: TILES.btp,
};

const BTP_CHANTIER = {
  key: 'btp',
  id: 'konadata-pub-btp',
  voice: VOICES.remy,
  style: 'night',
  palette: 'blue',
  beats: [
    { k: 'hook', say: 'Et si vous saviez, chaque soir, ce qui se passe sur vos chantiers ?', pre: 0.45, post: 0.45 },
    { k: 'logo', say: 'Kona Data. Le suivi de chantier, dans votre poche.', pre: 0.75, post: 0.45 },
    { k: 'f1', say: 'Remplissez la fiche du jour, directement depuis le chantier.', pre: 0.65, post: 0.3 },
    { k: 'f2', say: 'Suivez le carburant, engin par engin.', pre: 0.3, post: 0.3 },
    { k: 'f3', say: 'Contrôlez chaque livraison : ciment, fer, agglos.', pre: 0.3, post: 0.35 },
    { k: 'f4', say: 'Chiffrez vos devis au métré, en quelques minutes.', pre: 0.3, post: 0.55 },
    { k: 'report', say: 'Et votre rapport de chantier sort en un clic, avec photos et chiffres.', pre: 0.6, post: 0.45 },
    { k: 'offer', say: 'Pour démarrer : six mois gratuits.', pre: 0.55, post: 0.8 },
    { k: 'all', say: 'Tout cela, dans une seule application. Sur téléphone et ordinateur.', pre: 0.55, post: 0.45 },
    { k: 'end', say: 'Kona Data. Pilotez vos chantiers, même à distance. Écrivez-nous sur WhatsApp.', pre: 0.7, post: 2.6 },
  ],
  scenes: [
    { type: 'hook', beats: ['hook'], label: 'LE CONSTAT', icon: 'helmet', lines: ['Et si vous saviez,', '*chaque soir,*', 'ce qui se passe', 'sur vos chantiers ?'] },
    { type: 'logo', beats: ['logo'], tone: 'light', tr: 'circle', tagline: ['Le suivi de chantier,', '*dans votre poche.*'] },
    {
      type: 'phone',
      beats: ['f1', 'f2', 'f3', 'f4'],
      tone: 'dark',
      tr: 'up',
      label: 'SUR LE TERRAIN',
      phone: btpPhone,
      finalTile: 4,
      features: [
        {
          beat: 'f1', tile: 0, title: ['Remplissez', 'la fiche du jour.'],
          card: { tile: 0, title: 'Fiche du jour', sub: 'Immeuble R+4 · Kipé · 27 sept.', rows: [{ label: 'Avancement R+2', value: '62 %', count: [54, 62, ' %'] }, { label: 'Ouvriers présents', value: '18', count: [0, 18] }], photos: [SEED('Coulage_dalle_R+2.jpg'), SEED('Ferraillage_poutres_R+3.jpg'), SEED('Elevation_murs_agglos_R+3.jpg')] },
        },
        {
          beat: 'f2', tile: 1, title: ['Suivez', 'le carburant.'],
          card: { tile: 1, title: 'Carburant', sub: 'Pelle CAT 320 · Chantier Kipé', rows: [{ label: 'Gasoil reçu', value: '120 L', count: [0, 120, ' L'] }, { label: 'Compteur', value: '4 512 h' }, { label: 'Coût', value: '1 440 000 GNF', count: [0, 1440000, ' GNF'], accent: true }] },
        },
        {
          beat: 'f3', tile: 2, title: ['Contrôlez', 'les livraisons.'],
          card: { tile: 2, title: 'Bon de livraison', sub: 'BL-2026-0042 · Immeuble R+4', rows: [{ label: 'Ciment CPJ 42.5', value: '300 sacs' }, { label: 'Fer HA 12', value: '80 barres' }, { label: 'Agglos de 15', value: '2 000' }], stamp: { text: 'Conforme' }, stampWord: 'agglos' },
        },
        {
          beat: 'f4', tile: 3, title: ['Chiffrez', 'vos devis.'],
          card: { tile: 3, title: 'Devis au métré', sub: 'DEV-2026-0003 · Villa R+1', rows: [{ label: 'Béton dosé à 350', value: '42 m³' }, { label: 'Agglos de 15', value: '3 150' }, { label: 'Total', value: '48 750 000 GNF', count: [0, 48750000, ' GNF'], accent: true }] },
        },
      ],
    },
    { type: 'docs', beats: ['report'], tone: 'light', tr: 'wipe', label: 'LE RAPPORT', lines: ['Le rapport', '*en un clic.*'], chips: ['PDF', 'Photos', 'Chiffres'], chipWords: ['rapport', 'photos', 'chiffres'], pages: [EX('hebdo/page-02.jpg'), EX('hebdo/page-01.jpg')] },
    { ...offer('offer', 6, 'six', 'BTP'), tone: 'dark', tr: 'rise' },
    { type: 'all', beats: ['all'], tone: 'light', tr: 'slide', label: 'TOUT-EN-UN', lines: ['Tout cela, dans', '*une seule*', '*application.*'], icons: icons('btp'), chips: DEVICES },
    { ...end('end', ['Pilotez vos chantiers,', '*même à distance.*'], OFFRE_6), tr: 'circle' },
  ],
};

const BTP_PERTES = {
  key: 'btp-pertes',
  id: 'konadata-pub-btp-pertes',
  voice: VOICES.henri,
  style: 'night',
  palette: 'amber',
  trOffset: 1,
  beats: [
    { k: 'hook', say: 'Où passe votre gasoil ? Et ces sacs de ciment qui manquent à l’appel ?', pre: 0.45, post: 0.45 },
    { k: 'logo', say: 'Avec Kona Data, chaque litre et chaque sac sont tracés.', pre: 0.75, post: 0.4 },
    { k: 'fuel', say: 'Chaque plein est enregistré, engin par engin, et les relevés anormaux sont signalés.', pre: 0.6, post: 0.5 },
    { k: 's1', say: 'À la livraison, le magasinier saisit le bon.', pre: 0.6, post: 0.3 },
    { k: 's2', say: 'Il compte ce qui est vraiment arrivé.', pre: 0.3, post: 0.3 },
    { k: 's3', say: 'Il valide, et le stock se met à jour.', pre: 0.3, post: 0.5 },
    { k: 'chart', say: 'Prévu, réalisé : vous voyez les écarts, semaine après semaine.', pre: 0.6, post: 0.5 },
    { k: 'offer', say: 'Pour les entreprises du BTP : six mois gratuits.', pre: 0.55, post: 0.8 },
    { k: 'end', say: 'Kona Data. Fini les pertes invisibles. Écrivez-nous sur WhatsApp.', pre: 0.7, post: 2.6 },
  ],
  scenes: [
    { type: 'hook', beats: ['hook'], label: 'LES FUITES', icon: 'fuel', lines: ['Où passe', '*votre gasoil ?*'] },
    { type: 'logo', beats: ['logo'], tone: 'light', tr: 'circle', tagline: ['Chaque litre, chaque sac,', '*tracé.*'] },
    {
      type: 'list', beats: ['fuel'], tone: 'dark', label: 'CARBURANT', lines: ['Chaque litre,', '*engin par engin.*'],
      card: {
        icon: 'fuel', fg: '#D97706', bg: '#FEF3C7', title: 'Relevés carburant', sub: 'Route Dubréka–Khorira · semaine 41',
        rows: [
          { label: 'Pelle CAT 320', sub: 'Compteur 4 512 h', value: '120 L', count: [0, 120, ' L'] },
          { label: 'Camion benne 6×4', sub: 'Compteur 18 240 km', value: '210 L', count: [0, 210, ' L'], badge: { text: 'Anormal', tone: 'red' } },
          { label: 'Niveleuse 140K', sub: 'Compteur 2 870 h', value: '95 L', count: [0, 95, ' L'] },
          { label: 'Groupe électrogène', sub: 'Base vie', value: '80 L', count: [0, 80, ' L'] },
        ],
      },
    },
    {
      type: 'steps', beats: ['s1', 's2', 's3'], tone: 'light', label: 'LIVRAISONS',
      steps: [
        { beat: 's1', label: 'Saisie', title: ['Le bon', '*est saisi.*'], card: { icon: 'truck', fg: '#059669', bg: '#D1FAE5', title: 'Bon de livraison', sub: 'BL-2026-0057 · Centre de santé de Coyah', rows: [{ label: 'Fournisseur', value: 'Cimenterie' }, { label: 'Ciment CPJ 42.5 facturé', value: '250 sacs' }] } },
        { beat: 's2', label: 'Contrôle', title: ['On compte', '*ce qui est arrivé.*'], card: { icon: 'clipboard', fg: '#D97706', bg: '#FEF3C7', title: 'Contrôle à réception', sub: 'BL-2026-0057', rows: [{ label: 'Facturé', value: '250 sacs' }, { label: 'Reçu', value: '200 sacs', count: [0, 200, ' sacs'], accent: true }, { label: 'Écart', value: '−50 sacs', badge: { text: '4 750 000 GNF', tone: 'red' } }] } },
        { beat: 's3', label: 'Stock', title: ['On valide,', '*le stock suit.*'], card: { icon: 'package', fg: '#2563EB', bg: '#DBEAFE', title: 'Stock ciment · Coyah', sub: 'Mis à jour à la validation', rows: [{ label: 'Avant', value: '1 250 sacs' }, { label: 'Entrée validée', value: '+200 sacs' }, { label: 'Stock', value: '1 450 sacs', count: [1250, 1450, ' sacs'], accent: true }], stamp: { text: 'Validé' }, stampWord: 'valide' } },
      ],
    },
    {
      type: 'chart', beats: ['chart'], tone: 'dark', label: 'AVANCEMENT', lines: ['Prévu, réalisé :', '*les écarts.*'],
      kpis: [{ label: 'Avancement moyen', value: '58 %', count: [0, 58, ' %'], word: 'réalisé' }, { label: 'Retard cumulé', value: '6 jours', count: [0, 6, ' jours'], color: '#DC2626', word: 'écarts' }],
      bars: { title: 'Avancement par semaine', labels: ['S37', 'S38', 'S39', 'S40', 'S41'], series: [{ name: 'Prévu', color: '#CBD5E1', values: [30, 38, 46, 54, 62] }, { name: 'Réalisé', color: '#F59E0B', values: [28, 35, 41, 50, 58] }], max: 70 },
    },
    { ...offer('offer', 6, 'six', 'BTP'), tone: 'light' },
    { ...end('end', ['Fini les pertes', '*invisibles.*'], OFFRE_6) },
  ],
};

const BTP_DEVIS = {
  key: 'btp-devis',
  id: 'konadata-pub-btp-devis',
  voice: VOICES.denise,
  style: 'clean',
  palette: 'amber',
  trOffset: 2,
  beats: [
    { k: 'hook', say: 'Un appel d’offres demain matin… et votre devis n’est toujours pas prêt ?', pre: 0.45, post: 0.5 },
    { k: 'logo', say: 'Avec Kona Data, votre devis au métré se fait en quelques minutes.', pre: 0.75, post: 0.4 },
    { k: 's1', say: 'Créez vos lots : installation, gros œuvre, finitions.', pre: 0.6, post: 0.3 },
    { k: 's2', say: 'Saisissez les dimensions : le métré est calculé.', pre: 0.3, post: 0.3 },
    { k: 's3', say: 'Ciment, sable, gravier, fer et agglos : pertes comprises.', pre: 0.3, post: 0.3 },
    { k: 's4', say: 'TVA, total, montant en lettres : tout est prêt.', pre: 0.3, post: 0.5 },
    { k: 'docs', say: 'Le devis sort en PDF et en Excel, propre et professionnel.', pre: 0.6, post: 0.45 },
    { k: 'offer', say: 'Pour démarrer : six mois gratuits.', pre: 0.55, post: 0.8 },
    { k: 'end', say: 'Kona Data. Répondez plus vite, gagnez plus de marchés. Écrivez-nous sur WhatsApp.', pre: 0.7, post: 2.6 },
  ],
  scenes: [
    { type: 'hook', beats: ['hook'], style: 'papers', label: 'L’URGENCE', lines: ['Appel d’offres', 'demain matin…', '*et pas de devis ?*'], papers: [['Dalle R+1', '12,4 × 9,6 = ?', 'ciment ??'], ['Lot 2 — Gros œuvre', 'fer HA 12 : ?', 'agglos : 3 000 ?'], ['Total HT', '…', 'TVA 18 % ?'], ['Rappeler le client', 'avant 8 h !']] },
    { type: 'logo', beats: ['logo'], tone: 'light', tr: 'circle', tagline: ['Votre devis au métré,', '*en quelques minutes.*'] },
    {
      type: 'steps', beats: ['s1', 's2', 's3', 's4'], tone: 'dark', label: 'LE DEVIS',
      steps: [
        { beat: 's1', label: 'Lots', title: ['Créez', '*vos lots.*'], card: { icon: 'folder', fg: '#EA580C', bg: '#FFEDD5', title: 'DEV-2026-0003', sub: 'Villa R+1 · Kipé', rows: [{ label: 'Lot 1', value: 'Installation' }, { label: 'Lot 2', value: 'Gros œuvre' }, { label: 'Lot 3', value: 'Finitions' }] } },
        { beat: 's2', label: 'Métré', title: ['Le métré', '*est calculé.*'], card: { icon: 'calculator', fg: '#7C3AED', bg: '#EDE9FE', title: 'Métré · Dalle R+1', sub: 'Béton dosé à 350 kg/m³', rows: [{ label: 'Longueur × largeur', value: '12,4 × 9,6 m' }, { label: 'Épaisseur', value: '0,16 m' }, { label: 'Volume', value: '19,05 m³', count: [0, 19.05, ' m³', 2], accent: true }] } },
        { beat: 's3', label: 'Matériaux', title: ['Les matériaux,', '*pertes comprises.*'], card: { icon: 'package', fg: '#D97706', bg: '#FEF3C7', title: 'Matériaux', sub: 'Calculés depuis le métré', rows: [{ label: 'Ciment CPJ 42.5', value: '152 sacs', count: [0, 152, ' sacs'] }, { label: 'Sable · gravier', value: '9,5 · 15 m³' }, { label: 'Fer HA 12', value: '64 barres', count: [0, 64, ' barres'] }] } },
        { beat: 's4', label: 'Total', title: ['Tout est', '*prêt.*'], card: { icon: 'file', fg: '#059669', bg: '#D1FAE5', title: 'Récapitulatif', sub: 'Montant en lettres inclus', rows: [{ label: 'Total HT', value: '41 313 559 GNF' }, { label: 'TVA 18 %', value: '7 436 441 GNF' }, { label: 'Total TTC', value: '48 750 000 GNF', count: [0, 48750000, ' GNF'], accent: true }], stamp: { text: 'Prêt', tone: 'green' }, stampWord: 'prêt' } },
      ],
    },
    { type: 'docs', beats: ['docs'], tone: 'light', label: 'LE DOCUMENT', lines: ['Un devis', '*professionnel.*'], chips: ['PDF', 'Excel'], chipWords: ['PDF', 'Excel'], pages: [EX('devis/page-02.jpg'), EX('devis/page-01.jpg')] },
    { ...offer('offer', 6, 'six', 'BTP'), tone: 'dark' },
    { ...end('end', ['Répondez plus vite,', '*gagnez plus de marchés.*'], OFFRE_6) },
  ],
};

const BTP_DIASPORA = {
  key: 'btp-diaspora',
  id: 'konadata-pub-btp-diaspora',
  voice: VOICES.vivienne,
  style: 'aurora',
  palette: 'amber',
  trOffset: 3,
  beats: [
    { k: 'hook', say: 'Vous faites construire au pays, depuis Paris, Bruxelles ou New York ? Et vous ne savez jamais vraiment où en est le chantier ?', pre: 0.45, post: 0.45 },
    { k: 'logo', say: 'Avec Kona Data, votre chantier est visible, où que vous soyez.', pre: 0.75, post: 0.4 },
    { k: 'f1', say: 'L’avancement, jour après jour.', pre: 0.6, post: 0.3 },
    { k: 'f2', say: 'Les photos du chantier, datées.', pre: 0.3, post: 0.3 },
    { k: 'f3', say: 'Et les dépenses, poste par poste.', pre: 0.3, post: 0.5 },
    { k: 'docs', say: 'Le rapport de chantier se télécharge quand vous voulez, depuis votre téléphone.', pre: 0.6, post: 0.45 },
    { k: 'offer', say: 'Pour démarrer : six mois gratuits.', pre: 0.55, post: 0.8 },
    { k: 'end', say: 'Kona Data. Construisez au pays, l’esprit tranquille. Écrivez-nous sur WhatsApp.', pre: 0.7, post: 2.6 },
  ],
  scenes: [
    {
      type: 'hook', beats: ['hook'], style: 'chat', label: 'LA DISTANCE', lines: ['Vous construisez', 'au pays,', '*depuis l’étranger ?*'],
      chat: { name: 'Chef de chantier', initials: 'AC', messages: [{ out: true, text: 'Salut ! Le chantier avance bien ?', time: '21:04' }, { text: 'Oui oui, ça avance 👍', time: '21:31' }, { out: true, text: 'Tu peux m’envoyer des photos ?', time: '21:32' }, { text: 'Demain, inch’Allah', time: '23:58' }] },
    },
    { type: 'logo', beats: ['logo'], tone: 'light', tr: 'circle', tagline: ['Votre chantier,', '*visible de partout.*'] },
    {
      type: 'phone', beats: ['f1', 'f2', 'f3'], tone: 'dark', label: 'À DISTANCE',
      phone: { ...btpPhone, org: 'Villa familiale · Lambanyi', site: { title: 'Villa R+1 · Lambanyi', label: 'Avancement global', pct: 48 } },
      features: [
        { beat: 'f1', tile: 0, title: ['L’avancement,', 'jour après jour.'], card: { tile: 0, title: 'Avancement', sub: 'Villa R+1 · semaine 41', rows: [{ label: 'Gros œuvre', value: '72 %', count: [60, 72, ' %'], bar: 72, barColor: '#EA580C' }, { label: 'Toiture', value: '15 %', count: [0, 15, ' %'], bar: 15, barColor: '#EA580C' }] } },
        { beat: 'f2', tile: 0, title: ['Les photos,', 'datées.'], card: { tile: 0, title: 'Photos du chantier', sub: '12 oct. · 16:42', rows: [{ label: 'Photos cette semaine', value: '24', count: [0, 24] }], photos: [SEED('Coffrage_poteaux_R+2.jpg'), SEED('Elevation_murs_agglos_R+3.jpg'), SEED('Livraison_ciment_300_sacs.jpg')] } },
        { beat: 'f3', tile: 4, title: ['Les dépenses,', 'poste par poste.'], card: { icon: 'wallet', fg: '#059669', bg: '#D1FAE5', title: 'Dépenses', sub: 'Depuis le début du chantier', rows: [{ label: 'Matériaux', value: '11 600 000 GNF' }, { label: 'Main-d’œuvre', value: '6 200 000 GNF' }, { label: 'Total', value: '18 450 000 GNF', count: [0, 18450000, ' GNF'], accent: true }] } },
      ],
    },
    { type: 'docs', beats: ['docs'], tone: 'light', label: 'LE RAPPORT', lines: ['Le rapport,', '*quand vous*', '*voulez.*'], chips: ['PDF', 'Photos'], chipWords: ['rapport', 'téléphone'], pages: [EX('mensuel/page-02.jpg'), EX('mensuel/page-01.jpg')] },
    { ...offer('offer', 6, 'six', 'BTP'), tone: 'dark' },
    { ...end('end', ['Construisez au pays,', '*l’esprit tranquille.*'], OFFRE_6) },
  ],
};

// ================================================================== ÉCOLES
const ECOLE_BULLETINS = {
  key: 'ecole-bulletins',
  id: 'konadata-pub-ecole-bulletins',
  voice: VOICES.vivienne,
  style: 'aurora',
  palette: 'indigo',
  beats: [
    { k: 'hook', say: 'Fin de trimestre : des centaines de bulletins à calculer, à classer, à imprimer… à la main ?', pre: 0.45, post: 0.45 },
    { k: 'logo', say: 'Avec Kona Data, vos bulletins se font presque tout seuls.', pre: 0.75, post: 0.4 },
    { k: 's1', say: 'Les professeurs saisissent les notes de toute la classe, en une fois.', pre: 0.6, post: 0.3 },
    { k: 's2', say: 'Kona Data vérifie qu’aucune note ne manque.', pre: 0.3, post: 0.3 },
    { k: 's3', say: 'Moyennes, rangs, appréciations : les bulletins sont prêts.', pre: 0.3, post: 0.3 },
    { k: 's4', say: 'Et les parents sont prévenus sur WhatsApp.', pre: 0.3, post: 0.5 },
    { k: 'docs', say: 'Un bulletin propre, avec logo, cachet et classement.', pre: 0.6, post: 0.45 },
    { k: 'offer', say: 'Pour les écoles : douze mois gratuits.', pre: 0.55, post: 0.8 },
    { k: 'end', say: 'Kona Data. Moins de nuits blanches, plus de temps pour vos élèves. Écrivez-nous sur WhatsApp.', pre: 0.7, post: 2.6 },
  ],
  scenes: [
    { type: 'hook', beats: ['hook'], style: 'menu', label: 'FIN DE TRIMESTRE', lines: ['Des centaines', 'de bulletins…', '*à la main ?*'], menu: { title: 'Fin de trimestre', icon: 'calendar', items: ['Saisir les notes', 'Calculer les moyennes', 'Classer 620 élèves', 'Imprimer les bulletins'] } },
    { type: 'logo', beats: ['logo'], tone: 'light', tr: 'circle', tagline: ['Vos bulletins,', '*presque tout seuls.*'] },
    {
      type: 'steps', beats: ['s1', 's2', 's3', 's4'], tone: 'dark', label: 'LES BULLETINS',
      steps: [
        { beat: 's1', label: 'Notes', title: ['On saisit', '*les notes.*'], card: { icon: 'pen', fg: '#7C3AED', bg: '#EDE9FE', title: 'Terminale SM · Maths', sub: 'Trimestre 1 · 42 élèves', rows: [{ label: 'Aminata Kaba', value: '16,5' }, { label: 'Ibrahima Diallo', value: '14' }, { label: 'Fanta Camara', value: '15,25' }] } },
        { beat: 's2', label: 'Contrôle', title: ['On vérifie', '*que rien ne manque.*'], card: { icon: 'clipboard', fg: '#2563EB', bg: '#DBEAFE', title: 'Complétude', sub: 'Terminale SM · Trimestre 1', rows: [{ label: 'Notes saisies', value: '100 %', count: [0, 100, ' %'], bar: 100, barColor: '#16A34A' }, { label: 'Matières complètes', value: '12 / 12' }], stamp: { text: 'Complet' }, stampWord: 'manque' } },
        { beat: 's3', label: 'Bulletins', title: ['Les bulletins', '*sont prêts.*'], card: { icon: 'file', fg: '#0284C7', bg: '#E0F2FE', title: 'Bulletins · T1', sub: 'Terminale SM', rows: [{ label: 'Bulletins générés', value: '42 / 42', count: [0, 42, ' / 42'] }, { label: 'Moyenne de classe', value: '12,8' }, { label: '1re de la classe', value: 'Aminata K. · 16,2' }] } },
        { beat: 's4', label: 'Parents', title: ['Les parents', '*sont prévenus.*'], card: { icon: 'msg', fg: '#16A34A', bg: '#DCFCE7', title: 'WhatsApp', sub: 'Groupe Scolaire Horizon', rows: [{ label: 'Message', value: 'Bulletin T1 publié' }, { label: 'Familles prévenues', value: '42', count: [0, 42] }] } },
      ],
    },
    { type: 'docs', beats: ['docs'], tone: 'light', label: 'LE BULLETIN', lines: ['Un bulletin', '*propre et signé.*'], chips: ['Logo', 'Cachet', 'Classement'], chipWords: ['logo', 'cachet', 'classement'], pages: [EX('ec-primaire/page-01.jpg'), EX('ec-lycee/page-01.jpg')] },
    { ...offer('offer', 12, 'douze', 'ÉCOLES'), tone: 'dark' },
    { ...end('end', ['Moins de nuits blanches,', '*plus de temps pour vos élèves.*'], OFFRE_12) },
  ],
};

const ECOLE_PARENTS = {
  key: 'ecole-parents',
  id: 'konadata-pub-ecole-parents',
  voice: VOICES.denise,
  style: 'night',
  palette: 'indigo',
  trOffset: 4,
  beats: [
    { k: 'hook', say: 'Combien a-t-on payé ? Combien reste-t-il ? Le bulletin est-il sorti ? Tous les jours, les mêmes questions.', pre: 0.45, post: 0.45 },
    { k: 'logo', say: 'Avec Kona Data, les parents trouvent la réponse eux-mêmes.', pre: 0.75, post: 0.4 },
    { k: 'f1', say: 'Le parent saisit le matricule de son enfant, et son numéro.', pre: 0.6, post: 0.3 },
    { k: 'f2', say: 'Il reçoit un code de confirmation.', pre: 0.3, post: 0.3 },
    { k: 'f3', say: 'Et il voit tout : le payé, le reste à payer, et les bulletins.', pre: 0.3, post: 0.5 },
    { k: 'notif', say: 'La veille de chaque échéance, un rappel part sur WhatsApp.', pre: 0.6, post: 0.6 },
    { k: 'offer', say: 'Pour les écoles : douze mois gratuits.', pre: 0.55, post: 0.8 },
    { k: 'end', say: 'Kona Data. Une école organisée, des parents rassurés. Écrivez-nous sur WhatsApp.', pre: 0.7, post: 2.6 },
  ],
  scenes: [
    {
      type: 'hook', beats: ['hook'], style: 'chat', label: 'LE SECRÉTARIAT', lines: ['Tous les jours,', '*les mêmes questions ?*'],
      chat: { name: 'Secrétariat · GS Horizon', initials: 'GS', messages: [{ text: 'Bonjour, mon fils a payé combien déjà ?', time: '07:52' }, { text: 'Il reste combien pour la scolarité ?', time: '08:15' }, { text: 'Le bulletin est sorti ?', time: '08:40' }, { out: true, text: 'Je vérifie dans le registre…', time: '09:02' }] },
    },
    { type: 'logo', beats: ['logo'], tone: 'light', tr: 'circle', tagline: ['Les parents ont', '*la réponse.*'] },
    {
      type: 'phone', beats: ['f1', 'f2', 'f3'], tone: 'dark', label: 'SUIVI SCOLARITÉ',
      screens: [
        { kind: 'form', fields: [{ label: 'Établissement', value: 'Groupe Scolaire Horizon' }, { label: 'Matricule', value: 'TER-26-010', typed: true, word: 'matricule' }, { label: 'Téléphone du tuteur', value: '+224 622 •• •• 18', typed: true, word: 'numéro' }], button: 'Recevoir le code' },
        { kind: 'code', text: 'Saisissez le code reçu pour accéder au dossier.', digits: '482917', button: 'Valider' },
        { kind: 'balance', initials: 'AK', name: 'Aminata Kaba', klass: 'Terminale SM · 2026-2027', year: 'Scolarité 2026-2027', paid: 2800000, pct: 67, rest: '1 400 000 GNF', docs: ['Bulletin · Trimestre 1', 'Actualités de l’école'] },
      ],
      features: [
        { beat: 'f1', screen: 0, title: ['Un matricule,', 'un numéro.'] },
        { beat: 'f2', screen: 1, title: ['Un code', 'de confirmation.'] },
        { beat: 'f3', screen: 2, title: ['Et il voit', 'tout.'] },
      ],
    },
    {
      type: 'notif', beats: ['notif'], tone: 'light', label: 'RAPPELS', palette: 'indigo', lines: ['Un rappel', '*la veille*', '*de l’échéance.*'],
      notifs: [
        { title: 'Groupe Scolaire Horizon', text: 'Rappel : l’échéance de scolarité d’Aminata est demain (1 400 000 GNF).', at: 'rappel' },
        { title: 'Groupe Scolaire Horizon', text: 'Le bulletin du 1er trimestre d’Aminata est disponible.', time: 'hier', at: 'WhatsApp' },
      ],
    },
    { ...offer('offer', 12, 'douze', 'ÉCOLES'), tone: 'dark' },
    { ...end('end', ['Une école organisée,', '*des parents rassurés.*'], OFFRE_12) },
  ],
};

const ECOLE_DIRECTION = {
  key: 'ecole-direction',
  id: 'konadata-pub-ecole-direction',
  voice: VOICES.henri,
  style: 'clean',
  palette: 'blue',
  trOffset: 2,
  beats: [
    { k: 'hook', say: 'Qui a payé ? Qui doit encore ? Et combien est entré ce mois-ci ?', pre: 0.45, post: 0.5 },
    { k: 'logo', say: 'Avec Kona Data, les finances de votre école sont enfin claires.', pre: 0.75, post: 0.4 },
    { k: 'chart', say: 'Encaissé, attendu, taux de paiement : tout est sur le tableau de bord.', pre: 0.6, post: 0.5 },
    { k: 'list', say: 'Les impayés sont listés, classe par classe.', pre: 0.6, post: 0.5 },
    { k: 'docs', say: 'Chaque paiement donne un reçu officiel, vérifiable par QR code.', pre: 0.6, post: 0.45 },
    { k: 'offer', say: 'Pour les écoles : douze mois gratuits.', pre: 0.55, post: 0.8 },
    { k: 'end', say: 'Kona Data. Pilotez votre école avec des chiffres sûrs. Écrivez-nous sur WhatsApp.', pre: 0.7, post: 2.6 },
  ],
  scenes: [
    { type: 'hook', beats: ['hook'], label: 'LA DIRECTION', icon: 'wallet', lines: ['Qui a payé ?', 'Qui doit encore ?', '*Combien est entré ?*'] },
    { type: 'logo', beats: ['logo'], tone: 'light', tr: 'circle', tagline: ['Vos finances scolaires,', '*enfin claires.*'] },
    {
      type: 'chart', beats: ['chart'], tone: 'dark', label: 'TABLEAU DE BORD', lines: ['Tout est sur', '*le tableau de bord.*'],
      kpis: [{ label: 'Encaissé', value: '1,86 Md', count: [0, 1.86, ' Md', 2], word: 'encaissé' }, { label: 'Taux de paiement', value: '78 %', count: [0, 78, ' %'], color: '#16A34A', word: 'taux' }],
      bars: { title: 'Scolarité par mois (millions GNF)', labels: ['Oct.', 'Nov.', 'Déc.', 'Janv.'], series: [{ name: 'Attendu', color: '#CBD5E1', values: [620, 540, 480, 520] }, { name: 'Encaissé', color: '#2563EB', values: [590, 470, 360, 440] }], max: 700 },
    },
    {
      type: 'list', beats: ['list'], tone: 'light', label: 'IMPAYÉS', lines: ['Les impayés,', '*classe par classe.*'],
      card: {
        icon: 'alert', fg: '#DC2626', bg: '#FEE2E2', title: 'Impayés par classe', sub: 'Échéance du 5 novembre',
        rows: [
          { label: 'Terminale SM', sub: '6 élèves', value: '8 400 000', badge: { text: 'Relancer', tone: 'red' } },
          { label: '3e A', sub: '4 élèves', value: '5 200 000', badge: { text: 'Relancer', tone: 'red' } },
          { label: 'CM2 B', sub: '3 élèves', value: '2 700 000', badge: { text: 'Partiel', tone: 'amber' } },
          { label: '6e C', sub: '1 élève', value: '900 000', badge: { text: 'Partiel', tone: 'amber' } },
        ],
      },
    },
    { type: 'docs', beats: ['docs'], tone: 'dark', label: 'LES REÇUS', lines: ['Un reçu officiel,', '*vérifiable.*'], chips: ['Reçu', 'QR code'], chipWords: ['reçu', 'QR'], pages: [EX('ec-recu/page-01.jpg')] },
    { ...offer('offer', 12, 'douze', 'ÉCOLES'), tone: 'light' },
    { ...end('end', ['Pilotez votre école', '*avec des chiffres sûrs.*'], OFFRE_12) },
  ],
};

// ================================================================== ONG
const ONG_SONDAGE = {
  key: 'ong-sondage',
  id: 'konadata-pub-ong-sondage',
  voice: VOICES.remy,
  style: 'aurora',
  palette: 'emerald',
  trOffset: 1,
  beats: [
    { k: 'hook', say: 'Une enquête terrain : des questionnaires papier, des semaines de saisie… et des doublons partout ?', pre: 0.45, post: 0.45 },
    { k: 'logo', say: 'Kona Data. Vos enquêtes, du terrain jusqu’au rapport.', pre: 0.75, post: 0.4 },
    { k: 's1', say: 'Créez le questionnaire, et partagez-le par QR code ou par lien.', pre: 0.6, post: 0.3 },
    { k: 's2', say: 'Les enquêteurs collectent sur le terrain, avec la position GPS.', pre: 0.3, post: 0.3 },
    { k: 's3', say: 'Les doublons sont repérés et nettoyés.', pre: 0.3, post: 0.3 },
    { k: 's4', say: 'Graphiques, carte, et rapport Kona A I : l’analyse est prête.', pre: 0.3, post: 0.5 },
    { k: 'map', say: 'Chaque réponse apparaît sur la carte, région par région.', pre: 0.6, post: 0.6 },
    { k: 'offer', say: 'Pour les ONG : six mois gratuits. Ou un sondage seul, sans abonnement complet.', pre: 0.55, post: 0.8 },
    { k: 'end', say: 'Kona Data. Des données fiables pour vos bailleurs. Écrivez-nous sur WhatsApp.', pre: 0.7, post: 2.6 },
  ],
  scenes: [
    { type: 'hook', beats: ['hook'], style: 'menu', label: 'L’ENQUÊTE', lines: ['Une enquête terrain,', '*des semaines*', '*de saisie ?*'], menu: { title: 'Enquête CPN · Kindia', icon: 'clipboard', items: ['Imprimer 1 000 questionnaires', 'Tout ressaisir à la main', 'Chercher les doublons', 'Écrire le rapport'] } },
    { type: 'logo', beats: ['logo'], tone: 'light', tr: 'circle', tagline: ['Vos enquêtes,', '*du terrain au rapport.*'] },
    {
      type: 'steps', beats: ['s1', 's2', 's3', 's4'], tone: 'dark', label: 'LE SONDAGE',
      steps: [
        { beat: 's1', label: 'Créer', title: ['Créez,', '*partagez.*'], card: { icon: 'qr', fg: '#059669', bg: '#D1FAE5', title: 'Consultations prénatales', sub: 'Kindia · mode terrain + en ligne', rows: [{ label: 'Questions', value: '18' }, { label: 'Partage', value: 'QR code · lien' }] } },
        { beat: 's2', label: 'Collecter', title: ['Collectez,', '*avec le GPS.*'], card: { icon: 'pin', fg: '#D97706', bg: '#FEF3C7', title: 'Collecte en cours', sub: '12 enquêteurs', rows: [{ label: 'Réponses', value: '1 248', count: [0, 1248] }, { label: 'Avec position GPS', value: '96 %', count: [0, 96, ' %'], bar: 96, barColor: '#059669' }] } },
        { beat: 's3', label: 'Nettoyer', title: ['Les doublons', '*sont nettoyés.*'], card: { icon: 'sparkles', fg: '#7C3AED', bg: '#EDE9FE', title: 'Qualité des données', sub: 'Contrôle automatique', rows: [{ label: 'Doublons détectés', value: '37', count: [0, 37] }, { label: 'Réponses valides', value: '1 211', count: [0, 1211] }], stamp: { text: 'Nettoyé' }, stampWord: 'nettoyés' } },
        { beat: 's4', label: 'Analyser', title: ['L’analyse', '*est prête.*'], card: { icon: 'chart', fg: '#0284C7', bg: '#E0F2FE', title: 'Analytiques', sub: 'Tableau de bord · carte · KonaAI', rows: [{ label: 'Graphiques', value: '18' }, { label: 'Carte des réponses', value: '✓' }, { label: 'Rapport KonaAI', value: 'PDF' }] } },
      ],
    },
    {
      type: 'map', beats: ['map'], tone: 'light', label: 'LA CARTE', lines: ['Chaque réponse', '*sur la carte.*'],
      counter: { label: 'Réponses géolocalisées', to: 1211 },
      places: [
        { name: 'Conakry', lon: -13.68, lat: 9.55, n: 14, side: 'left' },
        { name: 'Kindia', lon: -12.86, lat: 10.06, n: 18 },
        { name: 'Boké', lon: -14.3, lat: 10.94, n: 10 },
        { name: 'Labé', lon: -12.28, lat: 11.32, n: 12 },
        { name: 'Mamou', lon: -12.09, lat: 10.38, n: 8 },
        { name: 'Faranah', lon: -10.74, lat: 10.04, n: 7 },
        { name: 'Kankan', lon: -9.3, lat: 10.38, n: 11 },
        { name: 'N’Zérékoré', lon: -8.82, lat: 7.75, n: 9 },
      ],
    },
    { ...offer('offer', 6, 'six', 'ONG'), tone: 'dark', rule: 'Ou un sondage seul, sur devis, sans abonnement complet. ' + RULE },
    { ...end('end', ['Des données fiables', '*pour vos bailleurs.*'], OFFRE_6) },
  ],
};

const ONG_BAILLEURS = {
  key: 'ong-bailleurs',
  id: 'konadata-pub-ong-bailleurs',
  voice: VOICES.vivienne,
  style: 'clean',
  palette: 'emerald',
  trOffset: 3,
  beats: [
    { k: 'hook', say: 'Votre bailleur veut le rapport… pour demain ?', pre: 0.45, post: 0.5 },
    { k: 'logo', say: 'Avec Kona Data, vos projets, vos chiffres et vos rapports sont au même endroit.', pre: 0.75, post: 0.4 },
    { k: 'chart', say: 'Budget et dépenses de chaque projet, toujours à jour.', pre: 0.6, post: 0.5 },
    { k: 'list', say: 'Vos bénéficiaires, région par région.', pre: 0.6, post: 0.5 },
    { k: 'docs', say: 'Et le rapport pour le bailleur se génère en quelques minutes, en PDF.', pre: 0.6, post: 0.45 },
    { k: 'all', say: 'Projets, sondages, bénéficiaires et documents : tout dans une seule application.', pre: 0.55, post: 0.45 },
    { k: 'offer', say: 'Pour les ONG : six mois gratuits.', pre: 0.55, post: 0.8 },
    { k: 'end', say: 'Kona Data. Rendez des comptes, sereinement. Écrivez-nous sur WhatsApp.', pre: 0.7, post: 2.6 },
  ],
  scenes: [
    { type: 'hook', beats: ['hook'], label: 'L’ÉCHÉANCE', icon: 'heart', lines: ['Le bailleur', 'veut le rapport…', '*pour demain ?*'] },
    { type: 'logo', beats: ['logo'], tone: 'light', tr: 'circle', tagline: ['Projets, chiffres, rapports :', '*au même endroit.*'] },
    {
      type: 'chart', beats: ['chart'], tone: 'dark', label: 'LES PROJETS', lines: ['Budget et dépenses,', '*toujours à jour.*'],
      kpis: [{ label: 'Budget total', value: '14,8 Md GNF', count: [0, 14.8, ' Md GNF', 1], word: 'budget' }, { label: 'Exécution', value: '64 %', count: [0, 64, ' %'], color: '#059669', word: 'jour' }],
      bars: { title: 'Par projet (milliards GNF)', labels: ['Kindia', 'Boké', 'Labé', 'Kankan'], series: [{ name: 'Budget', color: '#CBD5E1', values: [3.85, 6.4, 2.3, 2.25] }, { name: 'Dépensé', color: '#059669', values: [2.9, 3.6, 1.7, 1.3] }], max: 7 },
    },
    {
      type: 'list', beats: ['list'], tone: 'light', label: 'BÉNÉFICIAIRES', lines: ['Vos bénéficiaires,', '*région par région.*'],
      card: {
        icon: 'heart', fg: '#E11D48', bg: '#FFE4E6', title: 'Bénéficiaires', sub: 'Santé & Avenir Guinée · 2026',
        rows: [
          { label: 'Kindia', sub: 'Santé maternelle', value: '4 820', count: [0, 4820], bar: 92, barColor: '#059669' },
          { label: 'Boké', sub: 'Eau potable', value: '3 150', count: [0, 3150], bar: 60, barColor: '#059669' },
          { label: 'Labé', sub: 'Nutrition', value: '2 640', count: [0, 2640], bar: 50, barColor: '#059669' },
          { label: 'Kankan', sub: 'Scolarisation des filles', value: '1 980', count: [0, 1980], bar: 38, barColor: '#059669' },
        ],
      },
    },
    { type: 'docs', beats: ['docs'], tone: 'dark', label: 'LE RAPPORT', lines: ['Le rapport,', '*en quelques*', '*minutes.*'], chips: ['PDF', 'KonaAI'], chipWords: ['rapport', 'PDF'], pages: [EX('ong-budget/page-01.jpg'), EX('ong-general/page-01.jpg')] },
    { type: 'all', beats: ['all'], tone: 'light', label: 'TOUT-EN-UN', lines: ['Tout dans', '*une seule*', '*application.*'], icons: icons('ong'), mergeWord: 'seule' },
    { ...offer('offer', 6, 'six', 'ONG'), tone: 'dark' },
    { ...end('end', ['Rendez des comptes,', '*sereinement.*'], OFFRE_6) },
  ],
};

// ================================================================== PME
const pmePhone = {
  org: 'Espace Commercial Madina',
  site: { title: 'Boutique Madina · Détail', label: 'Objectif du mois', pct: 74 },
  tiles: TILES.pme,
};

const PME_CREDITS = {
  key: 'pme-credits',
  id: 'konadata-pub-pme-credits',
  voice: VOICES.denise,
  style: 'aurora',
  palette: 'violet',
  trOffset: 2,
  beats: [
    { k: 'hook', say: 'Le cahier de crédits : des noms, des montants… et beaucoup d’oublis.', pre: 0.45, post: 0.5 },
    { k: 'logo', say: 'Avec Kona Data, chaque franc prêté est retrouvé.', pre: 0.75, post: 0.4 },
    { k: 'f1', say: 'Enregistrez un crédit en quelques secondes, avec son échéance.', pre: 0.6, post: 0.3 },
    { k: 'f2', say: 'Notez chaque remboursement, même partiel.', pre: 0.3, post: 0.3 },
    { k: 'f3', say: 'Et voyez d’un coup d’œil tout ce qu’on vous doit.', pre: 0.3, post: 0.5 },
    { k: 'list', say: 'Qui vous doit, combien, et pour quand.', pre: 0.6, post: 0.5 },
    { k: 'offer', say: 'Pour les commerces : six mois gratuits.', pre: 0.55, post: 0.8 },
    { k: 'end', say: 'Kona Data. Votre commerce, sans cahier ni oubli. Écrivez-nous sur WhatsApp.', pre: 0.7, post: 2.6 },
  ],
  scenes: [
    { type: 'hook', beats: ['hook'], style: 'papers', label: 'LE CAHIER', lines: ['Le cahier', 'de crédits…', '*et ses oublis.*'], papers: [['Mamadou — 250 000', 'payé ? ✗'], ['Chez Fanta — 1 090 000', 'le 30 ?'], ['Bah & Fils', '2 400 000 …', 'rappeler !'], ['Boutique Sow', '650 000 ?']] },
    { type: 'logo', beats: ['logo'], tone: 'light', tr: 'circle', tagline: ['Chaque franc prêté,', '*retrouvé.*'] },
    {
      type: 'phone', beats: ['f1', 'f2', 'f3'], tone: 'dark', label: 'LES CRÉDITS', phone: pmePhone,
      features: [
        { beat: 'f1', tile: 3, title: ['Un crédit,', 'une échéance.'], card: { tile: 3, title: 'Nouveau crédit', sub: 'Boutique Madina', rows: [{ label: 'Client', value: 'Restaurant Chez Fanta' }, { label: 'Montant', value: '1 090 000 GNF', count: [0, 1090000, ' GNF'], accent: true }, { label: 'Échéance', value: '30 oct.' }] } },
        { beat: 'f2', tile: 3, title: ['Chaque', 'remboursement.'], card: { tile: 3, title: 'Chez Fanta', sub: 'Remboursement partiel', rows: [{ label: 'Remboursé', value: '500 000 GNF', count: [0, 500000, ' GNF'], bar: 46, barColor: '#7C3AED' }, { label: 'Reste', value: '590 000 GNF', accent: true }], stamp: { text: 'Partiel', tone: 'amber' }, stampWord: 'partiel' } },
        { beat: 'f3', tile: 2, title: ['Tout ce', 'qu’on vous doit.'], card: { tile: 2, title: 'Crédits clients', sub: 'Toutes boutiques', rows: [{ label: 'Clients débiteurs', value: '14', count: [0, 14] }, { label: 'En retard', value: '3', badge: { text: 'À relancer', tone: 'red' } }, { label: 'Total dû', value: '8 000 000 GNF', count: [0, 8000000, ' GNF'], accent: true }] } },
      ],
    },
    {
      type: 'list', beats: ['list'], tone: 'light', label: 'QUI VOUS DOIT', lines: ['Qui vous doit,', '*et pour quand.*'],
      card: {
        icon: 'wallet', fg: '#E11D48', bg: '#FFE4E6', title: 'Crédits en cours', sub: 'Remboursé / total',
        rows: [
          { label: 'Alimentation Bah & Fils', sub: 'Échéance 15 oct.', value: '2 400 000', bar: 40, barColor: '#7C3AED', badge: { text: 'En retard', tone: 'red' } },
          { label: 'Restaurant Chez Fanta', sub: 'Échéance 30 oct.', value: '590 000', bar: 46, barColor: '#7C3AED' },
          { label: 'Boutique Sow', sub: 'Échéance 5 nov.', value: '650 000', bar: 20, barColor: '#7C3AED' },
        ],
      },
    },
    { ...offer('offer', 6, 'six', 'COMMERCES'), tone: 'dark' },
    { ...end('end', ['Votre commerce,', '*sans cahier ni oubli.*'], OFFRE_6) },
  ],
};

const PME_STOCK = {
  key: 'pme-stock',
  id: 'konadata-pub-pme-stock',
  voice: VOICES.henri,
  style: 'night',
  palette: 'violet',
  trOffset: 0,
  beats: [
    { k: 'hook', say: 'Jour de marché. Plus de riz en rayon. Et les clients partent ailleurs.', pre: 0.45, post: 0.5 },
    { k: 'logo', say: 'Avec Kona Data, votre stock vous prévient avant la rupture.', pre: 0.75, post: 0.4 },
    { k: 'list', say: 'Fixez un seuil d’alerte pour chaque article : le stock bas est signalé.', pre: 0.6, post: 0.5 },
    { k: 'chart', say: 'Ventes, achats et dépenses : suivez votre activité, semaine après semaine.', pre: 0.6, post: 0.5 },
    { k: 'docs', say: 'Et l’analyse financière du mois sort en PDF.', pre: 0.6, post: 0.45 },
    { k: 'offer', say: 'Pour les commerces : six mois gratuits.', pre: 0.55, post: 0.8 },
    { k: 'end', say: 'Kona Data. Ne ratez plus une vente. Écrivez-nous sur WhatsApp.', pre: 0.7, post: 2.6 },
  ],
  scenes: [
    { type: 'hook', beats: ['hook'], label: 'LA RUPTURE', icon: 'store', lines: ['Jour de marché…', '*plus de riz ?*'] },
    { type: 'logo', beats: ['logo'], tone: 'light', tr: 'circle', tagline: ['Votre stock vous prévient', '*avant la rupture.*'] },
    {
      type: 'list', beats: ['list'], tone: 'dark', label: 'LE STOCK', lines: ['Un seuil', '*pour chaque article.*'],
      card: {
        icon: 'package', fg: '#D97706', bg: '#FEF3C7', title: 'Stocks', sub: 'Boutique Madina · Détail',
        rows: [
          { label: 'Riz brisé 25 kg', sub: 'Seuil : 20 sacs', value: '8 sacs', badge: { text: 'Stock bas', tone: 'red' } },
          { label: 'Huile 20 L', sub: 'Seuil : 10 bidons', value: '14 bidons', badge: { text: 'OK', tone: 'green' } },
          { label: 'Sucre 50 kg', sub: 'Seuil : 10 sacs', value: '5 sacs', badge: { text: 'Stock bas', tone: 'red' } },
          { label: 'Lait en poudre', sub: 'Seuil : 24 boîtes', value: '60 boîtes', badge: { text: 'OK', tone: 'green' } },
        ],
      },
    },
    {
      type: 'chart', beats: ['chart'], tone: 'light', label: 'L’ACTIVITÉ', lines: ['Votre activité,', '*semaine après semaine.*'],
      kpis: [{ label: 'Ventes du mois', value: '68,4 M', count: [0, 68.4, ' M', 1], word: 'ventes' }, { label: 'Dépenses', value: '9,2 M', count: [0, 9.2, ' M', 1], color: '#DC2626', word: 'dépenses' }],
      bars: { title: 'Par semaine (millions GNF)', labels: ['S1', 'S2', 'S3', 'S4'], series: [{ name: 'Ventes', color: '#7C3AED', values: [15.2, 17.8, 16.1, 19.3] }, { name: 'Achats', color: '#F59E0B', values: [11, 9.5, 12.4, 10.2] }], max: 22 },
    },
    { type: 'docs', beats: ['docs'], tone: 'dark', label: 'L’ANALYSE', lines: ['L’analyse du mois,', '*en PDF.*'], chips: ['PDF', 'Par boutique'], chipWords: ['analyse', 'PDF'], pages: [EX('pme-mois/page-02.jpg'), EX('pme-mois/page-01.jpg')] },
    { ...offer('offer', 6, 'six', 'COMMERCES'), tone: 'light' },
    { ...end('end', ['Ne ratez plus', '*une vente.*'], OFFRE_6) },
  ],
};

const PME_BOUTIQUES = {
  key: 'pme-boutiques',
  id: 'konadata-pub-pme-boutiques',
  voice: VOICES.remy,
  style: 'clean',
  palette: 'violet',
  trOffset: 4,
  beats: [
    { k: 'hook', say: 'Deux boutiques, deux cahiers… et un seul patron qui ne peut pas être partout.', pre: 0.45, post: 0.5 },
    { k: 'logo', say: 'Avec Kona Data, toutes vos boutiques tiennent sur un seul écran.', pre: 0.75, post: 0.4 },
    { k: 'f1', say: 'Chaque vente est enregistrée, avec le client et le statut du paiement.', pre: 0.6, post: 0.3 },
    { k: 'f2', say: 'Les achats chez vos fournisseurs sont suivis.', pre: 0.3, post: 0.3 },
    { k: 'f3', say: 'Et chaque dépense est classée.', pre: 0.3, post: 0.5 },
    { k: 'chart', say: 'Comparez vos boutiques, chiffre par chiffre.', pre: 0.6, post: 0.5 },
    { k: 'all', say: 'Ventes, stocks, clients, crédits : tout dans une seule application. Sur téléphone et ordinateur.', pre: 0.55, post: 0.45 },
    { k: 'offer', say: 'Pour les commerces : six mois gratuits.', pre: 0.55, post: 0.8 },
    { k: 'end', say: 'Kona Data. Gérez vos boutiques, même à distance. Écrivez-nous sur WhatsApp.', pre: 0.7, post: 2.6 },
  ],
  scenes: [
    { type: 'hook', beats: ['hook'], style: 'menu', label: 'LA JOURNÉE', lines: ['Deux boutiques,', 'deux cahiers…', '*un seul patron.*'], menu: { title: 'Ma journée', icon: 'store', items: ['Passer à Madina', 'Filer au dépôt de Matam', 'Compter la recette', 'Vérifier le stock'] } },
    { type: 'logo', beats: ['logo'], tone: 'light', tr: 'circle', tagline: ['Toutes vos boutiques,', '*sur un seul écran.*'] },
    {
      type: 'phone', beats: ['f1', 'f2', 'f3'], tone: 'dark', label: 'AU QUOTIDIEN', phone: { ...pmePhone, site: { title: 'Dépôt Matam · Gros', label: 'Objectif du mois', pct: 81 } },
      features: [
        { beat: 'f1', tile: 0, title: ['Chaque vente,', 'enregistrée.'], card: { tile: 0, title: 'Vente V-2026-0418', sub: 'Dépôt Matam · Gros', rows: [{ label: 'Client', value: 'Alimentation Bah & Fils' }, { label: 'Montant', value: '2 520 000 GNF', count: [0, 2520000, ' GNF'], accent: true }, { label: 'Paiement', value: '', badge: { text: 'Payé', tone: 'green' } }] } },
        { beat: 'f2', tile: 4, title: ['Vos achats,', 'suivis.'], card: { tile: 4, title: 'Achat fournisseur', sub: 'Grossiste Kaloum Import', rows: [{ label: '20 sacs de riz 25 kg', value: '5 600 000 GNF', count: [0, 5600000, ' GNF'] }, { label: 'Statut', value: '', badge: { text: 'Reçu', tone: 'green' } }] } },
        { beat: 'f3', tile: 5, title: ['Chaque dépense,', 'classée.'], card: { icon: 'wallet', fg: '#E11D48', bg: '#FFE4E6', title: 'Dépense', sub: 'Boutique Madina', rows: [{ label: 'Transport marchandises', value: '350 000 GNF' }, { label: 'Catégorie', value: 'Logistique' }] } },
      ],
    },
    {
      type: 'chart', beats: ['chart'], tone: 'light', label: 'COMPARAISON', lines: ['Vos boutiques,', '*chiffre par chiffre.*'],
      kpis: [{ label: 'Madina · Détail', value: '41,2 M', count: [0, 41.2, ' M', 1], word: 'boutiques' }, { label: 'Matam · Gros', value: '96,8 M', count: [0, 96.8, ' M', 1], color: '#7C3AED', word: 'chiffre' }],
      bars: { title: 'Ventes par mois (millions GNF)', labels: ['Juil.', 'Août', 'Sept.', 'Oct.'], series: [{ name: 'Madina', color: '#C4B5FD', values: [9.1, 10.4, 10.2, 11.5] }, { name: 'Matam', color: '#7C3AED', values: [22.5, 24.1, 23.6, 26.6] }], max: 30 },
    },
    { type: 'all', beats: ['all'], tone: 'dark', label: 'TOUT-EN-UN', lines: ['Tout dans', '*une seule*', '*application.*'], icons: icons('pme'), chips: DEVICES },
    { ...offer('offer', 6, 'six', 'COMMERCES'), tone: 'light' },
    { ...end('end', ['Gérez vos boutiques,', '*même à distance.*'], OFFRE_6) },
  ],
};

export const ADS = [
  BTP_CHANTIER,
  BTP_PERTES,
  BTP_DEVIS,
  BTP_DIASPORA,
  ECOLE_BULLETINS,
  ECOLE_PARENTS,
  ECOLE_DIRECTION,
  ONG_SONDAGE,
  ONG_BAILLEURS,
  PME_CREDITS,
  PME_STOCK,
  PME_BOUTIQUES,
];
