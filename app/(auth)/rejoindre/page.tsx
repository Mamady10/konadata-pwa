import { getSession } from '@/lib/actions/auth';
import { redirect } from 'next/navigation';
import { RejoindreClient } from './rejoindre-client';
import { sectorFromOrgType, getOrgType } from '@/types/database';
import type { Organization } from '@/types/database';
import {
  isDirectorOnboardingPath,
  isDirectorOrStaffIntent,
  normalizeAccountIntent,
} from '@/lib/auth/account-intent';
import { LANDING_LINKS } from '@/lib/marketing/landing-links';

const SECTOR_HOME: Record<string, string> = {
  etablissement: '/etablissement',
  ong: '/ong',
  btp: '/btp',
  pme: '/pme',
};

export default async function RejoindrePage({
  searchParams,
}: {
  searchParams: Promise<{ profil?: string }>;
}) {
  const session = await getSession();
  const { profil } = await searchParams;

  if (session?.profile?.role === 'platform_admin') {
    redirect('/dashboard');
  }

  if (session?.profile?.organization_id) {
    const org = session.profile.organizations as Organization | null;
    const sector = sectorFromOrgType(getOrgType(org));
    redirect(SECTOR_HOME[sector] ?? '/dashboard');
  }

  const accountIntent = session?.user?.user_metadata?.account_intent as string | undefined;
  const onboardingPath = (session?.profile as { onboarding_path?: string } | null)?.onboarding_path;
  const intent = normalizeAccountIntent(accountIntent);
  const path = normalizeAccountIntent(onboardingPath);
  const wantsDirector =
    profil === 'directeur' ||
    intent === 'director' ||
    path === 'director' ||
    (isDirectorOrStaffIntent(accountIntent) && intent !== 'staff') ||
    (isDirectorOnboardingPath(onboardingPath) && path !== 'staff');

  // Directeur connecté sans organisation → finaliser le dossier (pas le code staff).
  if (session?.user && !session.profile?.organization_id && wantsDirector) {
    redirect(LANDING_LINKS.registerOrganization);
  }

  return (
    <RejoindreClient
      isLoggedIn={Boolean(session)}
      userEmail={session?.profile?.email ?? session?.user?.email}
      showDirectorEscape={Boolean(session?.user && !session.profile?.organization_id)}
    />
  );
}
