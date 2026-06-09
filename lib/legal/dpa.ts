/** Version courante du DPA KonaData (accord de traitement des données). */
export const CURRENT_DPA_VERSION = '2026-06-01';

export const DPA_TITLE = 'Accord de traitement des données (DPA) — KonaData';

export type DpaSection = {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export const DPA_SECTIONS: DpaSection[] = [
  {
    id: 'parties',
    title: '1. Parties',
    paragraphs: [
      'Le Client (l\'organisation inscrite sur KonaData, représentée par son directeur ou responsable habilité) est le responsable du traitement des données personnelles de ses collaborateurs, élèves et tiers saisis dans la plateforme.',
      'KonaData (éditeur de la plateforme) agit en qualité de sous-traitant au sens de la réglementation applicable en matière de protection des données.',
    ],
  },
  {
    id: 'objet',
    title: '2. Objet',
    paragraphs: [
      'Le présent accord encadre le traitement des données confiées par le Client à KonaData pour la fourniture du service : gestion scolaire, ONG, BTP, PME, stockage documentaire et, le cas échéant, fonctionnalités KonaAI (assistance, rapports, OCR).',
    ],
  },
  {
    id: 'isolation',
    title: '3. Isolation et accès',
    paragraphs: [
      'Les données de chaque organisation sont logiquement séparées (multi-tenant) : identifiant organization_id, politiques RLS Supabase, chemins de stockage par organisation.',
      'Seuls les utilisateurs rattachés à l\'organisation concernée accèdent à ses données métier, selon leur rôle.',
      'L\'équipe KonaData (rôle plateforme) peut accéder aux données uniquement pour l\'activation, la facturation, le support et la sécurité — jamais pour les revendre ni les mélanger entre clients.',
    ],
  },
  {
    id: 'konaai',
    title: '4. KonaAI et sous-traitant OpenAI',
    paragraphs: [
      'Lorsque KonaAI est activé et non désactivé par le Client, des extraits de données (textes, indicateurs, documents) sont transmis de façon temporaire à l\'API OpenAI (sous-traitant ultérieur) uniquement pour exécuter la demande initiée par un utilisateur autorisé de l\'organisation.',
      'KonaData configure les appels API avec stockage désactivé (store: false) lorsque supporté par l\'API.',
      'Les données API OpenAI ne sont pas utilisées pour entraîner les modèles publics OpenAI (politique API standard).',
      'Le Client peut désactiver KonaAI à tout moment dans Paramètres → Confidentialité : aucun nouvel appel externe ne sera effectué.',
    ],
    bullets: [
      'Chat et rapports : contexte limité à l\'organisation connectée',
      'OCR / Vision : uniquement sur document déposé par l\'organisation',
      'Aucun partage de contexte entre organisations',
    ],
  },
  {
    id: 'securite',
    title: '5. Mesures de sécurité',
    paragraphs: [
      'Chiffrement en transit (HTTPS/TLS), authentification Supabase, contrôle d\'accès par rôle, journalisation des usages IA (opération, crédits — sans contenu des prompts).',
      'Hébergement base de données et fichiers via Supabase (infrastructure cloud sécurisée).',
    ],
  },
  {
    id: 'duree',
    title: '6. Durée et suppression',
    paragraphs: [
      'Les données sont conservées pendant la durée du contrat. Sur demande du Client ou à la résiliation, KonaData assiste à l\'export et à la suppression dans les délais raisonnables prévus contractuellement.',
    ],
  },
  {
    id: 'droits',
    title: '7. Droits des personnes',
    paragraphs: [
      'Le Client reste responsable des droits d\'accès, rectification et suppression des personnes concernées (élèves, personnel). KonaData fournit les outils de la plateforme pour exercer ces droits.',
    ],
  },
  {
    id: 'sous-traitants',
    title: '8. Sous-traitants ultérieurs',
    paragraphs: [
      'Sous-traitants principaux : Supabase (hébergement BDD, auth, storage), OpenAI (inférence KonaAI si activé).',
      'KonaData informe le Client de tout changement majeur de sous-traitant.',
    ],
  },
  {
    id: 'acceptation',
    title: '9. Acceptation',
    paragraphs: [
      `En cliquant « J'accepte le DPA », le représentant habilité de l'organisation accepte la version ${CURRENT_DPA_VERSION} au nom du Client.`,
      'Cette acceptation est enregistrée (date, version, identifiant du signataire) dans les paramètres de l\'organisation.',
    ],
  },
];

export function isDpaAcceptanceCurrent(
  acceptedVersion: string | null | undefined
): boolean {
  return acceptedVersion === CURRENT_DPA_VERSION;
}
