'use server';

import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/actions/auth';
import { requireOrgId } from '@/lib/actions/org';
import { CURRENT_CGU_VERSION, isCguAcceptanceCurrent } from '@/lib/legal/cgu';
import { clearAuthzCache } from '@/lib/auth/clear-authz-cache';
import { revalidatePath } from 'next/cache';

function canManageLegal(role: string | undefined): boolean {
  return role === 'org_admin' || role === 'platform_admin' || role === 'deputy_director';
}

export async function acceptOrganizationCgu(): Promise<
  { success: true; cguVersion: string } | { error: string }
> {
  const session = await getSession();
  if (!canManageLegal(session?.profile?.role)) {
    return { error: 'Réservé au directeur ou à la direction' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('accept_organization_cgu', {
    p_version: CURRENT_CGU_VERSION,
  });

  if (error) {
    if (error.message.includes('does not exist')) {
      return { error: 'Migration 108 requise (CGU). Contactez le support KonaData.' };
    }
    return { error: error.message };
  }
  if (data && typeof data === 'object' && 'error' in (data as object)) {
    return { error: String((data as { error: string }).error) };
  }

  await clearAuthzCache();
  revalidatePath('/parametres');
  revalidatePath('/parametres/confidentialite');
  return {
    success: true,
    cguVersion: String((data as { cgu_version?: string })?.cgu_version ?? CURRENT_CGU_VERSION),
  };
}

export async function updateOrganizationName(
  name: string
): Promise<{ success: true; name: string } | { error: string }> {
  const session = await getSession();
  if (session?.profile?.role !== 'org_admin') {
    return { error: 'Réservé au directeur de l\'organisation' };
  }

  const trimmed = name.trim();
  if (!trimmed) return { error: 'Le nom ne peut pas être vide' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('org_admin_update_organization_name', {
    p_name: trimmed,
  });

  if (error) {
    if (error.message.includes('does not exist')) {
      return { error: 'Migration 108 requise (renommage). Contactez le support KonaData.' };
    }
    return { error: error.message };
  }
  if (data && typeof data === 'object' && 'error' in (data as object)) {
    return { error: String((data as { error: string }).error) };
  }

  revalidatePath('/parametres');
  revalidatePath('/dashboard');
  return { success: true, name: String((data as { name?: string })?.name ?? trimmed) };
}

export async function isOrganizationCguCurrent(orgId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_organization_privacy_settings', {
    p_org_id: orgId,
  });
  if (error || !data || typeof data !== 'object' || 'error' in (data as object)) {
    return false;
  }
  const version = (data as { cgu_version?: string }).cgu_version ?? null;
  return isCguAcceptanceCurrent(version);
}

export async function acceptOrganizationCguAfterRegistration(): Promise<void> {
  try {
    await requireOrgId();
    await acceptOrganizationCgu();
  } catch {
    /* registration may proceed; user can accept later */
  }
}
