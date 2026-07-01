import { redirect } from 'next/navigation';
import { requireEtablissementPage } from '@/lib/school/require-etablissement-page';
import { getEtablissementCapabilities } from '@/lib/school/etablissement-access';
import { getClasses, getSubjects, getStudents, getTeachers } from '@/lib/actions/school';
import { getClassSchedule } from '@/lib/actions/school-schedules';
import { listAttendanceSessions } from '@/lib/actions/school-attendance';
import { personName } from '@/lib/school/person-utils';
import { getSchoolAnnouncements } from '@/lib/actions/school-announcements';
import type { ScheduleSlotRow } from '@/lib/actions/school-schedules';
import type { AttendanceSessionSummary } from '@/lib/actions/school-attendance';
import { VieScolaireClient } from './vie-scolaire-client';

export default async function VieScolairePage() {
  const session = await requireEtablissementPage('vie-scolaire');
  const orgId = session.profile?.organization_id;
  if (!orgId) redirect('/etablissement');

  const caps = getEtablissementCapabilities(session.profile?.role);
  const canManage = caps.isDirector || session.profile?.role === 'registrar';

  let classes: Array<{ id: string; name: string }> = [];
  let subjects: Array<{ id: string; name: string }> = [];
  let teachers: Array<{ id: string; name: string }> = [];
  let students: Array<{ id: string; name: string; class_id: string | null; matricule: string | null }> = [];
  let initialSchedule: ScheduleSlotRow[] = [];
  let initialSessions: AttendanceSessionSummary[] = [];
  let initialAnnouncements: Awaited<ReturnType<typeof getSchoolAnnouncements>> = [];

  try {
    const [cls, sub, tch, stu, sess, announcements] = await Promise.all([
      getClasses(orgId),
      getSubjects(orgId),
      getTeachers(orgId),
      getStudents(orgId),
      listAttendanceSessions(),
      getSchoolAnnouncements(orgId),
    ]);
    classes = cls.map((c) => ({ id: c.id as string, name: c.name as string }));
    subjects = sub.map((s) => ({ id: s.id as string, name: s.name as string }));
    teachers = tch.map((t) => ({
      id: t.id as string,
      name: personName(t as Record<string, unknown>),
    }));
    students = stu.map((s) => ({
      id: s.id as string,
      name: personName(s as Record<string, unknown>),
      class_id: (s.class_id as string) || null,
      matricule: (s.matricule as string) || null,
    }));
    initialSessions = Array.isArray(sess) ? sess : [];
    initialAnnouncements = announcements;

    const firstClass = classes[0]?.id;
    if (firstClass) {
      const sched = await getClassSchedule(firstClass);
      initialSchedule = Array.isArray(sched) ? sched : [];
    }
  } catch {
    /* schema pending */
  }

  return (
    <VieScolaireClient
      classes={classes}
      subjects={subjects}
      teachers={teachers}
      students={students}
      initialClassId={classes[0]?.id ?? ''}
      initialSchedule={initialSchedule}
      initialSessions={initialSessions}
      initialAnnouncements={initialAnnouncements}
      canManage={canManage}
    />
  );
}
