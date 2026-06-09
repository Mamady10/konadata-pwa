import { redirect } from 'next/navigation';
import { getSession } from '@/lib/actions/auth';
import { getMepsSettings } from '@/lib/actions/school-settings';
import { getEtablissementCapabilities } from '@/lib/school/etablissement-access';
import { MepsSettingsClient } from './meps-client';

export default async function MepsSettingsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const caps = getEtablissementCapabilities(session.profile?.role);
  if (!caps.isDirector) redirect('/parametres');

  const { settings, orgName, error } = await getMepsSettings();
  if (error && error.includes('Réservé')) redirect('/parametres');

  return (
    <MepsSettingsClient initialSettings={settings} orgName={orgName} loadError={error} />
  );
}
