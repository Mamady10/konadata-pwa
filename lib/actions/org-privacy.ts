'use server';

import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/actions/auth';
import { requireOrgId } from '@/lib/actions/org';
import { CURRENT_DPA_VERSION, isDpaAcceptanceCurrent } from '@/lib/legal/dpa';
import { CURRENT_CGU_VERSION, isCguAcceptanceCurrent } from '@/lib/legal/cgu';
import { revalidatePath } from 'next/cache';

export type OrgPrivacySettings = {
  konaAiDisabled: boolean;
  dpaVersion: string | null;
  dpaAcceptedAt: string | null;
  dpaAcceptedBy: string | null;
  currentDpaVersion: string;
  dpaUpToDate: boolean;
  cguVersion: string | null;
  cguAcceptedAt: string | null;
  cguAcceptedBy: string | null;
  currentCguVersion: string;
  cguUpToDate: boolean;
};

function parsePrivacyRow(data: Record<string, unknown> | null): OrgPrivacySettings {
  const version = data?.dpa_version != null ? String(data.dpa_version) : null;
  return {
    konaAiDisabled: Boolean(data?.kona_ai_disabled),
    dpaVersion: version,
    dpaAcceptedAt: data?.dpa_accepted_at != null ? String(data.dpa_accepted_at) : null,
    dpaAcceptedBy: data?.dpa_accepted_by != null ? String(data.dpa_accepted_by) : null,
    currentDpaVersion: String(data?.current_dpa_version ?? CURRENT_DPA_VERSION),
    dpaUpToDate: isDpaAcceptanceCurrent(version),
    cguVersion: data?.cgu_version != null ? String(data.cgu_version) : null,
    cguAcceptedAt: data?.cgu_accepted_at != null ? String(data.cgu_accepted_at) : null,
    cguAcceptedBy: data?.cgu_accepted_by != null ? String(data.cgu_accepted_by) : null,
    currentCguVersion: String(data?.current_cgu_version ?? CURRENT_CGU_VERSION),
    cguUpToDate: isCguAcceptanceCurrent(
      data?.cgu_version != null ? String(data.cgu_version) : null
    ),
  };
}

export async function getOrganizationPrivacySettings(): Promise<
  OrgPrivacySettings | { error: string }
> {
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_organization_privacy_settings', {
    p_org_id: orgId,
  });

  if (error) {
    if (error.message.includes('does not exist')) {
      return {
        error:
          'Migration 055 requise (confidentialité / DPA). Exécutez supabase/migrations/055_organization_privacy_dpa.sql.',
      };
    }
    return { error: error.message };
  }

  if (data && typeof data === 'object' && 'error' in (data as object)) {
    return { error: String((data as { error: string }).error) };
  }

  return parsePrivacyRow(data as Record<string, unknown>);
}

export async function isOrganizationKonaAiDisabled(orgId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_organization_privacy_settings', {
    p_org_id: orgId,
  });
  if (error || !data || typeof data !== 'object' || 'error' in (data as object)) {
    return false;
  }
  return Boolean((data as { kona_ai_disabled?: boolean }).kona_ai_disabled);
}

function canManagePrivacy(role: string | undefined): boolean {
  return role === 'org_admin' || role === 'platform_admin' || role === 'deputy_director';
}

export async function setOrganizationKonaAiDisabled(
  disabled: boolean
): Promise<{ success: true; konaAiDisabled: boolean } | { error: string }> {
  const session = await getSession();
  if (!canManagePrivacy(session?.profile?.role)) {
    return { error: 'Réservé au directeur ou à la direction' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('set_organization_kona_ai_disabled', {
    p_disabled: disabled,
  });

  if (error) return { error: error.message };
  if (data && typeof data === 'object' && 'error' in (data as object)) {
    return { error: String((data as { error: string }).error) };
  }

  revalidatePath('/parametres');
  revalidatePath('/parametres/confidentialite');
  return {
    success: true,
    konaAiDisabled: Boolean((data as { kona_ai_disabled?: boolean })?.kona_ai_disabled),
  };
}

export async function acceptOrganizationDpa(): Promise<
  { success: true; dpaVersion: string } | { error: string }
> {
  const session = await getSession();
  if (!canManagePrivacy(session?.profile?.role)) {
    return { error: 'Réservé au directeur ou à la direction' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('accept_organization_dpa', {
    p_version: CURRENT_DPA_VERSION,
  });

  if (error) return { error: error.message };
  if (data && typeof data === 'object' && 'error' in (data as object)) {
    return { error: String((data as { error: string }).error) };
  }

  revalidatePath('/parametres');
  revalidatePath('/parametres/confidentialite');
  return {
    success: true,
    dpaVersion: String((data as { dpa_version?: string })?.dpa_version ?? CURRENT_DPA_VERSION),
  };
}
