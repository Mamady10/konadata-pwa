import { isExamTypeIncluded } from '@/lib/school/bulletin-exam-types';
import type { ReportCardGradeLine } from '@/lib/school/report-card-pdf';
import { computeSubjectAverages, type GradeForAverage } from '@/lib/school/report-card-average';
import { isGradeRecorded } from '@/lib/school/grade-gaps';

interface SubjectRow {
  id: string;
  name: string;
  coefficient: number;
}

interface GradeRow {
  subject_id: string;
  exam_type?: string;
  score: number;
  max_score: number;
  school_subjects?: { name?: string; coefficient?: number } | null;
}

function buildDetailedGradeLines(
  subjects: SubjectRow[],
  grades: GradeRow[],
  showAllSubjects: boolean,
  includedExamTypes?: string[] | null
): ReportCardGradeLine[] {
  const filtered = grades.filter((g) =>
    isExamTypeIncluded(g.exam_type ?? 'default', includedExamTypes)
  );
  const bySubject = new Map<string, GradeRow[]>();
  for (const g of filtered) {
    const list = bySubject.get(g.subject_id) ?? [];
    list.push(g);
    bySubject.set(g.subject_id, list);
  }
  const source = showAllSubjects
    ? subjects
    : subjects.filter((s) => bySubject.has(s.id));

  const lines: ReportCardGradeLine[] = [];
  for (const sub of source) {
    const subjectGrades = bySubject.get(sub.id) ?? [];
    if (subjectGrades.length === 0) {
      lines.push({
        subjectName: sub.name,
        score: null,
        maxScore: 20,
        coefficient: sub.coefficient,
        missing: true,
        evaluationCount: 0,
      });
      continue;
    }
    for (const g of subjectGrades) {
      if (!isGradeRecorded(g.score)) continue;
      const max = Number(g.max_score) || 20;
      const on20 = (Number(g.score) / max) * 20;
      lines.push({
        subjectName: sub.name,
        score: Math.round(on20 * 100) / 100,
        maxScore: 20,
        coefficient: sub.coefficient,
        examType: g.exam_type ?? null,
        evaluationCount: 1,
        missing: false,
      });
    }
  }
  return lines;
}

export function buildReportCardGradeLines(
  subjects: SubjectRow[],
  grades: GradeRow[],
  showAllSubjects: boolean,
  includedExamTypes?: string[] | null,
  showEvaluationDetails?: boolean
): ReportCardGradeLine[] {
  if (showEvaluationDetails) {
    return buildDetailedGradeLines(subjects, grades, showAllSubjects, includedExamTypes);
  }
  const gradesBySubject = new Map<string, GradeRow[]>();
  for (const g of grades) {
    const examType = g.exam_type ?? 'default';
    if (!isExamTypeIncluded(examType, includedExamTypes)) continue;
    const list = gradesBySubject.get(g.subject_id) ?? [];
    list.push(g);
    gradesBySubject.set(g.subject_id, list);
  }

  const source = showAllSubjects
    ? subjects
    : subjects.filter((s) => gradesBySubject.has(s.id));

  return source.map((sub) => {
    const subjectGrades = gradesBySubject.get(sub.id) ?? [];
    if (subjectGrades.length === 0) {
      return {
        subjectName: sub.name,
        score: null,
        maxScore: 20,
        coefficient: sub.coefficient,
        missing: true,
        evaluationCount: 0,
      };
    }

    const forAvg: GradeForAverage[] = subjectGrades
      .filter((g) => isGradeRecorded(g.score))
      .map((g) => ({
      subjectId: g.subject_id,
      examType: g.exam_type ?? 'default',
      score: Number(g.score),
      maxScore: Number(g.max_score) || 20,      coefficient: Number(
        (g.school_subjects as { coefficient?: number })?.coefficient ?? sub.coefficient ?? 1
      ),
    }));
    const avgMap = computeSubjectAverages(forAvg);    const avg = avgMap.get(sub.id);
    const evalCount = avg?.evaluationCount ?? subjectGrades.length;

    return {
      subjectName:
        (subjectGrades[0].school_subjects as { name?: string })?.name ?? sub.name,
      score: avg?.averageOn20 ?? null,
      maxScore: 20,
      coefficient: avg?.coefficient ?? sub.coefficient,
      missing: false,
      evaluationCount: evalCount,
      examType: evalCount > 1 ? `${evalCount} éval.` : subjectGrades[0].exam_type ?? null,
    };
  });
}
