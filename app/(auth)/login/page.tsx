import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/actions/auth';
import { createClient } from '@/lib/supabase/server';
import { resolvePostAuthDestination } from '@/lib/auth/post-auth-redirect';
import { learnerHasEnrollmentHistory } from '@/lib/auth/learner-enrollments';
import type { AppRole } from '@/types/database';
import type { OrganizationType } from '@/types/database';
import LoginForm from './login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; switch?: string }>;
}) {
  const { redirect: redirectParam, switch: switchAccount } = await searchParams;
  const session = await getSession();

  if (session?.user && switchAccount === '1') {
    const supabase = await createClient();
    await supabase.auth.signOut();
    return (
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center">Chargement...</div>
        }
      >
        <LoginForm accountSwitched />
      </Suspense>
    );
  }

  if (session?.user) {
    const profile = session.profile;
    const supabase = await createClient();
    const hasEnrollmentHistory = await learnerHasEnrollmentHistory(
      supabase,
      session.user.id
    );
    redirect(
      resolvePostAuthDestination({
        organizationId: profile?.organization_id,
        role: profile?.role as AppRole | undefined,
        orgType: (profile?.organizations as { type?: OrganizationType } | null)?.type,
        accountIntent: session.user.user_metadata?.account_intent as string | undefined,
        onboardingPath: (profile as { onboarding_path?: string })?.onboarding_path,
        redirectParam: redirectParam ?? null,
        hasEnrollmentHistory,
      })
    );
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">Chargement...</div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
