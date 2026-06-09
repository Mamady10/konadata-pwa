import {
  computeGeneralAverage,
  computeSubjectAverages,
  type GradeForAverage,
} from '@/lib/school/report-card-average';

export interface EvaluationSlot {
  subjectId: string;
  examType: string;
}

export interface StudentCompleteness {
  studentId: string;
  filledSlots: number;
  totalSlots: number;
  pct: number;
  subjectsWithGrades: number;
  subjectsExpected: number;
}

export interface ClassReportCardCompleteness {
  classId: string;
  semester: string;
  academicYear: string;
  enrolledCount: number;
  evaluationSlots: number;
  subjectsInScope: number;
  studentsWithAnyGrade: number;
  studentsFullyComplete: number;
  averageCompletenessPct: number;
  ready: boolean;
  perStudent: StudentCompleteness[];
}

const DEFAULT_MIN_COMPLETENESS = 60;

function uniqueSubjects(slots: EvaluationSlot[]): string[] {
  return [...new Set(slots.map((s) => s.subjectId))];
}

function gradeKey(subjectId: string, examType: string): string {
  return `${subjectId}::${examType}`;
}

export function evaluateStudentCompleteness(
  studentId: string,
  evaluationSlots: EvaluationSlot[],
  grades: GradeForAverage[],
  subjectsInScope: string[]
): StudentCompleteness {
  const studentGrades = grades.filter((g) => g.studentId === studentId);
  const filledKeys = new Set(
    studentGrades.map((g) => gradeKey(g.subjectId, g.examType))
  );

  const totalSlots = evaluationSlots.length;
  let filledSlots = 0;
  for (const slot of evaluationSlots) {
    if (filledKeys.has(gradeKey(slot.subjectId, slot.examType))) {
      filledSlots += 1;
    }
  }

  const subjectsWithGrades = new Set(studentGrades.map((g) => g.subjectId)).size;
  const subjectsExpected = subjectsInScope.length;

  const pct =
    totalSlots > 0
      ? Math.round((filledSlots / totalSlots) * 100)
      : subjectsExpected > 0
        ? Math.round((subjectsWithGrades / subjectsExpected) * 100)
        : 0;

  return {
    studentId,
    filledSlots,
    totalSlots,
    pct,
    subjectsWithGrades,
    subjectsExpected,
  };
}

export function evaluateClassCompleteness(params: {
  classId: string;
  semester: string;
  academicYear: string;
  enrolledStudentIds: string[];
  evaluationSlots: EvaluationSlot[];
  grades: Array<GradeForAverage & { studentId: string }>;
  minPct?: number;
}): ClassReportCardCompleteness {
  const subjectsInScope =
    params.evaluationSlots.length > 0
      ? uniqueSubjects(params.evaluationSlots)
      : uniqueSubjects(
          params.grades.map((g) => ({ subjectId: g.subjectId, examType: g.examType }))
        );

  const perStudent = params.enrolledStudentIds.map((studentId) =>
    evaluateStudentCompleteness(
      studentId,
      params.evaluationSlots,
      params.grades,
      subjectsInScope
    )
  );

  const studentsWithAnyGrade = perStudent.filter((s) => s.filledSlots > 0 || s.subjectsWithGrades > 0)
    .length;
  const studentsFullyComplete = perStudent.filter(
    (s) => s.totalSlots > 0 && s.filledSlots >= s.totalSlots
  ).length;

  const averageCompletenessPct =
    perStudent.length > 0
      ? Math.round(
          perStudent.reduce((sum, s) => sum + s.pct, 0) / perStudent.length
        )
      : 0;

  const minPct = params.minPct ?? DEFAULT_MIN_COMPLETENESS;

  return {
    classId: params.classId,
    semester: params.semester,
    academicYear: params.academicYear,
    enrolledCount: params.enrolledStudentIds.length,
    evaluationSlots: params.evaluationSlots.length,
    subjectsInScope: subjectsInScope.length,
    studentsWithAnyGrade,
    studentsFullyComplete,
    averageCompletenessPct,
    ready: averageCompletenessPct >= minPct,
    perStudent,
  };
}

export function studentAverageFromGradeRows(
  grades: GradeForAverage[]
): number {
  return computeGeneralAverage([...computeSubjectAverages(grades).values()]);
}
