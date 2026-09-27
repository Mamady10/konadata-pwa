import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/actions/auth';
import { createClient } from '@/lib/supabase/server';
import { resolvePostAuthDestination } from '@/lib/auth/post-auth-redirect';
import { learnerHasEnrollmentHistory } from '@/lib/auth/learner-enrollments';
import type { AppRole } from '@/types/database';
import type { OrganizationType } from '@/types/database';
import { isProfileAccessBlocked } from '@/lib/auth/profile-access';
import { isSyntheticPhoneEmail } from '@/lib/auth/phone-email';
import LoginForm from './login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; switch?: string; blocked?: string }>;
}) {
  const { redirect: redirectParam, switch: switchAccount, blocked } = await searchParams;
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
    if (isProfileAccessBlocked(profile?.is_active)) {
      const supabase = await createClient();
      await supabase.auth.signOut();
      return (
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center">Chargement...</div>
          }
        >
          <LoginForm accessBlocked />
        </Suspense>
      );
    }
    const supabase = await createClient();
    const hasEnrollmentHistory = await learnerHasEnrollmentHistory(
      supabase,
      session.user.id
    );
    const destination = resolvePostAuthDestination({
      organizationId: profile?.organization_id,
      role: profile?.role as AppRole | undefined,
      orgType: (profile?.organizations as { type?: OrganizationType } | null)?.type,
      accountIntent: session.user.user_metadata?.account_intent as string | undefined,
      onboardingPath: (profile as { onboarding_path?: string })?.onboarding_path,
      redirectParam: redirectParam ?? null,
      hasEnrollmentHistory,
    });

    // Inscription non terminée : on affiche quand même le formulaire pour pouvoir
    // se connecter avec un autre compte, au lieu de forcer la création d'organisation.
    const destinationPath = destination.split('?')[0];
    if (
      !profile?.organization_id &&
      profile?.role !== 'platform_admin' &&
      (destinationPath === '/register' || destinationPath === '/rejoindre')
    ) {
      const email = session.user.email ?? '';
      const phone = session.user.phone || (session.user.user_metadata?.phone as string | undefined);
      const label = isSyntheticPhoneEmail(email)
        ? phone || `+${email.split('@')[0]}`
        : email || phone || 'un compte';
      return (
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center">Chargement...</div>
          }
        >
          <LoginForm
            pendingSession={{
              label,
              continueHref: destination,
              continueLabel:
                destinationPath === '/register'
                  ? "Terminer la création de l'organisation"
                  : 'Rejoindre une organisation',
            }}
          />
        </Suspense>
      );
    }
    redirect(destination);
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">Chargement...</div>
      }
    >
      <LoginForm accessBlocked={blocked === '1'} />
    </Suspense>
  );
}
