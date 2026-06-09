import { getSession } from '@/lib/actions/auth';
import { redirect } from 'next/navigation';
import { PublicLanding } from '@/components/marketing/public-landing';
import { createClient } from '@/lib/supabase/server';
import { resolvePostAuthDestination } from '@/lib/auth/post-auth-redirect';
import { learnerHasEnrollmentHistory } from '@/lib/auth/learner-enrollments';
import type { AppRole, Organization } from '@/types/database';
import { getOrgType } from '@/types/database';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ accueil?: string }>;
}) {
  const { accueil } = await searchParams;
  const session = await getSession();

  if (session?.user && accueil !== '1') {
    const profile = session.profile;
    const supabase = await createClient();
    const hasEnrollmentHistory = await learnerHasEnrollmentHistory(
      supabase,
      session.user.id
    );
    const org = profile?.organizations as Organization | null;
    redirect(
      resolvePostAuthDestination({
        organizationId: profile?.organization_id,
        role: profile?.role as AppRole | undefined,
        orgType: getOrgType(org),
        accountIntent: session.user.user_metadata?.account_intent as string | undefined,
        onboardingPath: (profile as { onboarding_path?: string })?.onboarding_path,
        hasEnrollmentHistory,
      })
    );
  }

  return <PublicLanding showLoggedInHint={Boolean(session?.user)} />;
}
