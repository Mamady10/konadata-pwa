import { redirect } from 'next/navigation';
import { getClasses } from '@/lib/actions/school';
import { requireEtablissementPage } from '@/lib/school/require-etablissement-page';
import { getEtablissementCapabilities } from '@/lib/school/etablissement-access';
import { ImportElevesClient } from './import-client';
import { SchoolOnboardingPanel } from '@/components/school/school-onboarding-panel';
import { getStudentMatriculeSettings } from '@/lib/actions/student-matricules';

export default async function ImportElevesPage() {
  const session = await requireEtablissementPage('etudiants');
  const caps = getEtablissementCapabilities(session.profile?.role);
  if (!caps.manageStudents) {
    redirect('/etablissement/etudiants');
  }

  const orgId = session.profile?.organization_id;
  if (!orgId) redirect('/etablissement');

  let classes: Array<{ id: string; name: string; capacity?: number }> = [];
  try {
    const raw = await getClasses(orgId);
    classes = raw.map((c) => ({
      id: c.id as string,
      name: c.name as string,
      capacity: c.capacity != null ? Number(c.capacity) : undefined,
    }));
  } catch {
    /* schéma en attente */
  }

  const { settings: matriculeSettings } = await getStudentMatriculeSettings();

  return (
    <div className="space-y-6">
      <SchoolOnboardingPanel role={session.profile?.role} compact />
      <ImportElevesClient classes={classes} matriculeSettings={matriculeSettings} />
    </div>
  );
}
