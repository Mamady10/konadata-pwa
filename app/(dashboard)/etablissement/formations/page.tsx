import { requireEtablissementPage } from '@/lib/school/require-etablissement-page';
import { getEtablissementCapabilities } from '@/lib/school/etablissement-access';

import {
  getClasses,
  getSubjects,
  getTeachers,
  getSchoolFinanceByClass,
  getOrgDefaultAcademicYear,
} from '@/lib/actions/school';

import { getMyTeachingAssignments } from '@/lib/actions/assignments';

import { canManageSchoolCatalog } from '@/lib/school/permissions';

import { FormationsClient } from './formations-client';
import { SchoolOnboardingPanel } from '@/components/school/school-onboarding-panel';

import { redirect } from 'next/navigation';



function filterByClasses<T extends { id: string }>(items: T[], allowed: string[] | null): T[] {

  if (allowed === null) return items;

  return items.filter((i) => allowed.includes(i.id));

}



export default async function FormationsPage() {
  const session = await requireEtablissementPage('formations');
  const caps = getEtablissementCapabilities(session.profile?.role);
  if (!session?.profile?.organization_id) redirect('/login');
  const orgId = session.profile.organization_id;
  const academicYear = await getOrgDefaultAcademicYear(orgId);

  const [teachingSlots, canManageCatalog] = await Promise.all([
    getMyTeachingAssignments(),
    canManageSchoolCatalog(),
  ]);

  const assignedClassIds =
    teachingSlots === null ? null : [...new Set(teachingSlots.map((s) => s.classId))];



  let classes: Record<string, unknown>[] = [];

  let subjects: Record<string, unknown>[] = [];

  let teachers: Record<string, unknown>[] = [];
  const loadErrors: string[] = [];

  try {
    const allClasses = await getClasses(orgId);
    classes = filterByClasses(
      allClasses as Array<Record<string, unknown> & { id: string }>,
      assignedClassIds
    );
  } catch (e) {
    loadErrors.push(e instanceof Error ? e.message : 'Impossible de charger les classes.');
  }

  if (canManageCatalog) {
    try {
      subjects = await getSubjects(orgId);
    } catch (e) {
      loadErrors.push(e instanceof Error ? e.message : 'Impossible de charger les matières.');
    }
    try {
      teachers = await getTeachers(orgId);
    } catch (e) {
      loadErrors.push(e instanceof Error ? e.message : 'Impossible de charger les enseignants.');
    }
  }



  const isTeacher = session.profile.role === 'teacher';
  let classOverview: Awaited<ReturnType<typeof getSchoolFinanceByClass>> | null = null;
  let orgDefaultTuitionGnf = 1_500_000;
  if (caps.viewFormationsReadOnly || canManageCatalog) {
    try {
      classOverview = await getSchoolFinanceByClass(orgId);
      orgDefaultTuitionGnf = classOverview.tuitionFeeGnf;
    } catch {
      /* */
    }
  }

  let teachingPairs: { className: string; subjectName: string }[] = [];
  if (isTeacher && teachingSlots && teachingSlots.length > 0) {
    try {
      const [allClasses, allSubjects] = await Promise.all([
        getClasses(orgId),
        getSubjects(orgId),
      ]);
      const classById = Object.fromEntries(allClasses.map((c) => [c.id, c.name as string]));
      const subById = Object.fromEntries(allSubjects.map((s) => [s.id, s.name as string]));
      teachingPairs = teachingSlots.map((s) => ({
        className: classById[s.classId] ?? 'Classe',
        subjectName: subById[s.subjectId] ?? 'Matière',
      }));
    } catch {
      /* */
    }
  }

  return (
    <div className="space-y-6">
      <SchoolOnboardingPanel role={session.profile?.role} compact />
      <FormationsClient
      classes={classes}
      subjects={subjects}
      teachers={teachers}
      canManageCatalog={canManageCatalog && !caps.viewFormationsReadOnly}
      readOnlyOverview={caps.viewFormationsReadOnly}
      classOverview={classOverview}
      isTeacher={isTeacher}
      hasAssignments={teachingSlots === null || (teachingSlots?.length ?? 0) > 0}
      teachingPairs={teachingPairs}
      orgDefaultTuitionGnf={orgDefaultTuitionGnf}
      academicYear={academicYear}
      loadErrors={loadErrors}
    />
    </div>
  );

}

