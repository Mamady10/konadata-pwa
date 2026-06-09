import type { DocumentCategory } from '@/types/database';
import { BTP_DOCUMENT_TYPES, NGO_DOCUMENT_TYPES } from '@/lib/documents/sector-document-types';
import {
  captureStandardToPurposeDef,
  getCaptureStandardById,
  getCaptureStandardsForSector,
} from '@/lib/documents/capture-standard-templates';

export type TemplateSector = 'school' | 'ngo' | 'btp' | 'pme';

export interface TemplatePurposeDef {
  purpose: string;
  label: string;
  description: string;
  category: DocumentCategory;
  hint: string;
  /** Type créé par l'organisation (organization_document_types) */
  isCustom?: boolean;
  customTypeId?: string;
  /** Modèle vierge KonaData optimisé manuscrit */
  isCaptureStandard?: boolean;
  captureFormats?: ('pdf' | 'csv')[];
}

export const SCHOOL_TEMPLATE_PURPOSES: TemplatePurposeDef[] = [
  {
    purpose: 'school_bulletin',
    label: 'Bulletin scolaire',
    description: 'Mise en page, mentions légales, formules de notes et appréciations',
    category: 'school_report',
    hint: 'PDF ou Word du bulletin type de votre établissement',
  },
  {
    purpose: 'school_bulletin_stamp',
    label: 'Cachet établissement',
    description: 'Sceau officiel apposé sur les bulletins PDF',
    category: 'school_report',
    hint: 'PNG/JPEG fond transparent ou scan PDF — extrait avec ou sans KonaAI',
  },
  {
    purpose: 'school_report',
    label: 'Rapport d\'établissement',
    description: 'Synthèse direction, statistiques, structure des chapitres',
    category: 'school_report',
    hint: 'Rapport annuel ou trimestriel de référence',
  },
  {
    purpose: 'school_enrollment_pack',
    label: 'Dossier inscription / réinscription',
    description: 'Liste des pièces et textes attendus pour les candidatures',
    category: 'other',
    hint: 'Guide ou lettre type aux familles',
  },
];

/** Modèle de rapport de sondage (niveau organisation) — guide KonaAI sur les analytiques. */
export const NGO_SURVEY_REPORT_PURPOSE = 'ngo_survey_report';

export const NGO_SURVEY_REPORT_TEMPLATE: TemplatePurposeDef = {
  purpose: NGO_SURVEY_REPORT_PURPOSE,
  label: 'Rapport de sondage',
  description:
    'Structure, rubriques et ton des rapports d\'enquête publiés par votre organisation',
  category: 'questionnaire',
  hint: 'Exemple de rapport de sondage ou enquête validé par la direction (PDF, Word)',
};

export const NGO_TEMPLATE_PURPOSES: TemplatePurposeDef[] = [
  NGO_SURVEY_REPORT_TEMPLATE,
  ...NGO_DOCUMENT_TYPES.filter((t) => t.id !== 'other').map((t) => ({
    purpose: t.id,
    label: `Modèle — ${t.label}`,
    description: t.hint ?? 'Document de référence pour ce type de livrable',
    category: t.category,
    hint: 'Déposez un exemple validé par la direction',
  })),
];

export const BTP_TEMPLATE_PURPOSES: TemplatePurposeDef[] = BTP_DOCUMENT_TYPES.filter(
  (t) => t.id !== 'other'
).map((t) => ({
  purpose: t.id,
  label: `Modèle — ${t.label}`,
  description: t.hint ?? 'Document de référence pour ce type de livrable',
  category: t.category,
  hint: 'Déposez un exemple validé par la direction',
}));

export const PME_TEMPLATE_PURPOSES: TemplatePurposeDef[] = [];

function sectorBuiltinPurposes(sector: TemplateSector): TemplatePurposeDef[] {
  if (sector === 'school') return SCHOOL_TEMPLATE_PURPOSES;
  if (sector === 'ngo') return NGO_TEMPLATE_PURPOSES;
  if (sector === 'btp') return BTP_TEMPLATE_PURPOSES;
  return PME_TEMPLATE_PURPOSES;
}

export function getTemplatePurposesForSector(sector: TemplateSector): TemplatePurposeDef[] {
  const builtins = sectorBuiltinPurposes(sector);
  const capture = getCaptureStandardsForSector(sector).map(captureStandardToPurposeDef);
  const seen = new Set(builtins.map((p) => p.purpose));
  const extra = capture.filter((p) => !seen.has(p.purpose));
  return [...builtins, ...extra];
}

export function getTemplatePurposeDef(
  sector: TemplateSector,
  purpose: string
): TemplatePurposeDef | undefined {
  const fromList = getTemplatePurposesForSector(sector).find((p) => p.purpose === purpose);
  if (fromList) return fromList;
  const capture = getCaptureStandardById(purpose);
  if (capture && capture.sector === sector) return captureStandardToPurposeDef(capture);
  return undefined;
}

export function orgTypeToTemplateSector(
  orgType: string | null | undefined
): TemplateSector | null {
  if (orgType === 'school') return 'school';
  if (orgType === 'ngo') return 'ngo';
  if (orgType === 'btp') return 'btp';
  if (orgType === 'business') return 'pme';
  return null;
}
