import { redirect } from 'next/navigation';
import { getSession } from '@/lib/actions/auth';
import { createClient } from '@/lib/supabase/server';
import { resolvePostAuthDestination } from '@/lib/auth/post-auth-redirect';
import { learnerHasEnrollmentHistory } from '@/lib/auth/learner-enrollments';
import {
  isDirectorOnboardingPath,
  isDirectorOrStaffIntent,
  normalizeAccountIntent,
} from '@/lib/auth/account-intent';
import type { AppRole, Organization } from '@/types/database';
import { getOrgType } from '@/types/database';

/**
 * Point d'entrée fiable après connexion (évite le parcours candidat par erreur).
 */
export default async function MonEspacePage() {
  const session = await getSession();
  if (!session?.user) {
    redirect('/login');
  }

  const profile = session.profile;
  const accountIntent = session.user.user_metadata?.account_intent as string | undefined;

  const onboardingPath = (profile as { onboarding_path?: string })?.onboarding_path;
  if (
    (isDirectorOrStaffIntent(accountIntent) || isDirectorOnboardingPath(onboardingPath)) &&
    !profile?.organization_id
  ) {
    // Collaborateur → code d'accès ; directeur → finaliser l'organisation
    if (
      normalizeAccountIntent(accountIntent) === 'staff' ||
      normalizeAccountIntent(onboardingPath) === 'staff'
    ) {
      redirect('/rejoindre');
    }
    redirect('/register?mode=create');
  }

  const supabase = await createClient();
  const hasEnrollmentHistory = await learnerHasEnrollmentHistory(supabase, session.user.id);
  const org = profile?.organizations as Organization | null;

  redirect(
    resolvePostAuthDestination({
      organizationId: profile?.organization_id,
      role: profile?.role as AppRole | undefined,
      orgType: getOrgType(org),
      accountIntent,
      onboardingPath,
      hasEnrollmentHistory,
    })
  );
}
