import { createClient } from '@/lib/supabase/client';
import { resolvePostAuthDestination } from '@/lib/auth/post-auth-redirect';
import { learnerHasEnrollmentHistory } from '@/lib/auth/learner-enrollments';
import type { AppRole, OrganizationType } from '@/types/database';

/** Redirection après connexion / inscription par téléphone (session déjà ouverte). */
export async function redirectAfterPhoneAuth(redirectParam = ''): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return '/login';

  await supabase
    .from('profiles')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', user.id);

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role, onboarding_path, organizations(type)')
    .eq('id', user.id)
    .single();

  const orgType = (profile?.organizations as { type?: OrganizationType } | null)?.type;
  const hasEnrollmentHistory = await learnerHasEnrollmentHistory(supabase, user.id);

  return resolvePostAuthDestination({
    organizationId: profile?.organization_id,
    role: profile?.role as AppRole | undefined,
    orgType,
    accountIntent: user.user_metadata?.account_intent as string | undefined,
    onboardingPath: profile?.onboarding_path as string | undefined,
    redirectParam,
    hasEnrollmentHistory,
  });
}
