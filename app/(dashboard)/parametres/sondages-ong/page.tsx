import { redirect } from 'next/navigation';
import { getSession } from '@/lib/actions/auth';
import { getNgoSurveySettings } from '@/lib/actions/ngo-survey-settings';
import { SondagesOngSettingsClient } from './sondages-ong-client';
import { getOrgType } from '@/types/database';
import type { Organization } from '@/types/database';

function canManage(role: string | undefined): boolean {
  return role === 'org_admin' || role === 'platform_admin' || role === 'deputy_director';
}

export default async function SondagesOngSettingsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const org = session.profile?.organizations as Organization | null;
  if (getOrgType(org) !== 'ngo') redirect('/parametres');
  if (!canManage(session.profile?.role)) redirect('/parametres');

  const { settings, error } = await getNgoSurveySettings();

  return (
    <SondagesOngSettingsClient
      initialSettings={settings}
      loadError={error}
      orgName={org?.name ?? 'ONG'}
    />
  );
}
