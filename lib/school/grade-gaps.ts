import {
  requiredEvaluationsForPeriod,
  type GradingPeriodPolicy,
} from '@/lib/school/grading-period-settings';

/** Note saisie : 0/20 compte ; null / vide = non saisie. */
export function isGradeRecorded(score: unknown): boolean {
  if (score === null || score === undefined) return false;
  if (typeof score === 'string' && score.trim() === '') return false;
  const n = Number(score);
  return Number.isFinite(n);
}

export interface GradeGapRow {
  studentId: string;
  studentName: string;
  subjectId: string;
  subjectName: string;
  examType: string;
  examLabel: string;
}

export interface GradeGapReport {
  classId: string;
  periodId: string;
  academicYear: string;
  requiredPerSubject: number;
  enrolledCount: number;
  gaps: GradeGapRow[];
  studentsWithGaps: number;
  totalMissingSlots: number;
  hasGaps: boolean;
}

interface EvaluationRow {
  subjectId: string;
  subjectName: string;
  examType: string;
}

interface GradeRow {
  studentId: string;
  subjectId: string;
  examType: string;
  score: unknown;
}

interface StudentRow {
  id: string;
  name: string;
}

function gradeKey(subjectId: string, examType: string): string {
  return `${subjectId}::${examType}`;
}

function buildExpectedSlotsPerSubject(
  subjectId: string,
  subjectName: string,
  definedEvals: EvaluationRow[],
  requiredPerSubject: number
): { examType: string; examLabel: string; subjectId: string; subjectName: string }[] {
  const forSubject = definedEvals.filter((e) => e.subjectId === subjectId);
  const slots: { examType: string; examLabel: string; subjectId: string; subjectName: string }[] =
    [];

  for (const ev of forSubject) {
    slots.push({
      subjectId,
      subjectName,
      examType: ev.examType,
      examLabel: ev.examType,
    });
  }

  const target = Math.max(requiredPerSubject, forSubject.length);
  for (let i = forSubject.length; i < target; i++) {
    slots.push({
      subjectId,
      subjectName,
      examType: `__slot_${i + 1}`,
      examLabel: `Note ${i + 1}`,
    });
  }

  return slots;
}

export function buildGradeGapReport(params: {
  classId: string;
  periodId: string;
  academicYear: string;
  policy: GradingPeriodPolicy;
  students: StudentRow[];
  subjects: { id: string; name: string }[];
  evaluations: EvaluationRow[];
  grades: GradeRow[];
}): GradeGapReport {
  const requiredPerSubject = requiredEvaluationsForPeriod(params.policy, params.periodId);
  const gaps: GradeGapRow[] = [];

  const gradeMap = new Map<string, boolean>();
  for (const g of params.grades) {
    if (!isGradeRecorded(g.score)) continue;
    gradeMap.set(`${g.studentId}::${gradeKey(g.subjectId, g.examType)}`, true);
  }

  const gradeCountByStudentSubject = new Map<string, number>();
  for (const g of params.grades) {
    if (!isGradeRecorded(g.score)) continue;
    const k = `${g.studentId}::${g.subjectId}`;
    gradeCountByStudentSubject.set(k, (gradeCountByStudentSubject.get(k) ?? 0) + 1);
  }

  for (const student of params.students) {
    for (const subject of params.subjects) {
      const expectedSlots = buildExpectedSlotsPerSubject(
        subject.id,
        subject.name,
        params.evaluations,
        requiredPerSubject
      );

      for (const slot of expectedSlots) {
        if (slot.examType.startsWith('__slot_')) {
          const countKey = `${student.id}::${subject.id}`;
          const count = gradeCountByStudentSubject.get(countKey) ?? 0;
          const slotIndex = Number(slot.examType.replace('__slot_', ''));
          if (slotIndex > count) {
            gaps.push({
              studentId: student.id,
              studentName: student.name,
              subjectId: subject.id,
              subjectName: subject.name,
              examType: slot.examType,
              examLabel: slot.examLabel,
            });
          }
          continue;
        }

        const key = `${student.id}::${gradeKey(subject.id, slot.examType)}`;
        if (!gradeMap.has(key)) {
          gaps.push({
            studentId: student.id,
            studentName: student.name,
            subjectId: subject.id,
            subjectName: subject.name,
            examType: slot.examType,
            examLabel: slot.examLabel,
          });
        }
      }
    }
  }

  const studentsWithGaps = new Set(gaps.map((g) => g.studentId)).size;

  return {
    classId: params.classId,
    periodId: params.periodId,
    academicYear: params.academicYear,
    requiredPerSubject,
    enrolledCount: params.students.length,
    gaps,
    studentsWithGaps,
    totalMissingSlots: gaps.length,
    hasGaps: gaps.length > 0,
  };
}

export function summarizeGradeGaps(report: GradeGapReport, maxLines = 12): string {
  if (!report.hasGaps) return '';
  const lines: string[] = [];
  const byStudent = new Map<string, GradeGapRow[]>();
  for (const g of report.gaps) {
    const list = byStudent.get(g.studentId) ?? [];
    list.push(g);
    byStudent.set(g.studentId, list);
  }

  for (const [, rows] of byStudent) {
    if (lines.length >= maxLines) break;
    const name = rows[0].studentName;
    const parts = rows.slice(0, 4).map((r) => `${r.subjectName} (${r.examLabel})`);
    const extra = rows.length > 4 ? ` +${rows.length - 4}` : '';
    lines.push(`• ${name} : ${parts.join(', ')}${extra}`);
  }

  const moreStudents = report.studentsWithGaps - lines.length;
  if (moreStudents > 0 && lines.length >= maxLines) {
    lines.push(`… et ${report.studentsWithGaps - maxLines} autre(s) élève(s)`);
  }

  return lines.join('\n');
}
