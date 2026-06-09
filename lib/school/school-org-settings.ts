/** Paramètres établissement stockés dans organizations.settings.school */

import {
  DEFAULT_BULLETIN_TEMPLATE,
  parseBulletinTemplate,
  type SchoolBulletinTemplate,
} from '@/lib/school/bulletin-template';
import { parseIncludedExamTypes } from '@/lib/school/bulletin-exam-types';
import {
  defaultGradingPeriodByLevel,
  parseGradingPeriodByLevel,
  type GradingPeriodPolicyByLevel,
} from '@/lib/school/grading-period-settings';

export type { SchoolBulletinTemplate };

export interface ConcludedAcademicYear {
  year: string;
  concluded_at: string;
}

export interface SchoolOrgSettings {
  registrar_can_record_payments: boolean;
  default_academic_year: string;
  concluded_academic_years: ConcludedAcademicYear[];
  bulletin_template: SchoolBulletinTemplate;
  grading_period_by_level: GradingPeriodPolicyByLevel;
  /** Types d'évaluation inclus par défaut à la génération des bulletins (vide = toutes). */
  bulletin_default_exam_types: string[];
}

const DEFAULTS: SchoolOrgSettings = {
  registrar_can_record_payments: false,
  default_academic_year: '2025-2026',
  concluded_academic_years: [],
  bulletin_template: DEFAULT_BULLETIN_TEMPLATE,
  grading_period_by_level: defaultGradingPeriodByLevel(),
  bulletin_default_exam_types: [],
};

const ACADEMIC_YEAR_RE = /^(\d{4})-(\d{4})$/;

export function parseAcademicYearLabel(year: string): { start: number; end: number } | null {
  const m = year.trim().match(ACADEMIC_YEAR_RE);
  if (!m) return null;
  const start = Number(m[1]);
  const end = Number(m[2]);
  if (end !== start + 1) return null;
  return { start, end };
}

export function nextAcademicYearLabel(year: string): string | null {
  const parsed = parseAcademicYearLabel(year);
  if (!parsed) return null;
  return `${parsed.end}-${parsed.end + 1}`;
}

export function isAcademicYearConcluded(
  year: string,
  settings: Pick<SchoolOrgSettings, 'concluded_academic_years'>
): boolean {
  const y = year.trim();
  return settings.concluded_academic_years.some((e) => e.year === y);
}

export function parseSchoolOrgSettings(
  settings: Record<string, unknown> | null | undefined
): SchoolOrgSettings {
  const raw = (settings?.school as Record<string, unknown> | undefined) ?? {};
  const concludedRaw = raw.concluded_academic_years;
  const concluded: ConcludedAcademicYear[] = Array.isArray(concludedRaw)
    ? concludedRaw
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const row = item as Record<string, unknown>;
          const y = typeof row.year === 'string' ? row.year.trim() : '';
          const at = typeof row.concluded_at === 'string' ? row.concluded_at : '';
          if (!y || !at) return null;
          return { year: y, concluded_at: at };
        })
        .filter((x): x is ConcludedAcademicYear => x !== null)
    : [];

  return {
    registrar_can_record_payments: Boolean(raw.registrar_can_record_payments),
    default_academic_year:
      typeof raw.default_academic_year === 'string' && raw.default_academic_year.trim()
        ? raw.default_academic_year.trim()
        : DEFAULTS.default_academic_year,
    concluded_academic_years: concluded,
    bulletin_template: parseBulletinTemplate(settings),
    grading_period_by_level: parseGradingPeriodByLevel(
      raw.grading_period_by_level ?? raw.grading_period_policy
    ),
    bulletin_default_exam_types:
      parseIncludedExamTypes(raw.bulletin_default_exam_types) ?? [],
  };
}

export type { GradingPeriodPolicyByLevel };

export function mergeSchoolOrgSettingsPatch(
  current: Record<string, unknown> | null | undefined,
  patch: Partial<SchoolOrgSettings>
): Record<string, unknown> {
  const base = { ...(current ?? {}) };
  const school = parseSchoolOrgSettings(base);
  base.school = {
    ...school,
    ...patch,
  };
  return base;
}

export const SCHOOL_SEMESTERS = ['S1', 'S2', 'S3'] as const;
export type SchoolSemester = (typeof SCHOOL_SEMESTERS)[number];

export function currentAcademicYearLabel(): string {
  const y = new Date().getFullYear();
  const m = new Date().getMonth();
  const start = m >= 8 ? y : y - 1;
  return `${start}-${start + 1}`;
}

export function isTrialOrg(settings: Record<string, unknown> | null | undefined): boolean {
  return (settings?.platform_billing_period as string) === 'trial_30d';
}
