import { isGradeRecorded } from '@/lib/school/grade-gaps';

/** Calcul moyennes bulletin : moyenne par matière (évaluations multiples) puis moyenne générale pondérée. */
export interface GradeForAverage {
  subjectId: string;
  examType: string;
  score: number;
  maxScore: number;
  /** Coefficient matière (moyenne générale). */
  coefficient: number;
  /** Coefficient évaluation (moyenne de la matière). Défaut 1. */
  evaluationCoefficient?: number;
}

export interface SubjectAverageResult {
  subjectId: string;
  averageOn20: number;
  evaluationCount: number;
  coefficient: number;
}

export function normalizeScoreOn20(score: number, maxScore: number): number {
  const max = maxScore > 0 ? maxScore : 20;
  return (Number(score) / max) * 20;
}

/** Moyenne pondérée des évaluations saisies (coef. éval. ; 0/20 inclus ; case vide exclue). */
export function computeSubjectAverages(
  grades: GradeForAverage[]
): Map<string, SubjectAverageResult> {
  const bySubject = new Map<
    string,
    { weightedSum: number; evalCoefSum: number; count: number; coefficient: number }
  >();

  for (const g of grades) {
    if (!isGradeRecorded(g.score)) continue;
    const on20 = normalizeScoreOn20(Number(g.score), g.maxScore);
    const evalCoef =
      g.evaluationCoefficient != null && g.evaluationCoefficient > 0
        ? g.evaluationCoefficient
        : 1;
    const bucket = bySubject.get(g.subjectId) ?? {
      weightedSum: 0,
      evalCoefSum: 0,
      count: 0,
      coefficient: g.coefficient > 0 ? g.coefficient : 1,
    };
    bucket.weightedSum += on20 * evalCoef;
    bucket.evalCoefSum += evalCoef;
    bucket.count += 1;
    bucket.coefficient = g.coefficient > 0 ? g.coefficient : bucket.coefficient;
    bySubject.set(g.subjectId, bucket);
  }

  const result = new Map<string, SubjectAverageResult>();
  for (const [subjectId, data] of bySubject) {
    if (data.count === 0 || data.evalCoefSum <= 0) continue;
    result.set(subjectId, {
      subjectId,
      averageOn20: Math.round((data.weightedSum / data.evalCoefSum) * 100) / 100,
      evaluationCount: data.count,
      coefficient: data.coefficient,
    });
  }
  return result;
}

/** Moyenne générale = Σ(moyenne_matière × coef) / Σ(coef) — matières sans aucune note saisie exclues. */export function computeGeneralAverage(subjectAverages: SubjectAverageResult[]): number {
  let weightedSum = 0;
  let totalCoef = 0;
  for (const s of subjectAverages) {
    weightedSum += s.averageOn20 * s.coefficient;
    totalCoef += s.coefficient;
  }
  if (totalCoef <= 0) return 0;
  return Math.round((weightedSum / totalCoef) * 100) / 100;
}

export function computeStudentAverageFromGrades(grades: GradeForAverage[]): number {
  const subjects = [...computeSubjectAverages(grades).values()];
  return computeGeneralAverage(subjects);
}
