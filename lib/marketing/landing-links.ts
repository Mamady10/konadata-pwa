/** Liens d’entrée depuis la page d’accueil vers les formulaires auth. */

export const LANDING_LINKS = {
  home: '/',
  login: '/login',
  /** Connexion candidat / élève (après login → candidatures ou choix établissement) */
  loginLearner: '/login?redirect=%2Fetablissement%2Fcandidatures',
  /** Connexion directeur / staff → tableau de bord métier */
  loginStaff: '/login',
  /** Directeur : crée l’organisation + compte admin */
  registerOrganization: '/register?mode=create',
  /** ONG non inscrite : compte + sondage uniquement (sans abonnement plateforme) */
  registerSurveyOnly: '/register/sondage',
  /** Collaborateur : formulaire compte + code (après /rejoindre ou direct) */
  registerJoin: '/register?mode=join',
  /** Candidat / élève : compte puis choix établissement */
  registerLearner: '/register/candidat',
  /** Assistant inscription établissement (connecté, sans org) */
  inscriptionEtablissement: '/inscription-etablissement',
  corrigerParcoursCandidat: '/corriger-parcours',
  /** Saisie du code d’accès */
  rejoindre: '/rejoindre',
  /** Déconnexion puis formulaire de connexion (évite la boucle /login → /rejoindre) */
  loginSwitchAccount: '/login?switch=1',
  forgotPassword: '/forgot-password',
  contact: '/#contact',
  /** Portail parents / tuteurs (sans compte) */
  suiviScolarite: '/suivi-scolarite',
  payerScolarite: '/payer-scolarite',
} as const;
