/** Export statistiques MEPS / MEPPSA (Guinée) — format tabulaire strict. */

import type { SchoolMepsSettings } from '@/lib/school/meps-settings';

export interface MepsExportMeta {
  org_name: string;
  academic_year: string;
  export_date: string;
  meps: SchoolMepsSettings;
  total_enrolled: number;
  total_male: number;
  total_female: number;
}

export interface MepsExportRow {
  row_number: number;
  academic_year: string;
  education_level: string;
  class_name: string;
  enrolled_total: number;
  enrolled_male: number;
  enrolled_female: number;
  enrolled_unknown_gender: number;
  teachers_count: number;
  students_with_grades: number;
  class_average: string;
  pass_rate_pct: string;
  attendance_sessions: number;
  attendance_rate_pct: string;
  tuition_collected_gnf: number;
  bulletins_final: number;
}

/** En-têtes alignés fiche statistique établissement (MEPPSA). */
export function mepsExportHeaders(): string[] {
  return [
    'n_ligne',
    'annee_scolaire',
    'niveau_enseignement',
    'classe',
    'effectif_total',
    'effectif_garcons',
    'effectif_filles',
    'effectif_sexe_non_renseigne',
    'nb_enseignants_classe',
    'eleves_avec_notes',
    'moyenne_generale_classe',
    'taux_reussite_pct',
    'nb_seances_presence',
    'taux_presence_pct',
    'montant_encaisse_scolarite_gnf',
    'nb_bulletins_definitifs',
  ];
}

export function mepsRowToCsvLine(row: MepsExportRow): string[] {
  return [
    String(row.row_number),
    row.academic_year,
    row.education_level,
    row.class_name,
    String(row.enrolled_total),
    String(row.enrolled_male),
    String(row.enrolled_female),
    String(row.enrolled_unknown_gender),
    String(row.teachers_count),
    String(row.students_with_grades),
    row.class_average,
    row.pass_rate_pct,
    String(row.attendance_sessions),
    row.attendance_rate_pct,
    String(row.tuition_collected_gnf),
    String(row.bulletins_final),
  ];
}

function escapeCsvCell(v: string): string {
  if (v.includes(';') || v.includes('"') || v.includes('\n')) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function metaLine(label: string, value: string): string {
  return `${label};${escapeCsvCell(value)}`;
}

export function buildMepsCsv(rows: MepsExportRow[], meta: MepsExportMeta): string {
  const lines: string[] = [
    'REPUBLIQUE DE GUINEE',
    "MINISTERE DE L'ENSEIGNEMENT PRESCOLAIRE PRIMAIRE SECONDAIRE ET DE L'ALPHABETISATION (MEPPSA)",
    'FICHE STATISTIQUE ETABLISSEMENT SCOLAIRE',
    '',
    metaLine('code_etablissement', meta.meps.establishment_code || 'NON_RENSEIGNE'),
    metaLine('nom_etablissement', meta.org_name),
    metaLine('commune', meta.meps.commune || 'NON_RENSEIGNEE'),
    metaLine('prefecture', meta.meps.prefecture || 'NON_RENSEIGNEE'),
    metaLine('circonscription', meta.meps.circonscription || 'NON_RENSEIGNEE'),
    metaLine('annee_scolaire', meta.academic_year),
    metaLine('date_export', meta.export_date),
    metaLine('effectif_total_etablissement', String(meta.total_enrolled)),
    metaLine('effectif_garcons_etablissement', String(meta.total_male)),
    metaLine('effectif_filles_etablissement', String(meta.total_female)),
    '',
    mepsExportHeaders().join(';'),
    ...rows.map((r) => mepsRowToCsvLine(r).map(escapeCsvCell).join(';')),
    '',
    metaLine('source', 'KonaData — export automatique'),
  ];

  return '\uFEFF' + lines.join('\n');
}

export function normalizeGender(gender: string | null | undefined): 'M' | 'F' | null {
  if (!gender?.trim()) return null;
  const g = gender.trim().toLowerCase();
  if (g === 'm' || g === 'h' || g.startsWith('masc') || g === 'garcon' || g === 'garçon') {
    return 'M';
  }
  if (g === 'f' || g.startsWith('fem') || g === 'fille') return 'F';
  return null;
}

/** Taux de réussite : élèves avec moyenne bulletin >= 10 / effectif avec bulletin. */
export function computePassRatePct(
  reportCards: Array<{ average_score: number | null }>,
  passThreshold = 10
): string {
  if (!reportCards.length) return '—';
  const passed = reportCards.filter(
    (c) => c.average_score != null && Number(c.average_score) >= passThreshold
  ).length;
  return String(Math.round((passed / reportCards.length) * 100));
}
