import {
  evaluationSlotKey,
  normalizeEvaluationCoefficient,
  normalizeEvaluationMaxScore,
} from '@/lib/school/evaluation-defaults';
import type { GradeForAverage } from '@/lib/school/report-card-average';

export interface GradeEvaluationMeta {
  maxScore: number;
  coefficient: number;
}

export type GradeEvaluationMetaRow = {
  subject_id: string;
  exam_type: string;
  max_score?: number | null;
  coefficient?: number | null;
};

export function buildEvaluationMetaMap(
  rows: GradeEvaluationMetaRow[]
): Map<string, GradeEvaluationMeta> {
  const map = new Map<string, GradeEvaluationMeta>();
  for (const row of rows) {
    map.set(evaluationSlotKey(row.subject_id, row.exam_type), {
      maxScore: normalizeEvaluationMaxScore(row.max_score),
      coefficient: normalizeEvaluationCoefficient(row.coefficient),
    });
  }
  return map;
}

export function resolveEvaluationMeta(
  map: Map<string, GradeEvaluationMeta>,
  subjectId: string,
  examType: string
): GradeEvaluationMeta {
  return (
    map.get(evaluationSlotKey(subjectId, examType)) ?? {
      maxScore: 20,
      coefficient: 1,
    }
  );
}

export function toGradeForAverage(
  row: {
    subjectId: string;
    examType: string;
    score: number;
    maxScore: number;
    subjectCoefficient: number;
  },
  evaluationMetaMap: Map<string, GradeEvaluationMeta>
): GradeForAverage {
  const meta = resolveEvaluationMeta(evaluationMetaMap, row.subjectId, row.examType);
  return {
    subjectId: row.subjectId,
    examType: row.examType,
    score: row.score,
    maxScore: row.maxScore > 0 ? row.maxScore : meta.maxScore,
    coefficient: row.subjectCoefficient > 0 ? row.subjectCoefficient : 1,
    evaluationCoefficient: meta.coefficient,
  };
}

export function mapGradesWithEvaluationMeta(
  grades: Array<{
    studentId: string;
    subjectId: string;
    examType: string;
    score: number;
    maxScore: number;
    coefficient: number;
  }>,
  evaluationRows: GradeEvaluationMetaRow[]
): Array<GradeForAverage & { studentId: string }> {
  const metaMap = buildEvaluationMetaMap(evaluationRows);
  return grades.map((g) => ({
    studentId: g.studentId,
    ...toGradeForAverage(
      {
        subjectId: g.subjectId,
        examType: g.examType,
        score: g.score,
        maxScore: g.maxScore,
        subjectCoefficient: g.coefficient,
      },
      metaMap
    ),
  }));
}
