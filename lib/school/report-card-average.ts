import { isGradeRecorded } from '@/lib/school/grade-gaps';

/** Calcul moyennes bulletin : moyenne par matière (évaluations multiples) puis moyenne générale pondérée. */
export interface GradeForAverage {
  subjectId: string;
  examType: string;
  score: number;
  maxScore: number;
  coefficient: number;
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

/** Moyenne arithmétique des évaluations saisies (0/20 inclus ; case vide exclue). */
export function computeSubjectAverages(
  grades: GradeForAverage[]
): Map<string, SubjectAverageResult> {
  const bySubject = new Map<string, { scores: number[]; coefficient: number }>();

  for (const g of grades) {
    if (!isGradeRecorded(g.score)) continue;
    const on20 = normalizeScoreOn20(Number(g.score), g.maxScore);    const bucket = bySubject.get(g.subjectId) ?? {
      scores: [],
      coefficient: g.coefficient > 0 ? g.coefficient : 1,
    };
    bucket.scores.push(on20);
    bucket.coefficient = g.coefficient > 0 ? g.coefficient : bucket.coefficient;
    bySubject.set(g.subjectId, bucket);
  }

  const result = new Map<string, SubjectAverageResult>();
  for (const [subjectId, data] of bySubject) {
    if (data.scores.length === 0) continue;
    const sum = data.scores.reduce((a, b) => a + b, 0);
    result.set(subjectId, {
      subjectId,
      averageOn20: Math.round((sum / data.scores.length) * 100) / 100,
      evaluationCount: data.scores.length,
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
