/** Périodes de notation par niveau (primaire, collège, lycée, université). */

export type GradingPeriodMode = 'semester' | 'trimester';

export type EducationLevelBand = 'primaire' | 'college' | 'lycee' | 'universite';

export interface PeriodRequirement {
  period_id: string;
  label: string;
  required_evaluations_per_subject: number;
}

export interface GradingPeriodPolicy {
  mode: GradingPeriodMode;
  periods: PeriodRequirement[];
}

export type GradingPeriodPolicyByLevel = Record<EducationLevelBand, GradingPeriodPolicy>;

export const EDUCATION_LEVEL_BANDS: Array<{
  id: EducationLevelBand;
  label: string;
  defaultMode: GradingPeriodMode;
}> = [
  { id: 'primaire', label: 'Primaire / fondamental', defaultMode: 'trimester' },
  { id: 'college', label: 'Collège', defaultMode: 'trimester' },
  { id: 'lycee', label: 'Lycée', defaultMode: 'semester' },
  { id: 'universite', label: 'Université / supérieur', defaultMode: 'semester' },
];

export const DEFAULT_SEMESTER_PERIODS: PeriodRequirement[] = [
  { period_id: 'S1', label: '1er semestre', required_evaluations_per_subject: 2 },
  { period_id: 'S2', label: '2e semestre', required_evaluations_per_subject: 2 },
  { period_id: 'S3', label: '3e semestre', required_evaluations_per_subject: 2 },
];

export const DEFAULT_TRIMESTER_PERIODS: PeriodRequirement[] = [
  { period_id: 'T1', label: '1er trimestre', required_evaluations_per_subject: 3 },
  { period_id: 'T2', label: '2e trimestre', required_evaluations_per_subject: 3 },
  { period_id: 'T3', label: '3e trimestre', required_evaluations_per_subject: 3 },
];

function defaultPolicyForMode(mode: GradingPeriodMode): GradingPeriodPolicy {
  return {
    mode,
    periods: mode === 'trimester' ? [...DEFAULT_TRIMESTER_PERIODS] : [...DEFAULT_SEMESTER_PERIODS],
  };
}

export function defaultGradingPeriodByLevel(): GradingPeriodPolicyByLevel {
  const out = {} as GradingPeriodPolicyByLevel;
  for (const band of EDUCATION_LEVEL_BANDS) {
    out[band.id] = defaultPolicyForMode(band.defaultMode);
  }
  return out;
}

/** @deprecated Utiliser defaultGradingPeriodByLevel */
export const DEFAULT_GRADING_PERIOD_POLICY: GradingPeriodPolicy =
  defaultPolicyForMode('semester');

function clampRequired(n: unknown, fallback: number): number {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 1) return fallback;
  return Math.min(20, Math.round(v));
}

export function parseGradingPeriodPolicy(raw: unknown): GradingPeriodPolicy {
  const o = raw as Record<string, unknown> | undefined;
  const mode: GradingPeriodMode =
    o?.mode === 'trimester' ? 'trimester' : 'semester';
  const defaults =
    mode === 'trimester' ? DEFAULT_TRIMESTER_PERIODS : DEFAULT_SEMESTER_PERIODS;

  if (!Array.isArray(o?.periods)) {
    return defaultPolicyForMode(mode);
  }

  const periods: PeriodRequirement[] = [];
  for (const item of o.periods) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const period_id = typeof row.period_id === 'string' ? row.period_id.trim() : '';
    if (!period_id) continue;
    const def = defaults.find((d) => d.period_id === period_id);
    periods.push({
      period_id,
      label:
        typeof row.label === 'string' && row.label.trim()
          ? row.label.trim()
          : def?.label ?? period_id,
      required_evaluations_per_subject: clampRequired(
        row.required_evaluations_per_subject,
        def?.required_evaluations_per_subject ?? 2
      ),
    });
  }

  if (periods.length === 0) return defaultPolicyForMode(mode);

  for (const def of defaults) {
    if (!periods.some((p) => p.period_id === def.period_id)) {
      periods.push({ ...def });
    }
  }

  periods.sort(
    (a, b) =>
      defaults.findIndex((d) => d.period_id === a.period_id) -
      defaults.findIndex((d) => d.period_id === b.period_id)
  );

  return { mode, periods };
}

export function parseGradingPeriodByLevel(raw: unknown): GradingPeriodPolicyByLevel {
  const defaults = defaultGradingPeriodByLevel();
  const o = raw as Record<string, unknown> | undefined;

  if (o && typeof o === 'object' && !('mode' in o) && !('periods' in o)) {
    const out = { ...defaults };
    for (const band of EDUCATION_LEVEL_BANDS) {
      if (o[band.id] != null) {
        out[band.id] = parseGradingPeriodPolicy(o[band.id]);
      }
    }
    return out;
  }

  const legacy = parseGradingPeriodPolicy(raw);
  const out = { ...defaults };
  for (const band of EDUCATION_LEVEL_BANDS) {
    out[band.id] = { ...legacy, periods: legacy.periods.map((p) => ({ ...p })) };
  }
  return out;
}

export function normalizeClassLevelText(level: string | null | undefined): string {
  return (level ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/** Déduit le palier à partir du champ « niveau » de la classe. */
export function inferEducationLevelBand(
  classLevel: string | null | undefined
): EducationLevelBand {
  const t = normalizeClassLevelText(classLevel);
  if (!t) return 'college';

  if (
    /uni|licence|lic|master|m1|m2|doctorat|phd|bts|dut|sup|superieur|ingenieur|faculte/.test(t)
  ) {
    return 'universite';
  }
  if (
    /lycee|lyc|terminale|tle|term|seconde|2nde|premiere|1ere|1re|cap|bac|stm|stg|sti|std|11e|12e|11eme|12eme/.test(
      t
    )
  ) {
    return 'lycee';
  }
  if (
    /college|coll|3eme|4eme|5eme|6eme|cm2|cm1|bepc|7e|8e|9e|10e|7eme|8eme|9eme|10eme/.test(t)
  ) {
    return 'college';
  }
  if (
    /primaire|prim|fondamental|fond|maternelle|cp|ce1|ce2|cm|1e|2e|3e|4e|5e|6e|1ere annee|2eme annee/.test(
      t
    )
  ) {
    return 'primaire';
  }

  if (/^l[1-3]$|^m[1-2]$/.test(t.replace(/\s/g, ''))) return 'universite';
  return 'college';
}

export function educationLevelBandLabel(band: EducationLevelBand): string {
  return EDUCATION_LEVEL_BANDS.find((b) => b.id === band)?.label ?? band;
}

export function resolveGradingPolicyForClass(
  byLevel: GradingPeriodPolicyByLevel,
  classLevel: string | null | undefined,
  explicitBand?: EducationLevelBand | null
): GradingPeriodPolicy {
  const band = explicitBand ?? inferEducationLevelBand(classLevel);
  return byLevel[band] ?? defaultGradingPeriodByLevel()[band];
}

export function gradingPeriodIds(policy: GradingPeriodPolicy): string[] {
  return policy.periods.map((p) => p.period_id);
}

export function reportCardPeriodLabel(periodId: string): string {
  if (periodId === 'S1') return '1er semestre';
  if (periodId === 'S2') return '2e semestre';
  if (periodId === 'S3') return '3e semestre';
  if (periodId === 'T1') return '1er trimestre';
  if (periodId === 'T2') return '2e trimestre';
  if (periodId === 'T3') return '3e trimestre';
  return periodId;
}

export function gradingPeriodLabel(policy: GradingPeriodPolicy, periodId: string): string {
  const p = policy.periods.find((x) => x.period_id === periodId);
  if (p) return p.label;
  return reportCardPeriodLabel(periodId);
}

export function requiredEvaluationsForPeriod(
  policy: GradingPeriodPolicy,
  periodId: string
): number {
  const p = policy.periods.find((x) => x.period_id === periodId);
  return p?.required_evaluations_per_subject ?? 2;
}

export function switchGradingPeriodMode(
  current: GradingPeriodPolicy,
  mode: GradingPeriodMode
): GradingPeriodPolicy {
  if (current.mode === mode) return current;
  const defaults =
    mode === 'trimester' ? DEFAULT_TRIMESTER_PERIODS : DEFAULT_SEMESTER_PERIODS;
  const sampleRequired =
    current.periods[0]?.required_evaluations_per_subject ??
    defaults[0].required_evaluations_per_subject;
  return {
    mode,
    periods: defaults.map((p) => ({
      ...p,
      required_evaluations_per_subject: sampleRequired,
    })),
  };
}

export function firstPeriodIdForPolicy(policy: GradingPeriodPolicy): string {
  return policy.periods[0]?.period_id ?? 'S1';
}

export function isPeriodInPolicy(policy: GradingPeriodPolicy, periodId: string): boolean {
  return policy.periods.some((p) => p.period_id === periodId);
}
