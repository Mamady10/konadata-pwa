export type BulletinLayoutPresetId =
  | 'meps_band'
  | 'centered_logo'
  | 'minimal'
  | 'institutional_green'
  | 'elegant_frame'
  | 'bordeaux_formal'
  | 'navy_academic'
  | 'forest_releve'
  | 'premium_gold'
  | 'guinee_officiel'
  | 'college_moderne'
  | 'coral_sunset'
  | 'indigo_stripe'
  | 'slate_pro'
  | 'amber_heritage'
  | 'teal_coast'
  | 'rose_academy'
  | 'charcoal_minimal';

export interface BulletinPresetTemplateFields {
  layout_preset: BulletinLayoutPresetId;
  header_title?: string;
  header_subtitle?: string;
  primary_color?: string;
  footer_text?: string;
  director_signature_label?: string;
  show_rank?: boolean;
  show_appreciation?: boolean;
  show_coefficients?: boolean;
  show_all_subjects?: boolean;
  require_logo?: boolean;
  require_stamp?: boolean;
}

export interface BulletinPresetDefinition {
  id: BulletinLayoutPresetId;
  label: string;
  description: string;
  template: BulletinPresetTemplateFields;
}

export const BULLETIN_LAYOUT_PRESETS: BulletinPresetDefinition[] = [
  {
    id: 'meps_band',
    label: 'Officiel MEPS — bandeau',
    description:
      'En-tête République, bandeau coloré pleine largeur, logo à gauche. Idéal écoles publiques et privées sous tutelle MEPS.',
    template: {
      layout_preset: 'meps_band',
      header_title: 'BULLETIN SCOLAIRE',
      primary_color: '2563EB',
      footer_text: 'Document généré par KonaData — conforme au modèle MEPS',
      director_signature_label: 'Le Directeur',
    },
  },
  {
    id: 'centered_logo',
    label: 'Classique centré',
    description:
      'Logo centré sous l’en-tête République, titres alignés au centre. Style traditionnel des collèges privés.',
    template: {
      layout_preset: 'centered_logo',
      header_title: 'BULLETIN SCOLAIRE',
      primary_color: '1E3A5F',
      footer_text: 'Bulletin certifié par l’établissement',
      director_signature_label: 'Le Proviseur',
    },
  },
  {
    id: 'minimal',
    label: 'Épuré',
    description:
      'Mise en page sobre, peu de couleurs, logo discret en haut à gauche. Pour établissements modernes.',
    template: {
      layout_preset: 'minimal',
      header_title: 'BULLETIN DE NOTES',
      primary_color: '475569',
      footer_text: 'Document établissement scolaire',
      director_signature_label: 'La Direction',
    },
  },
  {
    id: 'institutional_green',
    label: 'Institutionnel vert',
    description:
      'Bandeau vert, en-tête République. Variante utilisée par plusieurs établissements conventionnés.',
    template: {
      layout_preset: 'institutional_green',
      header_title: 'BULLETIN SCOLAIRE',
      primary_color: '047857',
      footer_text: 'Document officiel de l’établissement',
      director_signature_label: 'Le Chef d’établissement',
    },
  },
  {
    id: 'elegant_frame',
    label: 'Élégant encadré',
    description:
      'En-tête dans un cadre avec filet coloré, logo à gauche sans fond. Pour groupes scolaires premium.',
    template: {
      layout_preset: 'elegant_frame',
      header_title: 'BULLETIN SCOLAIRE',
      primary_color: '7C3AED',
      footer_text: 'Groupe scolaire — bulletin certifié',
      director_signature_label: 'Le Directeur Général',
    },
  },
  {
    id: 'bordeaux_formal',
    label: 'Bordeaux formel',
    description:
      'Bandeau bordeaux, en-tête République. Style lycée privé classique.',
    template: {
      layout_preset: 'bordeaux_formal',
      header_title: 'BULLETIN SCOLAIRE',
      primary_color: '7F1D1D',
      footer_text: 'Établissement d’enseignement général — document officiel',
      director_signature_label: 'Le Proviseur',
    },
  },
  {
    id: 'navy_academic',
    label: 'Bleu marine académique',
    description: 'Logo centré, tons marine. Pour collèges et lycées techniques.',
    template: {
      layout_preset: 'navy_academic',
      header_title: 'BULLETIN SCOLAIRE',
      primary_color: '1E3A8A',
      footer_text: 'Collège / Lycée — relevé certifié par la direction',
      director_signature_label: 'Le Chef d’établissement',
    },
  },
  {
    id: 'forest_releve',
    label: 'Relevé vert épuré',
    description: 'Mise en page sobre sans coefficients affichés. Idéal primaire / fondamental.',
    template: {
      layout_preset: 'forest_releve',
      header_title: 'RELEVÉ DE NOTES',
      primary_color: '166534',
      show_coefficients: false,
      footer_text: 'Relevé périodique de l’établissement',
      director_signature_label: 'La Directrice',
    },
  },
  {
    id: 'premium_gold',
    label: 'Premium or',
    description: 'Cadre élégant, accents dorés. Groupes scolaires haut de gamme.',
    template: {
      layout_preset: 'premium_gold',
      header_title: 'BULLETIN SCOLAIRE',
      primary_color: 'B45309',
      footer_text: 'Excellence scolaire — bulletin certifié',
      director_signature_label: 'Le Directeur Général',
    },
  },
  {
    id: 'guinee_officiel',
    label: 'Guinée officiel',
    description: 'Bandeau vert institutionnel, libellés adaptés au contexte national.',
    template: {
      layout_preset: 'guinee_officiel',
      header_title: 'BULLETIN SCOLAIRE',
      header_subtitle: 'République de Guinée',
      primary_color: '15803D',
      footer_text: 'Ministère de l’Éducation — document de l’établissement',
      director_signature_label: 'Le Directeur',
    },
  },
  {
    id: 'college_moderne',
    label: 'Collège moderne',
    description: 'Design minimal contemporain, rang masqué. Pour écoles innovantes.',
    template: {
      layout_preset: 'college_moderne',
      header_title: 'BULLETIN DE NOTES',
      primary_color: '0F766E',
      show_rank: false,
      footer_text: 'Établissement scolaire — édition numérique',
      director_signature_label: 'La Direction pédagogique',
    },
  },
  {
    id: 'coral_sunset',
    label: 'Corail soleil',
    description: 'Bandeau corail chaleureux, idéal écoles maternelles et primaires privées.',
    template: {
      layout_preset: 'coral_sunset',
      header_title: 'BULLETIN SCOLAIRE',
      primary_color: 'EA580C',
      footer_text: 'École fondamentale — bulletin certifié',
      director_signature_label: 'La Directrice',
    },
  },
  {
    id: 'indigo_stripe',
    label: 'Indigo rayé',
    description: 'Bandeau indigo profond, style lycée technique et professionnel.',
    template: {
      layout_preset: 'indigo_stripe',
      header_title: 'BULLETIN SCOLAIRE',
      primary_color: '4338CA',
      footer_text: 'Lycée technique — document officiel',
      director_signature_label: 'Le Proviseur',
    },
  },
  {
    id: 'slate_pro',
    label: 'Ardoise professionnelle',
    description: 'Logo centré, tons ardoise. Pour instituts et centres de formation.',
    template: {
      layout_preset: 'slate_pro',
      header_title: 'RELEVÉ DE NOTES',
      primary_color: '334155',
      show_coefficients: false,
      footer_text: 'Centre de formation — relevé certifié',
      director_signature_label: 'Le Responsable pédagogique',
    },
  },
  {
    id: 'amber_heritage',
    label: 'Ambre patrimoine',
    description: 'Cadre élégant ambre, pour établissements historiques.',
    template: {
      layout_preset: 'amber_heritage',
      header_title: 'BULLETIN SCOLAIRE',
      primary_color: 'D97706',
      footer_text: 'Établissement historique — bulletin certifié',
      director_signature_label: 'Le Recteur',
    },
  },
  {
    id: 'teal_coast',
    label: 'Sarcelle littoral',
    description: 'Design épuré sarcelle, écoles côtières et régionales.',
    template: {
      layout_preset: 'teal_coast',
      header_title: 'BULLETIN DE NOTES',
      primary_color: '0D9488',
      footer_text: 'Établissement régional — édition officielle',
      director_signature_label: 'Le Directeur',
    },
  },
  {
    id: 'rose_academy',
    label: 'Rose académie',
    description: 'En-tête centré rose bordeaux, pour académies féminines.',
    template: {
      layout_preset: 'rose_academy',
      header_title: 'BULLETIN SCOLAIRE',
      primary_color: 'BE185D',
      footer_text: 'Académie — bulletin de fin de période',
      director_signature_label: 'La Proviseure',
    },
  },
  {
    id: 'charcoal_minimal',
    label: 'Charbon minimal',
    description: 'Noir & blanc discret, logo seul. Pour écoles internationales.',
    template: {
      layout_preset: 'charcoal_minimal',
      header_title: 'REPORT CARD',
      primary_color: '18181B',
      show_rank: false,
      show_coefficients: false,
      footer_text: 'International school — certified report',
      director_signature_label: 'Head of School',
    },
  },
];

export const DEFAULT_BULLETIN_LAYOUT_PRESET: BulletinLayoutPresetId = 'meps_band';

export function getBulletinPreset(id: BulletinLayoutPresetId): BulletinPresetDefinition {
  return BULLETIN_LAYOUT_PRESETS.find((p) => p.id === id) ?? BULLETIN_LAYOUT_PRESETS[0];
}

/** Applique un modèle par défaut en conservant logo, cachet et fichier de référence. */
export function applyBulletinPreset<T extends { reference?: unknown; stamp?: unknown }>(
  current: T & BulletinPresetTemplateFields,
  presetId: BulletinLayoutPresetId
): T & BulletinPresetTemplateFields {
  const preset = getBulletinPreset(presetId);
  return {
    ...current,
    ...preset.template,
    layout_preset: presetId,
    reference: current.reference,
    stamp: current.stamp,
  };
}

export function isBulletinLayoutPresetId(value: string): value is BulletinLayoutPresetId {
  return BULLETIN_LAYOUT_PRESETS.some((p) => p.id === value);
}
