'use server';

import { requireOrgId } from '@/lib/actions/org';
import { canManageAssignments } from '@/lib/actions/assignments';
import { getOrganizationAiQuotaStatus } from '@/lib/ai/quota/ai-quota';
import { createClient } from '@/lib/supabase/server';
import type { AiPlanTier } from '@/lib/ai/quota/types';

export type { AiQuotaStatus } from '@/lib/ai/quota/types';

export async function getMyOrganizationAiQuota() {
  const orgId = await requireOrgId();
  return getOrganizationAiQuotaStatus(orgId);
}

/** CEO : bonus crédits ou palier pour une organisation. */
export async function platformAdminSetAiQuota(params: {
  organizationId: string;
  tierOverride?: AiPlanTier | null;
  bonusCredits?: number;
  monthlyCreditsOverride?: number | null;
  ceoNotes?: string;
}): Promise<{ success: true } | { error: string }> {
  const ok = await canManageAssignments();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id)
    .maybeSingle();

  if (profile?.role !== 'platform_admin') {
    return { error: 'Réservé au CEO / plateforme KonaData.' };
  }

  const { error } = await supabase.from('organization_ai_quotas').upsert(
    {
      organization_id: params.organizationId,
      tier_override: params.tierOverride ?? null,
      bonus_credits: params.bonusCredits ?? 0,
      monthly_credits_override: params.monthlyCreditsOverride ?? null,
      ceo_notes: params.ceoNotes ?? null,
    },
    { onConflict: 'organization_id' }
  );

  if (error) return { error: error.message };
  return { success: true };
}
