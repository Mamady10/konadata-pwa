import type { DocumentCategory } from '@/types/database';
import {
  getTemplatePurposeDef,
  getTemplatePurposesForSector,
  type TemplatePurposeDef,
  type TemplateSector,
} from '@/lib/ai/document-template-purposes';
import {
  BTP_DOCUMENT_TYPES,
  NGO_DOCUMENT_TYPES,
  type SectorDocumentTypeOption,
} from '@/lib/documents/sector-document-types';
import {
  captureStandardToPurposeDef,
  captureStandardToSectorOption,
  getCaptureStandardsForSector,
  getCaptureStandardById,
} from '@/lib/documents/capture-standard-templates';

export interface OrgDocumentTypeRow {
  id: string;
  organization_id: string;
  sector: TemplateSector;
  code: string;
  label: string;
  description: string | null;
  category: DocumentCategory;
  hint: string | null;
  is_active: boolean;
  created_at: string;
}

export const DOCUMENT_CATEGORY_OPTIONS: { value: DocumentCategory; label: string }[] = [
  { value: 'school_report', label: 'Établissement / scolarité' },
  { value: 'ngo_report', label: 'Rapport ONG' },
  { value: 'expense_report', label: 'Finances / dépenses' },
  { value: 'questionnaire', label: 'Enquête / questionnaire' },
  { value: 'invoice', label: 'Facture' },
  { value: 'delivery_note', label: 'Logistique / livraison' },
  { value: 'fuel_report', label: 'Carburant' },
  { value: 'cv', label: 'RH' },
  { value: 'other', label: 'Autre' },
];

export function slugifyOrgDocumentTypeCode(label: string): string {
  const base = label
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 36);
  return `custom_${base || 'type'}`;
}

export function orgDocumentTypeToSectorOption(row: OrgDocumentTypeRow): SectorDocumentTypeOption {
  return {
    id: row.code,
    label: row.label,
    category: row.category,
    hint: row.hint ?? row.description ?? undefined,
  };
}

export function orgDocumentTypeToTemplatePurpose(row: OrgDocumentTypeRow): TemplatePurposeDef {
  return {
    purpose: row.code,
    label: row.label,
    description: row.description ?? row.hint ?? 'Document propre à votre organisation',
    category: row.category,
    hint: row.hint ?? 'Déposez un exemple validé par la direction',
    isCustom: true,
    customTypeId: row.id,
  };
}

export function rowToOrgDocumentType(row: Record<string, unknown>): OrgDocumentTypeRow {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    sector: row.sector as TemplateSector,
    code: row.code as string,
    label: row.label as string,
    description: (row.description as string) || null,
    category: (row.category as DocumentCategory) || 'other',
    hint: (row.hint as string) || null,
    is_active: row.is_active !== false,
    created_at: row.created_at as string,
  };
}

function builtinSectorOptions(sector: 'ngo' | 'btp'): SectorDocumentTypeOption[] {
  return sector === 'ngo' ? NGO_DOCUMENT_TYPES : BTP_DOCUMENT_TYPES;
}

export function mergeSectorDocumentTypes(
  sector: 'ngo' | 'btp',
  customRows: OrgDocumentTypeRow[]
): SectorDocumentTypeOption[] {
  const builtins = builtinSectorOptions(sector).filter((t) => t.id !== 'other');
  const capture = getCaptureStandardsForSector(sector).map(captureStandardToSectorOption);
  const custom = customRows.filter((r) => r.is_active).map(orgDocumentTypeToSectorOption);
  const other = builtinSectorOptions(sector).find((t) => t.id === 'other');
  const seen = new Set([...builtins, ...capture].map((t) => t.id));
  const extraCustom = custom.filter((t) => !seen.has(t.id));
  return [...builtins, ...capture, ...extraCustom, ...(other ? [other] : [])];
}

export function mergeTemplatePurposes(
  sector: TemplateSector,
  customRows: OrgDocumentTypeRow[]
): TemplatePurposeDef[] {
  const builtins = getTemplatePurposesForSector(sector);
  const custom = customRows.filter((r) => r.is_active).map(orgDocumentTypeToTemplatePurpose);
  const seen = new Set(builtins.map((p) => p.purpose));
  const extra = custom.filter((p) => !seen.has(p.purpose));
  return [...builtins, ...extra];
}

export function resolveBuiltinSectorType(
  sector: 'ngo' | 'btp',
  typeId: string
): SectorDocumentTypeOption | undefined {
  const list = sector === 'ngo' ? NGO_DOCUMENT_TYPES : BTP_DOCUMENT_TYPES;
  return list.find((t) => t.id === typeId);
}

export function resolveTemplatePurposeFromRows(
  sector: TemplateSector,
  purpose: string,
  customRows: OrgDocumentTypeRow[]
): TemplatePurposeDef | undefined {
  const builtin = getTemplatePurposeDef(sector, purpose);
  if (builtin) return builtin;
  const capture = getCaptureStandardById(purpose);
  if (capture && capture.sector === sector) return captureStandardToPurposeDef(capture);
  const row = customRows.find((r) => r.code === purpose && r.is_active);
  return row ? orgDocumentTypeToTemplatePurpose(row) : undefined;
}
