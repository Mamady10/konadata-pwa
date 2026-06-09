import type { EducationLevelBand } from '@/lib/school/grading-period-settings';

/** Barème par défaut : /10 au primaire, /20 ailleurs. */
export function defaultMaxScoreForEducationBand(
  band: EducationLevelBand | null | undefined
): number {
  return band === 'primaire' ? 10 : 20;
}

export function normalizeEvaluationCoefficient(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.min(20, Math.round(n * 100) / 100);
}

export function normalizeEvaluationMaxScore(raw: unknown, fallback = 20): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(100, Math.round(n * 100) / 100);
}

export function evaluationSlotKey(subjectId: string, examType: string): string {
  return `${subjectId}::${(examType || 'default').trim()}`;
}
