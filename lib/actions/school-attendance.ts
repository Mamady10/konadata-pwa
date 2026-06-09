'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireOrgId } from '@/lib/actions/org';
import { getSession } from '@/lib/actions/auth';
import { getEtablissementCapabilities } from '@/lib/school/etablissement-access';
import { personName } from '@/lib/school/person-utils';

export interface AttendanceSessionSummary {
  id: string;
  class_id: string;
  class_name: string;
  session_date: string;
  subject_name: string | null;
  present_count: number;
  absent_count: number;
  source: string;
}

export interface AttendanceRecordRow {
  student_id: string;
  student_name: string;
  matricule: string | null;
  status: 'present' | 'absent' | 'late' | 'excused';
  remark: string | null;
}

async function assertCanManageAttendance() {
  const session = await getSession();
  const caps = getEtablissementCapabilities(session?.profile?.role);
  if (!caps.isDirector && session?.profile?.role !== 'registrar') {
    return { error: 'Réservé à la direction ou la scolarité.' } as const;
  }
  return { ok: true as const, session };
}

export async function listAttendanceSessions(classId?: string): Promise<
  AttendanceSessionSummary[] | { error: string }
> {
  const orgId = await requireOrgId();
  const supabase = await createClient();

  let query = supabase
    .from('school_attendance_sessions')
    .select(
      `id, class_id, session_date, source, school_classes(name), school_subjects(name),
       school_attendance_records(status)`
    )
    .eq('organization_id', orgId)
    .order('session_date', { ascending: false })
    .limit(50);

  if (classId?.trim()) query = query.eq('class_id', classId);

  const { data, error } = await query;
  if (error) return { error: error.message };

  return (data ?? []).map((s) => {
    const recs = (s.school_attendance_records ?? []) as Array<{ status: string }>;
    const present = recs.filter((r) => r.status === 'present' || r.status === 'late').length;
    const absent = recs.filter((r) => r.status === 'absent').length;
    return {
      id: s.id as string,
      class_id: s.class_id as string,
      class_name: (s.school_classes as { name?: string })?.name ?? '—',
      session_date: s.session_date as string,
      subject_name: (s.school_subjects as { name?: string } | null)?.name ?? null,
      present_count: present,
      absent_count: absent,
      source: s.source as string,
    };
  });
}

export async function getAttendanceSessionRecords(
  sessionId: string
): Promise<AttendanceRecordRow[] | { error: string }> {
  const orgId = await requireOrgId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('school_attendance_records')
    .select(
      `student_id, status, remark, school_students(matricule, core_persons(full_name))`
    )
    .eq('organization_id', orgId)
    .eq('session_id', sessionId)
    .order('created_at');

  if (error) return { error: error.message };

  return (data ?? []).map((r) => {
    const st = (r.school_students ?? {}) as unknown as Record<string, unknown>;
    return {
      student_id: r.student_id as string,
      student_name: personName(st),
      matricule: (st.matricule as string) ?? null,
      status: r.status as AttendanceRecordRow['status'],
      remark: (r.remark as string) ?? null,
    };
  });
}

export async function createAttendanceSession(input: {
  classId: string;
  sessionDate: string;
  subjectId?: string | null;
  notes?: string;
  records: Array<{
    studentId: string;
    status: 'present' | 'absent' | 'late' | 'excused';
    remark?: string;
  }>;
  source?: 'manual' | 'capture';
  documentId?: string;
}) {
  const guard = await assertCanManageAttendance();
  if ('error' in guard) return guard;

  const orgId = await requireOrgId();
  const supabase = await createClient();
  const profileId = guard.session?.profile?.id ?? null;

  const { data: session, error: sessErr } = await supabase
    .from('school_attendance_sessions')
    .insert({
      organization_id: orgId,
      class_id: input.classId,
      session_date: input.sessionDate,
      subject_id: input.subjectId || null,
      notes: input.notes?.trim() || null,
      source: input.source ?? 'manual',
      document_id: input.documentId || null,
      created_by: profileId,
    })
    .select('id')
    .single();

  if (sessErr || !session?.id) {
    return { error: sessErr?.message ?? 'Création de séance impossible.' };
  }

  const rows = input.records.map((r) => ({
    session_id: session.id,
    organization_id: orgId,
    student_id: r.studentId,
    status: r.status,
    remark: r.remark?.trim() || null,
  }));

  if (rows.length) {
    const { error: recErr } = await supabase.from('school_attendance_records').insert(rows);
    if (recErr) return { error: recErr.message };
  }

  revalidatePath('/etablissement/vie-scolaire');
  revalidatePath('/etablissement/rapports');
  return {
    success: true,
    sessionId: session.id as string,
    saved: rows.length,
  };
}

/** Persiste une liste capture (person_rows) vers les tables présences. */
export async function persistCaptureAttendance(params: {
  orgId: string;
  classId: string;
  documentId: string;
  sessionDate: string | null;
  rows: Array<{
    full_name: string;
    identifier?: string;
    present?: string;
    absent?: string;
    remark?: string;
  }>;
}): Promise<{ saved: number; present: number; absent: number } | { error: string }> {
  const supabase = await createClient();

  const { data: students } = await supabase
    .from('school_students')
    .select('id, matricule, core_persons(full_name)')
    .eq('organization_id', params.orgId)
    .eq('class_id', params.classId)
    .eq('enrollment_status', 'enrolled');

  const byMatricule = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const s of students ?? []) {
    const m = (s.matricule as string)?.trim().toUpperCase();
    if (m) byMatricule.set(m, s.id as string);
    const person = (s.core_persons ?? {}) as { full_name?: string };
    if (person.full_name) {
      byName.set(
        person.full_name
          .normalize('NFD')
          .replace(/\p{Diacritic}/gu, '')
          .toUpperCase()
          .trim(),
        s.id as string
      );
    }
  }

  const records: Array<{
    studentId: string;
    status: 'present' | 'absent' | 'late' | 'excused';
    remark?: string;
  }> = [];

  let present = 0;
  let absent = 0;

  for (const r of params.rows) {
    if (!r.full_name?.trim()) continue;
    const matKey = r.identifier?.trim().toUpperCase();
    const nameKey = r.full_name
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toUpperCase()
      .trim();
    const studentId =
      (matKey && byMatricule.get(matKey)) || byName.get(nameKey) || null;
    if (!studentId) continue;

    const p = (r.present ?? '').toLowerCase();
    const a = (r.absent ?? '').toLowerCase();
    const isPresent = p === 'oui' || p === 'x' || p === '1' || p === 'p' || p === 'present';
    const isAbsent = a === 'oui' || a === 'x' || a === '1' || a === 'a' || a === 'absent';
    const status: 'present' | 'absent' = isAbsent && !isPresent ? 'absent' : 'present';
    if (status === 'present') present++;
    else absent++;

    records.push({
      studentId,
      status,
      remark: r.remark?.trim(),
    });
  }

  if (!records.length) {
    return { error: 'Aucun élève de la classe reconnu sur ce registre.' };
  }

  const date =
    params.sessionDate?.trim() ||
    new Date().toISOString().slice(0, 10);

  const result = await createAttendanceSession({
    classId: params.classId,
    sessionDate: date,
    records,
    source: 'capture',
    documentId: params.documentId,
  });

  if ('error' in result && result.error) return { error: result.error };
  return { saved: records.length, present, absent };
}
