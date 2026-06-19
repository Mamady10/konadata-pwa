/**
 * Formations vidéo KonaData — secteur BTP (une vidéo par profil).
 * Captures : docs/demo-video/captures/ (npm run capture:demo:all)
 */
import { CAPTURES_DIR } from './demo-video-timeline.mjs';

export { CAPTURES_DIR };

/** @typedef {{ id: string; image: string; durationSec: number; narration: string; subtitle: string }} BtpTrainingScene */

/** @type {Record<string, { title: string; audience: string; outputFile: string; scenes: BtpTrainingScene[] }>} */
export const BTP_TRAINING_BY_ROLE = {
  direction: {
    title: 'Formation Direction BTP',
    audience: 'Directeur entreprise BTP (org_admin, deputy_director)',
    outputFile: 'konadata-formation-btp-direction.mp4',
    scenes: [
      {
        id: 'btp-dir-01',
        image: '05-login.png',
        durationSec: 24,
        narration:
          "Formation Direction BTP KonaData. Connectez-vous avec l'onglet Email ou WhatsApp. Compte démo : demo point btp at konadata point demo. Vous pilotez tous les chantiers, les finances et le personnel. Cette vidéo couvre votre routine de direction, dans l'ordre.",
        subtitle: 'Direction BTP — Connexion',
      },
      {
        id: 'btp-dir-02',
        image: '30-btp-dashboard.png',
        durationSec: 30,
        narration:
          "Tableau de bord BTP : chantiers actifs, avancement moyen, carburant, derniers bons de livraison, alertes stock. Le menu latéral ouvre Chantiers, Personnel, Finances, Rapports. Commencez chaque matin par ce tableau pour repérer les écarts planifié versus réel.",
        subtitle: 'Tableau de bord — Vue consolidée',
      },
      {
        id: 'btp-dir-03',
        image: '31-btp-chantiers.png',
        durationSec: 38,
        narration:
          "Chantiers : bouton Ajouter pour un nouveau marché. Renseignez budget total, déjà engagé au démarrage, répartition par poste en pourcentage, jalons. Sur chaque carte, configurez Référence un et Référence deux : dates linéaires, jalons KonaData, ou import MS Project en XML. La référence par défaut sert pour l'avancement et les rapports.",
        subtitle: 'Chantiers — Budget & planning',
      },
      {
        id: 'btp-dir-04',
        image: '40-btp-assignations.png',
        durationSec: 28,
        narration:
          "Assignations : menu Utilisateurs, puis Assignations. Cochez les chantiers pour chaque chef de terrain. Sans assignation, le collaborateur ne peut pas saisir l'avancement. Enregistrez avant d'envoyer les comptes sur le terrain.",
        subtitle: 'Assignations — Chefs de chantier',
      },
      {
        id: 'btp-dir-05',
        image: '32-btp-personnel.png',
        durationSec: 34,
        narration:
          "Personnel : ajoutez manuellement ou importez un Excel salaires. Le modèle Excel contient Nom, Salaire mensuel, Fonction. Les salaires alimentent automatiquement la main d'œuvre en Finances. Le pointage jours fois taux journalier complète la MO terrain.",
        subtitle: 'Personnel — MO & import Excel',
      },
      {
        id: 'btp-dir-06',
        image: '37-btp-finances.png',
        durationSec: 36,
        narration:
          "Finances : onglet Par chantier. Lisez le pourcentage financier, la barre budget, puis le tableau Budget versus réel par poste : main d'œuvre, matériaux, engins, sous-traitance, frais généraux. Le montant déjà engagé au démarrage s'ajoute aux dépenses saisies : ne doublez pas les montants.",
        subtitle: 'Finances — Budget vs réel',
      },
      {
        id: 'btp-dir-07',
        image: '38-btp-avancement.png',
        durationSec: 28,
        narration:
          "Avancement : la direction peut saisir ou contrôler les relevés. Vérifiez le panneau planifié versus réel : Conforme, Vigilance ou Alerte. Saisissez aussi l'avancement financier et le retard en jours si vous centralisez la saisie.",
        subtitle: 'Avancement — Contrôle planifié vs réel',
      },
      {
        id: 'btp-dir-08',
        image: '36-btp-bons.png',
        durationSec: 26,
        narration:
          "Bons de livraison : chaque réception fournisseur passe par un BL. Brouillon, puis Valider le bon. Les montants validés entrent en matériaux. Cochez mise à jour stock si les quantités doivent alimenter le magasin chantier.",
        subtitle: 'BL — Validation & matériaux',
      },
      {
        id: 'btp-dir-09',
        image: '39-btp-rapports.png',
        durationSec: 40,
        narration:
          "Rapports : choisissez chantier, période semaine mois ou trimestre, référence planning, commentaire de synthèse. Cliquez Compiler le rapport. Exportez PDF ou PPTX pour la MOA. Le rapport archive automatiquement pour la direction.",
        subtitle: 'Rapports — Compilation & export MOA',
      },
      {
        id: 'btp-dir-10',
        image: '30-btp-dashboard.png',
        durationSec: 22,
        narration:
          "Récap direction BTP : créer chantiers et planning, assigner le terrain, importer le personnel, valider les BL, suivre Finances, compiler les rapports périodiques. Déléguez la saisie quotidienne aux chefs de chantier. Support : contact at konadatagn point com.",
        subtitle: 'Direction BTP — Synthèse',
      },
    ],
  },

  chef: {
    title: 'Formation Chef de chantier',
    audience: 'Chef de chantier / terrain (btp_staff)',
    outputFile: 'konadata-formation-btp-chef.mp4',
    scenes: [
      {
        id: 'btp-chef-01',
        image: '05-login.png',
        durationSec: 22,
        narration:
          "Formation Chef de chantier KonaData. Connectez-vous : demo point chef point btp at konadata point demo. Vous ne voyez que les chantiers que la direction vous a assignés. Pas d'accès Personnel ni Finances : votre rôle est la saisie terrain et les rapports hebdomadaires.",
        subtitle: 'Chef — Connexion & périmètre',
      },
      {
        id: 'btp-chef-02',
        image: '41-btp-chef-dashboard.png',
        durationSec: 26,
        narration:
          "Votre tableau de bord liste uniquement vos chantiers assignés. Si un chantier manque, contactez la direction pour une assignation : ce n'est pas le support KonaData. Vérifiez les alertes carburant et stock sur vos sites.",
        subtitle: 'Mon espace — Chantiers assignés',
      },
      {
        id: 'btp-chef-03',
        image: '42-btp-chef-avancement.png',
        durationSec: 38,
        narration:
          "Avancement : bouton Saisir l'avancement, Nouveau relevé. Choisissez le chantier, la date, le pourcentage physique, la référence planning un ou deux. Le panneau planifié versus réel vous indique si vous êtes en retard. Renseignez effectif, météo, observations terrain. Enregistrer.",
        subtitle: 'Relevé journalier — Physique & terrain',
      },
      {
        id: 'btp-chef-04',
        image: '36-btp-bons.png',
        durationSec: 30,
        narration:
          "À chaque livraison : Nouveau BL, référence fournisseur, montant, lignes articles. Enregistrer en brouillon le jour de la livraison, Valider le bon une fois les quantités contrôlées. Joignez le scan depuis Documents si disponible.",
        subtitle: 'BL — Saisie terrain',
      },
      {
        id: 'btp-chef-05',
        image: '33-btp-carburant.png',
        durationSec: 26,
        narration:
          "Carburant : relevé quotidien ou hebdomadaire par engin. Litres consommés, chantier, date. Une consommation anormale peut déclencher une alerte visible par la direction.",
        subtitle: 'Carburant — Relevés engins',
      },
      {
        id: 'btp-chef-06',
        image: '35-btp-materiels.png',
        durationSec: 24,
        narration:
          "Matériels : entrée ou sortie stock si votre entreprise utilise le magasin chantier. Vérifiez les seuils Alerte et Critique avant rupture.",
        subtitle: 'Stock — Entrées & sorties',
      },
      {
        id: 'btp-chef-07',
        image: '34-btp-documents.png',
        durationSec: 22,
        narration:
          "Documents : téléversez photos de BL, rapports sécurité, plans. Choisissez le bon chantier avant upload. La direction peut extraire le texte automatiquement.",
        subtitle: 'Documents — Pièces chantier',
      },
      {
        id: 'btp-chef-08',
        image: '43-btp-chef-rapports.png',
        durationSec: 36,
        narration:
          "Chaque vendredi : Rapports, sélectionnez votre chantier, période Semaine, référence planning, commentaire risques semaine prochaine. Compiler le rapport, télécharger PDF, transmettre à la direction par WhatsApp ou email. C'est votre livrable hebdomadaire MOA.",
        subtitle: 'Rapport hebdo — Transmettre à la direction',
      },
      {
        id: 'btp-chef-09',
        image: '42-btp-chef-avancement.png',
        durationSec: 20,
        narration:
          "Routine chef : avancement quotidien, BL à réception, carburant, rapport vendredi. En cas de blocage technique, lisez le bandeau rouge en haut de page. Support entreprise d'abord, puis contact at konadatagn point com.",
        subtitle: 'Chef — Routine hebdomadaire',
      },
    ],
  },
};

export const BTP_TRAINING_ROLE_IDS = Object.keys(BTP_TRAINING_BY_ROLE);
