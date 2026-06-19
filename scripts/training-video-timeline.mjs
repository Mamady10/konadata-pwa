/**
 * Formations vidéo KonaData — une vidéo par profil utilisateur (établissement scolaire).
 * Narration pas-à-pas : « où cliquer », pas présentation marketing.
 *
 * Captures : docs/demo-video/captures/ (npm run capture:demo:all)
 */
import { CAPTURES_DIR } from './demo-video-timeline.mjs';

export { CAPTURES_DIR };

/** @typedef {{ id: string; image: string; durationSec: number; narration: string; subtitle: string }} TrainingScene */

/** @type {Record<string, { title: string; audience: string; outputFile: string; scenes: TrainingScene[] }>} */
export const TRAINING_BY_ROLE = {
  direction: {
    title: 'Formation Direction',
    audience: 'Directeur · Directeur adjoint (org_admin, deputy_director)',
    outputFile: 'konadata-formation-direction.mp4',
    scenes: [
      {
        id: 'dir-01',
        image: '05-login.png',
        durationSec: 26,
        narration:
          "Formation Direction KonaData. Connectez-vous avec l'onglet WhatsApp ou Email, selon le compte créé par votre établissement. Vous arrivez sur le tableau de bord établissement : c'est votre poste de pilotage quotidien. Cette vidéo couvre uniquement ce que la direction doit savoir faire, dans l'ordre.",
        subtitle: 'Direction — Connexion & périmètre',
      },
      {
        id: 'dir-02',
        image: '09-school-dashboard.png',
        durationSec: 32,
        narration:
          "Sur le tableau de bord, lisez les cartes effectifs, paiements et alertes. Le menu latéral ouvre tous les modules : candidatures, étudiants, formations, résultats, bulletins, paiements, rapports. En tant que directeur, vous avez accès à l'ensemble. Vérifiez la checklist de démarrage si elle s'affiche : elle liste les étapes avant la rentrée.",
        subtitle: 'Tableau de bord — Indicateurs & menu',
      },
      {
        id: 'dir-03',
        image: '16-school-formations.png',
        durationSec: 38,
        narration:
          "Ouvrez Formations. Onglet Classes : filtrez par palier collège ou lycée. Cochez les modèles, cliquez Créer, ou importez un Excel via Modèle Excel. Onglet Matières : activez les presets du palier. Règle clé : le palier de la classe fixe les trimestres ou semestres pour les notes et bulletins. Archivez une classe obsolète au lieu de la supprimer.",
        subtitle: 'Formations — Catalogue classes & matières',
      },
      {
        id: 'dir-04',
        image: '17-school-assignations.png',
        durationSec: 34,
        narration:
          "Menu Utilisateurs, puis Assignations. Pour chaque enseignant, cochez les couples classe et matière qu'il enseigne. Le bandeau orange signale un couple sans professeur. Un seul enseignant par couple : c'est obligatoire. Cliquez Enregistrer. Sans assignation, l'enseignant ne verra aucune classe dans Résultats.",
        subtitle: 'Assignations — Relier profs & classes',
      },
      {
        id: 'dir-05',
        image: '14-school-candidatures.png',
        durationSec: 28,
        narration:
          "Candidatures : ouvrez chaque dossier, vérifiez les pièces jointes, puis Valider ou Refuser. Un SMS peut prévenir la famille à la confirmation. Une fois validé, l'élève apparaît dans Étudiants ou peut finaliser son inscription selon votre processus.",
        subtitle: 'Candidatures — Valider les dossiers',
      },
      {
        id: 'dir-06',
        image: '12-school-resultats.png',
        durationSec: 30,
        narration:
          "Résultats : la direction peut contrôler la saisie globale. Filtrez classe, matière, période. Dans la grille, zéro sur vingt est une note saisie ; une case vide est une note manquante. Avant les bulletins, repérez les trous : le panneau complétude vous aidera ensuite.",
        subtitle: 'Résultats — Contrôle avant bulletins',
      },
      {
        id: 'dir-07',
        image: '13-school-bulletins.png',
        durationSec: 42,
        narration:
          "Bulletins : choisissez classe, période et année. Cochez les types d'évaluation retenus : seuls ceux-ci entrent dans la moyenne et le PDF. Générez en provisoire, vérifiez la complétude, exportez le conseil de classe CSV si besoin. Configurez logo et cachet dans Paramètres bulletin avant le PDF. Publiez en définitif pour débloquer le téléchargement côté élève et parent.",
        subtitle: 'Bulletins — Provisoire puis définitif',
      },
      {
        id: 'dir-08',
        image: '18-school-paiements.png',
        durationSec: 26,
        narration:
          "Paiements : suivez le taux de recouvrement et l'onglet Impayés. La direction valide la politique tarifaire dans Paramètres paiements élèves. Le comptable encaisse au guichet ; vous supervisez les retards par classe.",
        subtitle: 'Paiements — Supervision recouvrement',
      },
      {
        id: 'dir-09',
        image: '09-school-dashboard.png',
        durationSec: 22,
        narration:
          "Récapitulatif direction : catalogue, assignations, validation candidatures, contrôle des notes, bulletins définitifs, suivi financier. Déléguez la saisie aux enseignants et à la scolarité, gardez la validation finale. Support : contact at konadatagn.com.",
        subtitle: 'Direction — Synthèse & délégation',
      },
    ],
  },

  scolarite: {
    title: 'Formation Scolarité',
    audience: 'Agent scolarité · Secrétariat (registrar)',
    outputFile: 'konadata-formation-scolarite.mp4',
    scenes: [
      {
        id: 'reg-01',
        image: '05-login.png',
        durationSec: 22,
        narration:
          "Formation Scolarité KonaData. Connectez-vous avec votre compte scolarité. Vous gérez les inscriptions, les listes d'élèves et le catalogue classes-matières. Vous ne générez pas les bulletins ni les assignations enseignants : c'est le rôle de la direction.",
        subtitle: 'Scolarité — Votre rôle',
      },
      {
        id: 'reg-02',
        image: '14-school-candidatures.png',
        durationSec: 34,
        narration:
          "Commencez par Candidatures. Triez par statut : nouveau, en cours, validé. Ouvrez un dossier, contrôlez l'acte de naissance et les pièces, ajoutez un commentaire interne si besoin, puis Valider ou Refuser. Routine rentrée : traitez les dossiers du plus ancien au plus récent.",
        subtitle: 'Candidatures — Traitement quotidien',
      },
      {
        id: 'reg-03',
        image: '11-school-import-ia.png',
        durationSec: 36,
        narration:
          "Import élèves : menu Étudiants, bouton Import. Choisissez la classe cible. Déposez un CSV ou Excel — téléchargez le modèle si nécessaire — ou une photo de registre pour l'extraction KonaAI. Vérifiez l'aperçu ligne par ligne, corrigez les doublons, puis Importer. Les matricules se génèrent automatiquement si la colonne est absente.",
        subtitle: 'Import — CSV · Excel · photo IA',
      },
      {
        id: 'reg-04',
        image: '10-school-etudiants.png',
        durationSec: 30,
        narration:
          "Liste Étudiants : recherchez par nom ou matricule, filtrez par classe. Ouvrez la fiche : identité, tuteur, téléphone WhatsApp du tuteur, documents. Onglet Scolarité : échéancier des frais. Mettez à jour le tuteur si la famille change de numéro : c'est indispensable pour le portail parents.",
        subtitle: 'Fiches élèves — Tuteur & matricule',
      },
      {
        id: 'reg-05',
        image: '16-school-formations.png',
        durationSec: 32,
        narration:
          "Formations : maintenez le catalogue. Créez une nouvelle classe de rentrée, dupliquez via preset, ou importez une liste. Vérifiez que chaque classe active a le bon palier collège ou lycée. Les matières archivées n'apparaissent plus pour les nouvelles saisies mais l'historique reste.",
        subtitle: 'Catalogue — Classes & matières',
      },
      {
        id: 'reg-06',
        image: '18-school-paiements.png',
        durationSec: 28,
        narration:
          "Paiements : consultez les impayés par classe. Si votre établissement l'autorise, vous pouvez Enregistrer un paiement au guichet comme le comptable. Sinon, lecture seule et relance des familles. Exportez la liste Excel pour votre cahier de suivi papier.",
        subtitle: 'Paiements — Suivi par classe',
      },
      {
        id: 'reg-07',
        image: '09-school-dashboard.png',
        durationSec: 20,
        narration:
          "Récap scolarité : candidatures, import, fiches à jour, catalogue rentrée, suivi impayés. En cas de blocage, lisez le bandeau rouge en haut de page : il indique souvent une migration ou un paramètre manquant.",
        subtitle: 'Scolarité — Routine rentrée',
      },
    ],
  },

  comptable: {
    title: 'Formation Comptable',
    audience: 'Comptable · Trésorier scolarité (accountant)',
    outputFile: 'konadata-formation-comptable.mp4',
    scenes: [
      {
        id: 'acc-01',
        image: '05-login.png',
        durationSec: 20,
        narration:
          "Formation Comptable KonaData. Votre écran est centré sur le recouvrement des frais de scolarité. Vous consultez les effectifs en lecture seule et vous encaissez les paiements. Vous ne modifiez pas le catalogue des classes.",
        subtitle: 'Comptable — Périmètre',
      },
      {
        id: 'acc-02',
        image: '09-school-dashboard.png',
        durationSec: 24,
        narration:
          "Le tableau de bord affiche la vue Comptabilité : encaissements du mois, créances, alertes impayés. Cliquez directement sur Paiements dans le menu pour votre routine quotidienne.",
        subtitle: 'Tableau de bord — Vue financière',
      },
      {
        id: 'acc-03',
        image: '18-school-paiements.png',
        durationSec: 36,
        narration:
          "Routine matinale : ouvrez Paiements, onglet Impayés. Filtrez par classe si vous gérez un niveau. Chaque ligne mène à la fiche élève. Notez vos appels ou visites dans votre registre externe, puis revenez encaisser dès qu'un parent paie.",
        subtitle: 'Impayés — Filtrer & relancer',
      },
      {
        id: 'acc-04',
        image: '18-school-paiements.png',
        durationSec: 38,
        narration:
          "Enregistrer un paiement : bouton Enregistrer un paiement, sélectionnez l'élève, le type de frais, le montant et le mode espèces ou mobile money. Validez : l'échéancier se met à jour et un reçu peut être généré. Vérifiez le montant avant validation : la correction passe par la direction si erreur.",
        subtitle: 'Encaissement — Guichet',
      },
      {
        id: 'acc-05',
        image: '10-school-etudiants.png',
        durationSec: 26,
        narration:
          "Effectifs élèves : menu Étudiants en lecture seule. Utilisez-le pour vérifier un matricule ou le solde sur la fiche avant d'encaisser. Menu Formations : consultation des classes uniquement.",
        subtitle: 'Consultation — Effectifs & classes',
      },
      {
        id: 'acc-06',
        image: '18-school-paiements.png',
        durationSec: 28,
        narration:
          "Fin de journée : exportez Impayés et Encaissements en Excel pour la direction. Comparez avec votre caisse physique. Les parents peuvent aussi payer en ligne si l'établissement a activé Orange Money : vous verrez le statut payé automatiquement.",
        subtitle: 'Exports Excel — Reporting',
      },
    ],
  },

  enseignant: {
    title: 'Formation Enseignant',
    audience: 'Professeur (teacher)',
    outputFile: 'konadata-formation-enseignant.mp4',
    scenes: [
      {
        id: 'tea-01',
        image: '05-login.png',
        durationSec: 22,
        narration:
          "Formation Enseignant KonaData. Connectez-vous : votre espace s'intitule Mon espace enseignant. Vous ne voyez que les classes et matières que la direction vous a assignées. Si une classe manque, contactez la direction — pas le support KonaData.",
        subtitle: 'Enseignant — Mon espace',
      },
      {
        id: 'tea-02',
        image: '16-school-formations.png',
        durationSec: 28,
        narration:
          "Ouvrez Formations : la liste Mes classes affiche uniquement vos assignations. Vérifiez le palier et le nombre d'élèves avant la saisie des notes. C'est votre point d'entrée pour savoir quelles grilles remplir.",
        subtitle: 'Mes classes — Assignations',
      },
      {
        id: 'tea-03',
        image: '12-school-resultats.png',
        durationSec: 40,
        narration:
          "Résultats : sélectionnez votre classe, votre matière, la période trimestre ou semestre. Onglet Grille : saisissez note sur vingt pour chaque élève. Zéro est une note valide. Laissez vide seulement si l'élève n'a pas été évalué. Cliquez en dehors de la cellule pour enregistrer.",
        subtitle: 'Grille — Saisie des notes',
      },
      {
        id: 'tea-04',
        image: '12-school-resultats.png',
        durationSec: 30,
        narration:
          "Pour une classe entière, onglet Import : téléchargez Modèle CSV, remplissez dans Excel, réimportez. Vérifiez l'aperçu avant validation. Idéal après un devoir surveillé noté sur papier.",
        subtitle: 'Import CSV — Saisie groupée',
      },
      {
        id: 'tea-05',
        image: '17-school-assignations.png',
        durationSec: 24,
        narration:
          "Si votre classe n'apparaît nulle part : la direction doit vous assigner dans Utilisateurs Assignations. Montrez-leur cette capture. Un seul professeur par matière et par classe.",
        subtitle: 'Dépannage — Pas de classe visible',
      },
      {
        id: 'tea-06',
        image: '12-school-resultats.png',
        durationSec: 20,
        narration:
          "Récap enseignant : vérifiez vos assignations, saisissez avant la date limite fixée par la direction, distinguez zéro et case vide. Les bulletins sont générés par la direction après votre saisie.",
        subtitle: 'Enseignant — Bonnes pratiques',
      },
    ],
  },

  eleve: {
    title: 'Formation Élève',
    audience: 'Élève inscrit (student)',
    outputFile: 'konadata-formation-eleve.mp4',
    scenes: [
      {
        id: 'stu-01',
        image: '06-register.png',
        durationSec: 24,
        narration:
          "Formation Élève KonaData. Si vous n'avez pas encore de compte, inscrivez-vous via Inscription élève avec votre numéro WhatsApp. Sinon, connectez-vous sur la page Login. Vous accédez à Mon espace : pas le menu complet de l'établissement.",
        subtitle: 'Élève — Créer ou se connecter',
      },
      {
        id: 'stu-02',
        image: '14-school-candidatures.png',
        durationSec: 32,
        narration:
          "Mon inscription : complétez le formulaire de demande ou de réinscription. Téléversez les pièces demandées : acte de naissance, photo, certificats. Suivez le statut en cours, validé ou refusé. La scolarité traite votre dossier côté établissement.",
        subtitle: 'Mon inscription — Dossier & pièces',
      },
      {
        id: 'stu-03',
        image: '13-school-bulletins.png',
        durationSec: 28,
        narration:
          "Mon bulletin : seuls les bulletins publiés en définitif par la direction sont téléchargeables. Le provisoire reste interne. Ouvrez le PDF et enregistrez-le sur votre téléphone pour le montrer à vos parents.",
        subtitle: 'Mon bulletin — PDF définitif',
      },
      {
        id: 'stu-04',
        image: '27-payer-scolarite.png',
        durationSec: 30,
        narration:
          "Payer la scolarité : si votre établissement l'active, utilisez Payer scolarité avec votre matricule et le téléphone du tuteur. Vous recevrez un code WhatsApp. Le paiement crédite directement le compte de l'école, pas KonaData.",
        subtitle: 'Paiement — Matricule & WhatsApp',
      },
      {
        id: 'stu-05',
        image: '19-suivi-scolarite.png',
        durationSec: 22,
        narration:
          "Vous pouvez aussi donner le matricule à vos parents : ils utilisent Suivi scolarité sans créer de compte. Récap élève : dossier à jour, bulletins définitifs, matricule toujours sous la main.",
        subtitle: 'Élève — Matricule & familles',
      },
    ],
  },

  candidat: {
    title: 'Formation Candidat',
    audience: 'Candidat admission (candidate)',
    outputFile: 'konadata-formation-candidat.mp4',
    scenes: [
      {
        id: 'cnd-01',
        image: '06-register.png',
        durationSec: 26,
        narration:
          "Formation Candidat KonaData. Depuis l'accueil, choisissez Inscription élève ou candidat. Créez un compte avec WhatsApp recommandé : vous recevrez les codes de connexion sur WhatsApp. Choisissez un mot de passe d'au moins huit caractères.",
        subtitle: 'Candidat — Créer un compte',
      },
      {
        id: 'cnd-02',
        image: '28-inscription-etablissement.png',
        durationSec: 34,
        narration:
          "Inscription établissement : sélectionnez l'école, le niveau visé, renseignez vos informations et celles du tuteur. Le téléphone du tuteur doit être actif sur WhatsApp : la scolarité et les paiements l'utilisent.",
        subtitle: 'Demande — Choisir un établissement',
      },
      {
        id: 'cnd-03',
        image: '14-school-candidatures.png',
        durationSec: 30,
        narration:
          "Mon inscription : déposez chaque pièce dans la zone prévue. Format PDF ou photo nette. Vérifiez que le fichier s'affiche avant de quitter la page. Statut en attente jusqu'à validation par la scolarité.",
        subtitle: 'Pièces jointes — Téléversement',
      },
      {
        id: 'cnd-04',
        image: '14-school-candidatures.png',
        durationSec: 24,
        narration:
          "Connectez-vous régulièrement pour voir si votre dossier est validé ou si des pièces manquent. Après validation, la scolarité peut vous convertir en élève inscrit avec un matricule officiel.",
        subtitle: 'Suivi — Statut du dossier',
      },
    ],
  },

  parent: {
    title: 'Formation Parents & tuteurs',
    audience: 'Parent / tuteur (sans compte KonaData)',
    outputFile: 'konadata-formation-parent.mp4',
    scenes: [
      {
        id: 'par-01',
        image: '01-intro-landing.png',
        durationSec: 22,
        narration:
          "Formation Parents et tuteurs. Vous n'avez pas besoin de créer un compte KonaData. L'établissement vous communique le matricule de l'élève. Gardez-le : c'est votre identifiant pour toutes les démarches en ligne.",
        subtitle: 'Parents — Pas de compte requis',
      },
      {
        id: 'par-02',
        image: '19-suivi-scolarite.png',
        durationSec: 34,
        narration:
          "Suivi scolarité : ouvrez la page depuis le lien de l'école ou konadatagn.com. Saisissez le matricule, puis le numéro de téléphone enregistré chez l'établissement — idéalement votre WhatsApp. Cliquez Recevoir le code. Entrez le code à six chiffres reçu sur WhatsApp.",
        subtitle: 'Suivi scolarité — Matricule + code',
      },
      {
        id: 'par-03',
        image: '19-suivi-scolarite.png',
        durationSec: 28,
        narration:
          "Une fois connecté au portail, consultez le solde des frais, les tranches payées et le reste à payer. Téléchargez le bulletin PDF uniquement s'il a été publié en définitif par la direction.",
        subtitle: 'Solde & bulletins',
      },
      {
        id: 'par-04',
        image: '27-payer-scolarite.png',
        durationSec: 32,
        narration:
          "Payer scolarité : même principe matricule plus téléphone tuteur. Choisissez le montant ou la tranche proposée. Orange Money envoie l'argent sur le compte marchand de l'école. Conservez le reçu PDF affiché à la fin.",
        subtitle: 'Payer scolarité — Orange Money école',
      },
      {
        id: 'par-05',
        image: '19-suivi-scolarite.png',
        durationSec: 20,
        narration:
          "Partagez le lien Suivi scolarité par WhatsApp aux autres tuteurs. En cas de numéro incorrect, contactez la scolarité pour mettre à jour la fiche élève. Aucune application à installer.",
        subtitle: 'Parents — Lien WhatsApp école',
      },
    ],
  },
};

export const TRAINING_ROLE_IDS = Object.keys(TRAINING_BY_ROLE);
