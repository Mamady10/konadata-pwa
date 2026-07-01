/** Documentation CEO : stockage des données et confidentialité. */
export const DATA_STORAGE_FAQ_TITLE = 'Où et comment sont stockées les données ?';

export type DataStorageSection = {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export const DATA_STORAGE_SECTIONS: DataStorageSection[] = [
  {
    id: 'hebergement',
    title: 'Hébergement',
    paragraphs: [
      'Base de données relationnelle, authentification et stockage fichiers : Supabase (PostgreSQL + Auth + Storage).',
      'Application web : déployée sur infrastructure cloud (Vercel ou équivalent) avec HTTPS obligatoire.',
    ],
  },
  {
    id: 'isolation',
    title: 'Isolation multi-tenant',
    paragraphs: [
      'Chaque organisation possède un identifiant unique (organization_id). Toutes les tables métier y sont rattachées.',
      'Les politiques RLS (Row Level Security) PostgreSQL empêchent un utilisateur de lire ou modifier les données d\'une autre organisation.',
      'Les fichiers (documents, bulletins, pièces chantier) sont stockés dans des chemins préfixés par l\'identifiant organisation.',
    ],
  },
  {
    id: 'profils',
    title: 'Données organisateurs et utilisateurs',
    bullets: [
      'Profils (profiles) : nom, email, téléphone, rôle, organisation_id — table Supabase liée à auth.users',
      'Organisations (organizations) : nom, type, paramètres, statut facturation, consentements DPA/CGU',
      'Journaux d\'audit (audit_logs) : actions sensibles sans contenu des documents',
      'OTP récupération : tables dédiées à durée limitée (email/téléphone)',
    ],
    paragraphs: [
      'Les mots de passe ne sont jamais stockés en clair : hachage géré par Supabase Auth.',
    ],
  },
  {
    id: 'ia',
    title: 'KonaAI et confidentialité',
    paragraphs: [
      'Si KonaAI est activé et non désactivé par l\'organisation, des extraits sont envoyés temporairement à l\'API OpenAI pour exécuter la demande.',
      'L\'organisation peut désactiver KonaAI dans Paramètres → Confidentialité (aucun nouvel appel externe).',
      'Voir le DPA (accord de traitement) pour le détail des sous-traitants.',
    ],
  },
  {
    id: 'acces-ceo',
    title: 'Accès équipe KonaData (CEO)',
    paragraphs: [
      'Le rôle platform_admin permet la gestion des abonnements, l\'activation des organisations et le support — pas l\'exploitation commerciale des données clients.',
      'Les suspensions et motifs sont tracés dans les paramètres organisation.',
    ],
  },
  {
    id: 'droits',
    title: 'Droits et conformité',
    paragraphs: [
      'L\'organisation cliente est responsable du traitement vis-à-vis de ses élèves, bénéficiaires et personnel.',
      'KonaData fournit les outils d\'export, d\'archivage et la documentation DPA/CGU pour documenter la conformité.',
    ],
  },
];

export const PASSWORD_RECOVERY_GUIDE = {
  title: 'Récupération des comptes directeurs',
  steps: [
    {
      label: 'Auto-service (recommandé)',
      detail:
        'Le directeur utilise « Mot de passe oublié » sur la page de connexion : email de réinitialisation ou OTP WhatsApp/SMS si le compte est lié au téléphone.',
    },
    {
      label: 'Par un autre directeur adjoint',
      detail:
        'Un org_admin ou deputy_director peut réinitialiser le mot de passe d\'un collaborateur depuis Utilisateurs (sauf un autre org_admin).',
    },
    {
      label: 'Dernier recours — CEO KonaData',
      detail:
        'Depuis Organisations, le CEO peut envoyer un lien de réinitialisation à l\'email du directeur (bouton « Réinitialiser MDP »). Pour les comptes téléphone uniquement, orienter vers la récupération OTP ou mettre à jour l\'email avec le directeur.',
    },
  ],
};
