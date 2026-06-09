'use server';

import { createClient } from '@/lib/supabase/server';
import { requireOrgId } from '@/lib/actions/org';
import { getEtablissementCapabilities } from '@/lib/school/etablissement-access';
import { getSession } from '@/lib/actions/auth';
import {
  buildMepsCsv,
  computePassRatePct,
  normalizeGender,
  type MepsExportMeta,
  type MepsExportRow,
} from '@/lib/school/meps-export';
import { parseMepsSettings } from '@/lib/school/meps-settings';
import { parseSchoolOrgSettings } from '@/lib/school/school-org-settings';

export async function exportMepsSchoolStats(academicYear?: string): Promise<
  | { csv: string; fileName: string; rowCount: number }
  | { error: string }
> {
  const session = await getSession();
  const caps = getEtablissementCapabilities(session?.profile?.role);
  if (!caps.isDirector && session?.profile?.role !== 'registrar' && session?.profile?.role !== 'accountant') {
    return { error: 'Accès réservé à la direction, scolarité ou comptabilité.' };
  }

  const orgId = await requireOrgId();
  const supabase = await createClient();

  const { data: org } = await supabase
    .from('organizations')
    .select('name, settings, address')
    .eq('id', orgId)
    .single();

  const year =
    academicYear?.trim() ||
    parseSchoolOrgSettings((org?.settings as Record<string, unknown>) ?? null)
      .default_academic_year;

  const mepsSettings = parseMepsSettings(
    (org?.settings as Record<string, unknown>) ?? null,
    (org?.address as string) ?? null
  );

  const { data: classes } = await supabase
    .from('school_classes')
    .select('id, name, academic_year')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .order('name');

  const { data: students } = await supabase
    .from('school_students')
    .select('id, class_id, enrollment_status, core_persons(gender)')
    .eq('organization_id', orgId)
    .eq('enrollment_status', 'enrolled');

  const { data: grades } = await supabase
    .from('school_grades')
    .select('student_id, class_id, score')
    .eq('organization_id', orgId)
    .eq('academic_year', year);

  const { data: reportCards } = await supabase
    .from('school_report_cards')
    .select('class_id, publication_status, average_score')
    .eq('organization_id', orgId)
    .eq('academic_year', year);

  const { data: payments } = await supabase
    .from('school_payments')
    .select('amount, student_id')
    .eq('organization_id', orgId)
    .eq('status', 'paid');

  const { data: teaching } = await supabase
    .from('school_teaching_assignments')
    .select('class_id, profile_id')
    .eq('organization_id', orgId);

  const teachersByClass = new Map<string, Set<string>>();
  for (const row of teaching ?? []) {
    const classId = row.class_id as string;
    const profileId = row.profile_id as string;
    if (!teachersByClass.has(classId)) teachersByClass.set(classId, new Set());
    teachersByClass.get(classId)!.add(profileId);
  }

  const studentClassMap = new Map(
    (students ?? []).map((s) => [s.id as string, s.class_id as string | null])
  );

  const { data: sessions } = await supabase
    .from('school_attendance_sessions')
    .select('id, class_id')
    .eq('organization_id', orgId);

  const sessionIds = (sessions ?? []).map((s) => s.id as string);
  let attendanceRecords: Array<{ session_id: string; student_id: string; status: string }> = [];
  if (sessionIds.length) {
    const { data: recs } = await supabase
      .from('school_attendance_records')
      .select('session_id, student_id, status')
      .eq('organization_id', orgId)
      .in('session_id', sessionIds);
    attendanceRecords = recs ?? [];
  }

  let totalMale = 0;
  let totalFemale = 0;
  for (const st of students ?? []) {
    const person = (st.core_persons ?? {}) as { gender?: string };
    const g = normalizeGender(person.gender);
    if (g === 'M') totalMale++;
    else if (g === 'F') totalFemale++;
  }

  const rows: MepsExportRow[] = [];
  let rowNumber = 0;

  for (const cls of classes ?? []) {
    rowNumber += 1;
    const classId = cls.id as string;
    const classStudents = (students ?? []).filter((s) => s.class_id === classId);
    let male = 0;
    let female = 0;
    let unknown = 0;
    for (const st of classStudents) {
      const person = (st.core_persons ?? {}) as { gender?: string };
      const g = normalizeGender(person.gender);
      if (g === 'M') male++;
      else if (g === 'F') female++;
      else unknown++;
    }

    const classGrades = (grades ?? []).filter((g) => g.class_id === classId);
    const studentsWithGrades = new Set(classGrades.map((g) => g.student_id as string)).size;
    const avg =
      classGrades.length > 0
        ? (
            classGrades.reduce((sum, g) => sum + Number(g.score ?? 0), 0) / classGrades.length
          ).toFixed(2)
        : '—';

    const classSessionIds = (sessions ?? [])
      .filter((s) => s.class_id === classId)
      .map((s) => s.id as string);
    const classRecs = attendanceRecords.filter((r) =>
      classSessionIds.includes(r.session_id)
    );
    const present = classRecs.filter((r) => r.status === 'present' || r.status === 'late').length;
    const totalRecs = classRecs.length;
    const attendancePct =
      totalRecs > 0 ? String(Math.round((present / totalRecs) * 100)) : '—';

    const collected = (payments ?? [])
      .filter((p) => studentClassMap.get(p.student_id as string) === classId)
      .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);

    const classReportCards = (reportCards ?? []).filter((rc) => rc.class_id === classId);
    const bulletinsFinal = classReportCards.filter(
      (rc) => rc.publication_status === 'final'
    ).length;

    rows.push({
      row_number: rowNumber,
      academic_year: (cls.academic_year as string) || year,
      education_level: mepsSettings.education_level,
      class_name: cls.name as string,
      enrolled_total: classStudents.length,
      enrolled_male: male,
      enrolled_female: female,
      enrolled_unknown_gender: unknown,
      teachers_count: teachersByClass.get(classId)?.size ?? 0,
      students_with_grades: studentsWithGrades,
      class_average: avg,
      pass_rate_pct: computePassRatePct(classReportCards),
      attendance_sessions: classSessionIds.length,
      attendance_rate_pct: attendancePct,
      tuition_collected_gnf: Math.round(collected),
      bulletins_final: bulletinsFinal,
    });
  }

  const orgName = (org?.name as string) || 'etablissement';
  const safeName = orgName.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 30);

  const meta: MepsExportMeta = {
    org_name: orgName,
    academic_year: year,
    export_date: new Date().toISOString().slice(0, 10),
    meps: mepsSettings,
    total_enrolled: students?.length ?? 0,
    total_male: totalMale,
    total_female: totalFemale,
  };

  return {
    csv: buildMepsCsv(rows, meta),
    fileName: `export_meps_${safeName}_${year}.csv`,
    rowCount: rows.length,
  };
}
