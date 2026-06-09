import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { personName } from '@/lib/school/person-utils';
import {
  buildGradeGapReport,
  type GradeGapReport,
} from '@/lib/school/grade-gaps';
import { filterByIncludedExamTypes } from '@/lib/school/bulletin-exam-types';
import {
  parseEducationLevelBand,
  subjectMatchesClassBand,
} from '@/lib/school/education-level-catalog';
import {
  resolveGradingPolicyForClass,
  type GradingPeriodPolicyByLevel,
} from '@/lib/school/grading-period-settings';

const STUDENT_WITH_PERSON = 'matricule, person_id, core_persons(full_name)';

export async function loadGradeGapReportForClass(
  orgId: string,
  classId: string,
  periodId: string,
  academicYear: string,
  policyByLevel: GradingPeriodPolicyByLevel,
  includedExamTypes?: string[] | null
): Promise<GradeGapReport> {
  const supabase = await createClient();

  const { data: classRow } = await supabase
    .from('school_classes')
    .select('level, education_level_band')
    .eq('id', classId)
    .eq('organization_id', orgId)
    .maybeSingle();

  const classBand = parseEducationLevelBand(classRow?.education_level_band);
  const policy = resolveGradingPolicyForClass(
    policyByLevel,
    (classRow?.level as string) ?? null,
    classBand
  );

  const [{ data: students }, { data: subjects }, { data: evaluations }, { data: grades }] =
    await Promise.all([
      supabase
        .from('school_students')
        .select(STUDENT_WITH_PERSON)
        .eq('organization_id', orgId)
        .eq('class_id', classId)
        .eq('enrollment_status', 'enrolled'),
      supabase
        .from('school_subjects')
        .select('id, name, education_level_band')
        .eq('organization_id', orgId)
        .order('name'),
      supabase
        .from('school_grade_evaluations')
        .select('subject_id, exam_type, school_subjects(name)')
        .eq('organization_id', orgId)
        .eq('class_id', classId)
        .eq('semester', periodId)
        .eq('academic_year', academicYear),
      supabase
        .from('school_grades')
        .select('student_id, subject_id, exam_type, score')
        .eq('organization_id', orgId)
        .eq('class_id', classId)
        .eq('semester', periodId)
        .eq('academic_year', academicYear),
    ]);

  const evaluationRows = filterByIncludedExamTypes(
    (evaluations ?? []).map((e) => ({
      subjectId: e.subject_id as string,
      subjectName:
        ((e.school_subjects as { name?: string })?.name as string) ?? 'Matière',
      examType: e.exam_type as string,
    })),
    includedExamTypes
  );

  const scopedSubjects = (subjects ?? []).filter((s) =>
    subjectMatchesClassBand(
      parseEducationLevelBand(s.education_level_band),
      classBand,
      (classRow?.level as string) ?? null
    )
  );

  return buildGradeGapReport({
    classId,
    periodId,
    academicYear,
    policy,
    students: (students ?? []).map((s) => ({
      id: s.id as string,
      name: personName(s as Record<string, unknown>),
    })),
    subjects: scopedSubjects.map((s) => ({
      id: s.id as string,
      name: s.name as string,
    })),
    evaluations: evaluationRows,
    grades: filterByIncludedExamTypes(
      (grades ?? []).map((g) => ({
        studentId: g.student_id as string,
        subjectId: g.subject_id as string,
        examType: (g.exam_type as string) ?? 'default',
        score: g.score,
      })),
      includedExamTypes
    ),
  });
}
