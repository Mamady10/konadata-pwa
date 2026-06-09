/** Modèle bulletin paramétrable (organizations.settings.school.bulletin_template) */

import {
  DEFAULT_BULLETIN_LAYOUT_PRESET,
  isBulletinLayoutPresetId,
  type BulletinLayoutPresetId,
} from '@/lib/school/bulletin-presets';

export type { BulletinLayoutPresetId };

export interface BulletinReferenceFile {
  document_id: string | null;
  file_name: string | null;
  synced_at: string | null;
}

export interface BrandingPdfCache {
  base64: string;
  format: 'PNG' | 'JPEG';
}

export interface BulletinStampFile {
  document_id: string | null;
  file_name: string | null;
  processed_at: string | null;
  process_method: string | null;
  pdf_cache?: BrandingPdfCache | null;
}

export interface SchoolBrandingPaths {
  logo_storage_path: string | null;
  logo_pdf_cache?: BrandingPdfCache | null;
}

function parsePdfCache(raw: unknown): BrandingPdfCache | null {
  const o = raw as Record<string, unknown> | undefined;
  if (typeof o?.base64 !== 'string' || !o.base64.trim()) return null;
  return {
    base64: o.base64.trim(),
    format: o.format === 'JPEG' ? 'JPEG' : 'PNG',
  };
}

export interface SchoolBulletinTemplate {
  layout_preset: BulletinLayoutPresetId;
  header_title: string;
  header_subtitle: string;
  show_rank: boolean;
  show_appreciation: boolean;
  show_coefficients: boolean;
  show_all_subjects: boolean;
  /** Détail par type d'évaluation sur le PDF (sinon moyenne par matière). */
  show_evaluation_details: boolean;
  require_logo: boolean;
  require_stamp: boolean;
  footer_text: string;
  director_signature_label: string;
  primary_color: string;
  reference?: BulletinReferenceFile;
  stamp?: BulletinStampFile;
}

export const DEFAULT_BULLETIN_TEMPLATE: SchoolBulletinTemplate = {
  layout_preset: DEFAULT_BULLETIN_LAYOUT_PRESET,
  header_title: 'BULLETIN SCOLAIRE',
  header_subtitle: '',
  show_rank: true,
  show_appreciation: true,
  show_coefficients: true,
  show_all_subjects: true,
  show_evaluation_details: false,
  require_logo: true,
  require_stamp: true,
  footer_text: 'Document généré par KonaData',
  director_signature_label: 'Le Directeur',
  primary_color: '2563EB',
};

export const DEFAULT_SCHOOL_BRANDING: SchoolBrandingPaths = {
  logo_storage_path: null,
};

export function parseSchoolBranding(
  settings: Record<string, unknown> | null | undefined
): SchoolBrandingPaths {
  const school = (settings?.school as Record<string, unknown> | undefined) ?? {};
  const raw = (school.branding as Record<string, unknown> | undefined) ?? {};
  return {
    logo_storage_path:
      typeof raw.logo_storage_path === 'string' && raw.logo_storage_path.trim()
        ? raw.logo_storage_path.trim()
        : null,
    logo_pdf_cache: parsePdfCache(raw.logo_pdf_cache),
  };
}

export function mergeSchoolBrandingPatch(
  current: Record<string, unknown> | null | undefined,
  patch: Partial<SchoolBrandingPaths>
): Record<string, unknown> {
  const base = { ...(current ?? {}) };
  const school = { ...((base.school as Record<string, unknown>) ?? {}) };
  school.branding = { ...parseSchoolBranding(base), ...patch };
  base.school = school;
  return base;
}

export function parseBulletinTemplate(
  settings: Record<string, unknown> | null | undefined
): SchoolBulletinTemplate {
  const school = (settings?.school as Record<string, unknown> | undefined) ?? {};
  const raw = (school.bulletin_template as Record<string, unknown> | undefined) ?? {};
  const color =
    typeof raw.primary_color === 'string'
      ? raw.primary_color.replace(/^#/, '').trim()
      : DEFAULT_BULLETIN_TEMPLATE.primary_color;

  const refRaw = (raw.reference as Record<string, unknown> | undefined) ?? {};
  const stampRaw = (raw.stamp as Record<string, unknown> | undefined) ?? {};

  const layoutRaw = typeof raw.layout_preset === 'string' ? raw.layout_preset.trim() : '';

  return {
    layout_preset: isBulletinLayoutPresetId(layoutRaw)
      ? layoutRaw
      : DEFAULT_BULLETIN_LAYOUT_PRESET,
    header_title:
      typeof raw.header_title === 'string' && raw.header_title.trim()
        ? raw.header_title.trim()
        : DEFAULT_BULLETIN_TEMPLATE.header_title,
    header_subtitle:
      typeof raw.header_subtitle === 'string' ? raw.header_subtitle.trim() : '',
    show_rank: raw.show_rank !== false,
    show_appreciation: raw.show_appreciation !== false,
    show_coefficients: raw.show_coefficients !== false,
    show_all_subjects: raw.show_all_subjects !== false,
    show_evaluation_details: Boolean(raw.show_evaluation_details),
    require_logo: raw.require_logo !== false,
    require_stamp: raw.require_stamp !== false,
    footer_text:
      typeof raw.footer_text === 'string' && raw.footer_text.trim()
        ? raw.footer_text.trim()
        : DEFAULT_BULLETIN_TEMPLATE.footer_text,
    director_signature_label:
      typeof raw.director_signature_label === 'string' && raw.director_signature_label.trim()
        ? raw.director_signature_label.trim()
        : DEFAULT_BULLETIN_TEMPLATE.director_signature_label,
    primary_color: /^[0-9A-Fa-f]{6}$/.test(color) ? color : DEFAULT_BULLETIN_TEMPLATE.primary_color,
    reference: {
      document_id:
        typeof refRaw.document_id === 'string' && refRaw.document_id.trim()
          ? refRaw.document_id.trim()
          : null,
      file_name:
        typeof refRaw.file_name === 'string' && refRaw.file_name.trim()
          ? refRaw.file_name.trim()
          : null,
      synced_at:
        typeof refRaw.synced_at === 'string' && refRaw.synced_at.trim()
          ? refRaw.synced_at.trim()
          : null,
    },
    stamp: {
      document_id:
        typeof stampRaw.document_id === 'string' && stampRaw.document_id.trim()
          ? stampRaw.document_id.trim()
          : null,
      file_name:
        typeof stampRaw.file_name === 'string' && stampRaw.file_name.trim()
          ? stampRaw.file_name.trim()
          : null,
      processed_at:
        typeof stampRaw.processed_at === 'string' && stampRaw.processed_at.trim()
          ? stampRaw.processed_at.trim()
          : null,
      process_method:
        typeof stampRaw.process_method === 'string' && stampRaw.process_method.trim()
          ? stampRaw.process_method.trim()
          : null,
      pdf_cache: parsePdfCache(stampRaw.pdf_cache),
    },
  };
}

export function mergeBulletinStampPatch(
  current: Record<string, unknown> | null | undefined,
  stamp: BulletinStampFile
): Record<string, unknown> {
  const tpl = parseBulletinTemplate(current);
  return mergeBulletinTemplatePatch(current, { ...tpl, stamp });
}

/** Extrait titres / signatures depuis le texte d'un bulletin modèle (PDF/Word indexé). */
export function inferBulletinStyleFromText(text: string): Partial<SchoolBulletinTemplate> {
  const lines = text
    .replace(/\u00a0/g, ' ')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const patch: Partial<SchoolBulletinTemplate> = {};

  for (const line of lines.slice(0, 30)) {
    if (/bulletin/i.test(line) && line.length < 80 && !patch.header_title) {
      patch.header_title = line.toUpperCase();
    }
    if (
      /^(le\s+)?(directeur|la\s+directrice|proviseur|chef\s+d'?établissement)/i.test(line) &&
      line.length < 60
    ) {
      patch.director_signature_label = line;
    }
  }

  const footerCandidates = lines.filter(
    (l) =>
      l.length > 12 &&
      l.length < 120 &&
      /(document|établissement|généré|scolarité|mention|certifié)/i.test(l)
  );
  if (footerCandidates.length) {
    patch.footer_text = footerCandidates[footerCandidates.length - 1];
  }

  return patch;
}

export function mergeReferenceIntoBulletinTemplate(
  current: SchoolBulletinTemplate,
  reference: BulletinReferenceFile,
  stylePatch?: Partial<SchoolBulletinTemplate>
): SchoolBulletinTemplate {
  return {
    ...current,
    ...stylePatch,
    reference,
  };
}

export function mergeBulletinTemplatePatch(
  current: Record<string, unknown> | null | undefined,
  patch: Partial<SchoolBulletinTemplate>
): Record<string, unknown> {
  const base = { ...(current ?? {}) };
  const school = { ...((base.school as Record<string, unknown>) ?? {}) };
  const tpl = parseBulletinTemplate(base);
  school.bulletin_template = { ...tpl, ...patch };
  base.school = school;
  return base;
}
