'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { OrganizationType } from '@/types/database';
import { sectorHomeFromOrgType } from '@/lib/sector/post-login';
import { completeOrganizationRegistration } from '@/lib/actions/org-registration';
import { resolvePostAuthDestination } from '@/lib/auth/post-auth-redirect';
import { learnerHasEnrollmentHistory } from '@/lib/auth/learner-enrollments';
import type { AppRole } from '@/types/database';

async function resolvePostLoginPath(userId: string): Promise<string> {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, organizations(type, billing_status)')
    .eq('id', userId)
    .single();

  if (!profile?.organization_id) return '/rejoindre';

  const org = profile?.organizations as { type?: OrganizationType; billing_status?: string } | null;
  if (
    org?.billing_status === 'pending_payment' ||
    org?.billing_status === 'pending_renewal'
  ) {
    return '/parametres/facturation?blocked=1';
  }

  return sectorHomeFromOrgType(org?.type);
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  let redirectTo = (formData.get('redirect') as string) || '';

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase
      .from('profiles')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id);

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, role, onboarding_path, organizations(type, billing_status)')
      .eq('id', user.id)
      .single();
    const orgType = (profile?.organizations as { type?: OrganizationType } | null)?.type;
    const hasEnrollmentHistory = await learnerHasEnrollmentHistory(supabase, user.id);
    redirectTo = resolvePostAuthDestination({
      organizationId: profile?.organization_id,
      role: profile?.role as AppRole | undefined,
      orgType,
      accountIntent: user.user_metadata?.account_intent as string | undefined,
      onboardingPath: profile?.onboarding_path as string | undefined,
      redirectParam: redirectTo,
      hasEnrollmentHistory,
    });
  }

  revalidatePath('/', 'layout');
  redirect(redirectTo || '/dashboard');
}

export async function signUp(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const fullName = formData.get('full_name') as string;
  const organizationName = formData.get('organization') as string;
  const orgType = ((formData.get('organization_type') as string) || 'school') as OrganizationType;
  const joinOnly = formData.get('join_only') === 'true';
  const learnerOnly = formData.get('learner_only') === 'true';

  const nextPath = learnerOnly ? '/inscription-etablissement' : '/rejoindre';
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        account_intent: learnerOnly ? 'learner' : joinOnly ? 'staff' : 'director',
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(nextPath)}`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (joinOnly) {
    revalidatePath('/', 'layout');
    redirect('/rejoindre');
  }

  if (learnerOnly && data.user) {
    await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        role: 'candidate',
        organization_id: null,
      })
      .eq('id', data.user.id);
    revalidatePath('/', 'layout');
    redirect('/inscription-etablissement');
  }

  if (data.user && organizationName) {
    const orgResult = await completeOrganizationRegistration(formData);
    if ('error' in orgResult && orgResult.error) {
      return { error: orgResult.error };
    }
    if ('success' in orgResult && orgResult.success) {
      return { success: true, redirectTo: orgResult.redirectTo };
    }
  }

  revalidatePath('/', 'layout');
  return {
    error:
      'Compte créé mais organisation non enregistrée. Connectez-vous puis réessayez depuis Paramètres, ou contactez le support.',
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}

export async function resetPassword(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get('email') as string;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm?next=/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function getSession() {
  const { getCachedSession } = await import('@/lib/auth/cached-session');
  return getCachedSession();
}

export async function getOrganizations() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('organizations')
    .select('*')
    .eq('is_active', true)
    .order('name');
  return data ?? [];
}
