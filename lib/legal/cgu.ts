/** Version courante des CGU KonaData. */
export const CURRENT_CGU_VERSION = '2026-06-01';

export const CGU_TITLE = 'Conditions générales d\'utilisation — KonaData';

export type CguSection = {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export const CGU_SECTIONS: CguSection[] = [
  {
    id: 'objet',
    title: '1. Objet',
    paragraphs: [
      'Les présentes conditions régissent l\'accès et l\'utilisation de la plateforme KonaData par les organisations clientes et leurs utilisateurs autorisés.',
      'En créant une organisation ou en acceptant les CGU, le directeur engage l\'organisation.',
    ],
  },
  {
    id: 'compte',
    title: '2. Comptes et responsabilités',
    paragraphs: [
      'Le directeur est responsable de la gestion des accès au sein de son organisation (codes d\'invitation, rôles, révocation).',
      'Chaque utilisateur doit protéger ses identifiants. KonaData ne demande jamais le mot de passe par téléphone ou email non sollicité.',
    ],
  },
  {
    id: 'usage',
    title: '3. Usage autorisé',
    paragraphs: [
      'La plateforme sert à la gestion métier (scolaire, ONG, BTP, PME) dans le cadre légal de l\'organisation.',
      'Sont interdits : accès non autorisé, extraction massive abusive, contournement des quotas, usage contraire aux lois en vigueur.',
    ],
  },
  {
    id: 'donnees',
    title: '4. Données et confidentialité',
    paragraphs: [
      'L\'organisation reste propriétaire de ses données. KonaData agit comme sous-traitant (voir DPA dans Paramètres → Confidentialité).',
      'Les données sont hébergées sur Supabase (UE/régions configurées), isolées par organisation (RLS), avec stockage fichiers par tenant.',
    ],
  },
  {
    id: 'facturation',
    title: '5. Facturation',
    paragraphs: [
      'L\'accès aux modules est conditionné au paiement de l\'abonnement validé par KonaData, sauf essai ou dérogation écrite.',
      'Les tarifs sondages ONG et options IA peuvent faire l\'objet de devis complémentaires.',
    ],
  },
  {
    id: 'disponibilite',
    title: '6. Disponibilité et support',
    paragraphs: [
      'KonaData vise une haute disponibilité mais ne garantit pas l\'absence d\'interruption (maintenance, réseau, force majeure).',
      'Le support est assuré par les canaux officiels KonaData (email, WhatsApp professionnel).',
    ],
  },
  {
    id: 'resiliation',
    title: '7. Résiliation',
    paragraphs: [
      'KonaData peut suspendre un compte en cas de non-paiement, violation des CGU ou risque sécurité, après notification lorsque possible.',
      'L\'organisation peut demander l\'export et la suppression de ses données conformément au DPA.',
    ],
  },
];

export function isCguAcceptanceCurrent(version: string | null | undefined): boolean {
  return version === CURRENT_CGU_VERSION;
}
