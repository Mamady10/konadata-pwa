export type MatriculeFormat = 'class_year_seq' | 'org_year_seq';

export interface StudentMatriculeSettings {
  auto_generate_on_import: boolean;
  format: MatriculeFormat;
  org_prefix: string | null;
  seq_pad: number;
  display_label: string;
}

export const DEFAULT_STUDENT_MATRICULE_SETTINGS: StudentMatriculeSettings = {
  auto_generate_on_import: true,
  format: 'class_year_seq',
  org_prefix: null,
  seq_pad: 3,
  display_label: 'Code élève KonaData',
};

export function parseStudentMatriculeSettings(raw: unknown): StudentMatriculeSettings {
  const o = (raw ?? {}) as Record<string, unknown>;
  const format = o.format === 'org_year_seq' ? 'org_year_seq' : 'class_year_seq';
  return {
    auto_generate_on_import: o.auto_generate_on_import !== false,
    format,
    org_prefix: o.org_prefix != null && String(o.org_prefix).trim() ? String(o.org_prefix).trim() : null,
    seq_pad: Math.min(5, Math.max(2, Number(o.seq_pad ?? 3) || 3)),
    display_label: String(o.display_label ?? 'Code élève KonaData').trim() || 'Code élève KonaData',
  };
}

/** Exemple lisible selon le format configuré. */
export function matriculeFormatExample(settings: StudentMatriculeSettings): string {
  const year = String(new Date().getFullYear() % 100).padStart(2, '0');
  const seq = '1'.padStart(settings.seq_pad, '0');
  if (settings.format === 'org_year_seq') {
    const prefix = (settings.org_prefix || 'LYC-KAL').toUpperCase().replace(/[^A-Z0-9-]/g, '');
    return `${prefix}-${year}-${seq}`;
  }
  return `6A-${year}-${seq}`;
}

export interface MatriculeExportRow {
  matricule: string;
  full_name: string;
  class_name: string;
  phone: string | null;
  email: string | null;
}

export function buildMatriculeExportCsv(rows: MatriculeExportRow[]): string {
  const header = 'code_eleve;nom;classe;telephone;email';
  const lines = rows.map((r) => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    return [
      esc(r.matricule),
      esc(r.full_name),
      esc(r.class_name),
      esc(r.phone ?? ''),
      esc(r.email ?? ''),
    ].join(';');
  });
  return [header, ...lines].join('\n');
}
