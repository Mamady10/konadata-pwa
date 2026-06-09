/**
 * Timeline vidéo démo — images + durées + narration (script voix off).
 * Dossier captures : docs/demo-video/captures/
 */
export const CAPTURES_DIR = 'docs/demo-video/captures';

/** @typedef {{ id: string; image: string; durationSec: number; narration: string; subtitle: string }} DemoScene */

/** Version complète ~3 min 20 */
export const FULL_DEMO_SCENES = [
  {
    id: '01-intro',
    image: '01-intro-landing.png',
    durationSec: 18,
    narration:
      "En Guinée, les organisations perdent des heures à ressaisir des listes et compiler des rapports sur des fichiers dispersés. KonaData est la plateforme intelligente qui centralise vos données, sur ordinateur et mobile, même avec une connexion 3G.",
    subtitle: 'KonaData — La gestion de données, simplifiée.',
  },
  {
    id: '02-secteurs',
    image: '02-secteurs.png',
    durationSec: 24,
    narration:
      "Une seule plateforme, quatre univers métiers. Établissements scolaires : inscriptions, notes et bulletins. ONG : projets, bénéficiaires et sondages terrain. BTP : chantiers, carburant et stocks. PME : ventes, achats et stocks au quotidien.",
    subtitle: 'Multi-secteur · Un compte, votre métier',
  },
  {
    id: '03-konai',
    image: '03-fonctionnalites.png',
    durationSec: 18,
    narration:
      "KonaData intègre KonaAI : lecture automatique de documents scannés, extraction de listes et génération de rapports pour vos bailleurs ou votre direction. Vous déposez un fichier, l'IA structure, vous validez.",
    subtitle: 'KonaAI — OCR · Structuration · Rapports',
  },
  {
    id: '04-login',
    image: '05-login.png',
    durationSec: 12,
    narration:
      "Connexion par email ou par numéro de téléphone, avec code de vérification par SMS. Adapté aux réalités du terrain guinéen.",
    subtitle: 'Connexion sécurisée · Email ou téléphone',
  },
  {
    id: '05-ecole-dashboard',
    image: '09-school-dashboard.png',
    durationSec: 16,
    narration:
      "Côté établissement, la direction accède à un tableau de bord clair : évolution des inscriptions, paiements et vue d'ensemble de la scolarité.",
    subtitle: 'Établissements — Tableau de bord',
  },
  {
    id: '06-import-ia',
    image: '11-school-import-ia.png',
    durationSec: 27,
    narration:
      "Fini la ressaisie manuelle. Déposez un fichier Excel, un PDF, ou même une photo d'un registre manuscrit. KonaAI extrait les noms, matricules et contacts. Vous choisissez la classe et validez l'import en quelques secondes.",
    subtitle: 'Import intelligent · Excel · PDF · Photo · KonaAI Vision',
  },
  {
    id: '07-resultats',
    image: '12-school-resultats.png',
    durationSec: 13,
    narration:
      "Les enseignants saisissent les résultats par classe. Les directeurs suivent les moyennes et le classement en temps réel.",
    subtitle: 'Résultats & évaluations',
  },
  {
    id: '08-bulletins',
    image: '13-school-bulletins.png',
    durationSec: 12,
    narration:
      "En un clic, générez les bulletins avec classement automatique, prêts pour les élèves et leurs familles.",
    subtitle: 'Bulletins PDF · Classement automatique',
  },
  {
    id: '09-sondages',
    image: '23-ngo-sondages.png',
    durationSec: 15,
    narration:
      "Côté ONG, lancez des sondages terrain, idéal pour une campagne ponctuelle ou une étude de besoins sur le terrain.",
    subtitle: 'Sondages ONG · Campagnes terrain',
  },
  {
    id: '10-qr',
    image: '26-ngo-collecte-qr.png',
    durationSec: 13,
    narration:
      "Partagez un QR code ou un lien. Les participants répondent depuis leur téléphone, en français, avec vérification par SMS si nécessaire.",
    subtitle: 'Collecte mobile · QR code',
  },
  {
    id: '11-analytiques',
    image: '25-ngo-analytiques.png',
    durationSec: 20,
    narration:
      "Visualisez les réponses en direct : graphiques, carte et détection des doublons. Puis laissez KonaAI rédiger le rapport de synthèse, prêt pour le bailleur ou le comité de direction.",
    subtitle: 'Analytiques · Rapport KonaAI automatique',
  },
  {
    id: '12-pwa',
    image: '01-intro-landing.png',
    durationSec: 12,
    narration:
      "Installez KonaData sur l'écran d'accueil de votre téléphone, comme une application, sans passer par le Play Store. Les formulaires s'envoient dès que le réseau revient.",
    subtitle: 'PWA · Installable · Hors-ligne',
  },
  {
    id: '13-outro',
    image: '08-contact.png',
    durationSec: 10,
    narration:
      "KonaData : vos données, votre terrain, votre intelligence. Rendez-vous sur konadatagn.com pour créer votre organisation ou demander une démonstration.",
    subtitle: 'konadatagn.com · contact@konadatagn.com',
  },
];

/**
 * Formation établissement scolaire — parcours pilote ~10–12 min
 * (script détaillé : docs/demo-video/SCRIPT-DEMO-PILOTE-ECOLE-15MIN.md)
 */
export const SCHOOL_FORMATION_SCENES = [
  {
    id: 's01-intro',
    image: '05-login.png',
    durationSec: 22,
    narration:
      "Bienvenue dans cette formation KonaData pour les établissements scolaires. En quinze minutes, nous parcourrons le cycle complet : catalogue des classes, assignations enseignants, inscriptions, notes, bulletins PDF et suivi des paiements. Connectez-vous avec votre compte établissement pour commencer.",
    subtitle: 'Formation établissement — Parcours pilote',
  },
  {
    id: 's02-dashboard',
    image: '09-school-dashboard.png',
    durationSec: 28,
    narration:
      "Le tableau de bord direction regroupe les indicateurs clés : effectifs, paiements, classes actives. Chaque rôle ne voit que ce qui le concerne : le comptable les encaissements, l'enseignant ses classes assignées, le directeur l'ensemble de l'établissement. Le menu latéral mène aux candidatures, étudiants, formations, résultats, bulletins et paiements.",
    subtitle: 'Tableau de bord — Vision par rôle',
  },
  {
    id: 's03-formations',
    image: '16-school-formations.png',
    durationSec: 38,
    narration:
      "Dans Formations, le catalogue est organisé par palier : collège avec trimestres, lycée avec semestres. Créez des classes en un clic via les modèles par palier, importez un fichier Excel ou CSV, puis gérez les matières avec les presets adaptés. Modifier ou archiver une classe n'efface pas l'historique : vous gardez la traçabilité.",
    subtitle: 'Formations — Paliers · Classes · Matières',
  },
  {
    id: 's04-assignations',
    image: '17-school-assignations.png',
    durationSec: 32,
    narration:
      "Les assignations relient chaque enseignant à ses couples classe et matière. Le regroupement par palier facilite la lecture. Un bandeau orange signale les couples sans professeur. Règle importante : un seul enseignant par couple classe-matière. Après enregistrement, les cases restent cochées : l'enseignant ne saisit que ce qu'on lui a assigné.",
    subtitle: 'Assignations — Un prof par classe/matière',
  },
  {
    id: 's05-import',
    image: '11-school-import-ia.png',
    durationSec: 34,
    narration:
      "L'import d'élèves évite la ressaisie manuelle. Sélectionnez la classe cible, déposez un CSV ou Excel, ou utilisez KonaAI pour lire une photo de registre. L'aperçu vous permet de corriger avant validation. Les matricules peuvent être générés automatiquement. Depuis la fiche élève, consultez l'historique scolaire et l'échéancier des frais.",
    subtitle: 'Inscriptions — Import CSV · Excel · IA',
  },
  {
    id: 's06-etudiants',
    image: '10-school-etudiants.png',
    durationSec: 24,
    narration:
      "La liste des étudiants permet de filtrer par classe, rechercher par nom ou matricule, et ouvrir chaque dossier. La scolarité y gère les inscriptions ; le comptable consulte les effectifs en lecture seule. Chaque fiche regroupe identité, contacts tuteur, documents et solde des frais de scolarité.",
    subtitle: 'Étudiants — Dossiers & échéancier',
  },
  {
    id: 's07-resultats',
    image: '12-school-resultats.png',
    durationSec: 40,
    narration:
      "La saisie des notes se fait par classe, matière et période — trimestre ou semestre selon le palier. Dans la grille, zéro sur vingt est une note réelle saisie. Une case vide signifie note manquante : le directeur est alerté lors de la génération des bulletins. L'import CSV accélère la saisie collective. Les enseignants n'accèdent qu'aux classes qui leur sont assignées.",
    subtitle: 'Résultats — 0/20 ≠ case vide',
  },
  {
    id: 's08-bulletins',
    image: '13-school-bulletins.png',
    durationSec: 48,
    narration:
      "Les bulletins sont le cœur du module. Choisissez classe, période et année, puis cochez les types d'évaluation retenus : devoir, composition, interrogation. Seuls ces types entrent dans la moyenne et le PDF. Le panneau de complétude affiche le pourcentage de notes saisies. Générez en provisoire d'abord, exportez le conseil de classe en CSV, puis le PDF ou ZIP une fois logo et cachet configurés. Publiez en définitif avec notification SMS aux familles.",
    subtitle: 'Bulletins — Provisoire → Définitif',
  },
  {
    id: 's09-paiements',
    image: '18-school-paiements.png',
    durationSec: 36,
    narration:
      "Le module paiements suit le recouvrement des frais de scolarité. Les indicateurs affichent impayés, créances et retards. L'onglet Impayés liste les élèves en retard, filtrable par classe, avec lien direct vers la fiche. Enregistrez un paiement au guichet : l'échéancier se met à jour immédiatement. Exportez les impayés en Excel pour le suivi quotidien du comptable.",
    subtitle: 'Paiements — Impayés · Encaissements',
  },
  {
    id: 's10-parents',
    image: '19-suivi-scolarite.png',
    durationSec: 30,
    narration:
      "Les parents n'ont pas besoin de créer un compte. Sur la page Suivi scolarité, ils saisissent le matricule de l'élève et reçoivent un code par SMS. Ils consultent ensuite le solde des frais et téléchargent le bulletin PDF publié. C'est le lien entre l'établissement et les familles, sans application à installer.",
    subtitle: 'Suivi scolarité — Portail parents',
  },
  {
    id: 's11-recap',
    image: '09-school-dashboard.png',
    durationSec: 28,
    narration:
      "Récapitulons le parcours pilote : catalogue par palier, assignations enseignants, import des élèves, saisie des notes, bulletins fiables provisoires puis définitifs, encaissement et portail parents. KonaData remplace les fichiers dispersés par un espace unique, sur ordinateur et mobile. Rendez-vous sur konadatagn.com pour votre démonstration personnalisée.",
    subtitle: 'konadatagn.com — Votre pilote commence ici',
  },
];

/** Teaser formation école ~2 min (réseaux sociaux) */
export const SCHOOL_TEASER_SCENES = [
  SCHOOL_FORMATION_SCENES[0],
  { ...SCHOOL_FORMATION_SCENES[2], durationSec: 18 },
  { ...SCHOOL_FORMATION_SCENES[6], durationSec: 16 },
  { ...SCHOOL_FORMATION_SCENES[7], durationSec: 20 },
  { ...SCHOOL_FORMATION_SCENES[8], durationSec: 14 },
  { ...SCHOOL_FORMATION_SCENES[10], durationSec: 12 },
];

/** Teaser 60 secondes */
export const TEASER_SCENES = [
  FULL_DEMO_SCENES[0],
  { ...FULL_DEMO_SCENES[1], durationSec: 10 },
  { ...FULL_DEMO_SCENES[5], durationSec: 18 },
  { ...FULL_DEMO_SCENES[10], durationSec: 15 },
  { ...FULL_DEMO_SCENES[11], durationSec: 8 },
  { ...FULL_DEMO_SCENES[12], durationSec: 9 },
];
