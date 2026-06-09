import { getStudents, getClasses } from '@/lib/actions/school';
import { getStudentsWithoutMatriculeSummary } from '@/lib/actions/student-matricules';
import { EtudiantsClient } from './etudiants-client';
import { redirect } from 'next/navigation';
import { requireEtablissementPage } from '@/lib/school/require-etablissement-page';
import { getEtablissementCapabilities } from '@/lib/school/etablissement-access';
import { SchoolOnboardingPanel } from '@/components/school/school-onboarding-panel';
import { AssignMatriculesPanel } from '@/components/school/assign-matricules-panel';

export default async function EtudiantsPage() {
  const session = await requireEtablissementPage('etudiants');
  const caps = getEtablissementCapabilities(session.profile?.role);
  const orgId = session.profile?.organization_id;
  if (!orgId) redirect('/etablissement');

  let students: Record<string, unknown>[] = [];
  let classes: { id: string; name: string }[] = [];
  const loadErrors: string[] = [];
  try {
    students = await getStudents(orgId);
  } catch (e) {
    loadErrors.push(e instanceof Error ? e.message : 'Impossible de charger les élèves.');
  }
  try {
    const cls = await getClasses(orgId);
    classes = cls.map((c) => ({ id: c.id as string, name: c.name as string }));
  } catch (e) {
    loadErrors.push(e instanceof Error ? e.message : 'Impossible de charger les classes.');
  }

  const matriculeSummary = caps.manageStudents
    ? await getStudentsWithoutMatriculeSummary()
    : { total: 0, assignable: 0, byClass: [] };
  const withoutMatriculeCount =
    matriculeSummary.total ||
    students.filter((s) => !(s.matricule as string | null)?.trim()).length;

  return (
    <div className="space-y-6">
      <SchoolOnboardingPanel role={session.profile?.role} compact />
      {caps.manageStudents && matriculeSummary.total > 0 && (
        <AssignMatriculesPanel
          total={matriculeSummary.total}
          assignable={matriculeSummary.assignable}
          byClass={matriculeSummary.byClass}
        />
      )}
      <EtudiantsClient
        students={students}
        classes={classes}
        canManage={caps.manageStudents}
        readOnly={caps.viewStudentsReadOnly}
        withoutMatriculeCount={withoutMatriculeCount}
        loadErrors={loadErrors}
      />
    </div>
  );
}
