import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/actions/auth';
import {
  creditsForOperation,
  type AiOperation,
} from '@/lib/ai/quota/credit-costs';
import { isOrganizationKonaAiDisabled } from '@/lib/actions/org-privacy';
import { AiQuotaExceededError } from '@/lib/ai/quota/errors';
import type { AiQuotaStatus } from '@/lib/ai/quota/types';
import { isDpaAcceptanceCurrent, CURRENT_DPA_VERSION } from '@/lib/legal/dpa';

export type { AiQuotaStatus } from '@/lib/ai/quota/types';

async function isQuotaBypass(): Promise<boolean> {
  const session = await getSession();
  return session?.profile?.role === 'platform_admin';
}

export async function getOrganizationAiQuotaStatus(
  orgId: string
): Promise<AiQuotaStatus | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_organization_ai_quota_status', {
    p_org_id: orgId,
  });

  if (error) return { error: error.message };
  if (data && typeof data === 'object' && 'error' in (data as object)) {
    return { error: String((data as { error: string }).error) };
  }

  const row = data as Record<string, unknown>;
  return {
    tier: String(row.tier ?? 'essentiel'),
    tierLabel: String(row.tier_label ?? '—'),
    period: String(row.period ?? ''),
    monthlyCredits: Number(row.monthly_credits ?? 0),
    bonusCredits: Number(row.bonus_credits ?? 0),
    creditsTotal: Number(row.credits_total ?? 0),
    creditsUsed: Number(row.credits_used ?? 0),
    creditsRemaining: Number(row.credits_remaining ?? 0),
    requestsToday: Number(row.requests_today ?? 0),
    maxRequestsPerDay: Number(row.max_requests_per_day ?? 0),
    visionEnabled: Boolean(row.vision_enabled),
    visionPagesUsed: Number(row.vision_pages_used ?? 0),
    visionPagesLimit: Number(row.vision_pages_limit ?? 0),
    hardBlock: row.hard_block !== false,
    description: row.description != null ? String(row.description) : null,
  };
}

async function getOrgPrivacyGate(
  orgId: string
): Promise<{ ok: true } | { error: string }> {
  if (await isOrganizationKonaAiDisabled(orgId)) {
    return {
      error:
        'KonaAI est désactivé pour votre organisation. Réactivez-le dans Paramètres → Confidentialité si nécessaire.',
    };
  }

  const supabase = await createClient();
  const { data } = await supabase.rpc('get_organization_privacy_settings', {
    p_org_id: orgId,
  });
  if (data && typeof data === 'object' && !('error' in (data as object))) {
    const version = (data as { dpa_version?: string }).dpa_version;
    if (!isDpaAcceptanceCurrent(version)) {
      return {
        error: `Acceptez le DPA KonaData (version ${CURRENT_DPA_VERSION}) dans Paramètres → Confidentialité avant d'utiliser KonaAI.`,
      };
    }
  }

  return { ok: true };
}

/** Vérifie le quota avant un appel OpenAI (sans consommer). */
export async function preCheckAiQuota(
  orgId: string,
  operation: AiOperation,
  options?: { visionPages?: number }
): Promise<{ ok: true } | { error: string }> {
  if (await isQuotaBypass()) return { ok: true };

  const privacyGate = await getOrgPrivacyGate(orgId);
  if ('error' in privacyGate) return privacyGate;

  const status = await getOrganizationAiQuotaStatus(orgId);
  if ('error' in status) return status;

  if (status.tier === 'platform') return { ok: true };

  const cost = creditsForOperation(operation, options);

  if (cost > 0 && status.creditsTotal === 0) {
    return {
      error:
        'Votre offre ne inclut pas KonaAI. Passez à Standard ou Premium, ou contactez KonaData.',
    };
  }

  if (operation === 'vision_page' && !status.visionEnabled) {
    return { error: 'L\'OCR manuscrit (Vision) n\'est pas inclus dans votre offre actuelle.' };
  }

  if (status.hardBlock && status.maxRequestsPerDay > 0 && status.requestsToday >= status.maxRequestsPerDay) {
    return {
      error: `Limite journalière atteinte (${status.maxRequestsPerDay} requêtes). Réessayez demain.`,
    };
  }

  const visionPages = options?.visionPages ?? (operation === 'vision_page' ? 1 : 0);
  if (
    status.hardBlock &&
    visionPages > 0 &&
    status.visionPagesLimit > 0 &&
    status.visionPagesUsed + visionPages > status.visionPagesLimit
  ) {
    return {
      error: `Quota pages Vision épuisé (${status.visionPagesUsed}/${status.visionPagesLimit} ce mois).`,
    };
  }

  if (status.hardBlock && cost > 0 && status.creditsRemaining < cost) {
    return {
      error: `Crédits KonaAI insuffisants (${status.creditsUsed}/${status.creditsTotal}). Renouvellement le mois prochain ou upgrade Premium.`,
    };
  }

  return { ok: true };
}

/** Débite les crédits après un appel OpenAI réussi. */
export async function chargeAiQuota(
  orgId: string,
  operation: AiOperation,
  options?: {
    profileId?: string;
    tokensIn?: number;
    tokensOut?: number;
    visionPages?: number;
  }
): Promise<void> {
  if (await isQuotaBypass()) return;

  const cost = creditsForOperation(operation, options);
  const visionPages =
    options?.visionPages ?? (operation === 'vision_page' ? 1 : 0);

  if (cost === 0 && visionPages === 0) return;

  const supabase = await createClient();
  const session = await getSession();
  const profileId = options?.profileId ?? session?.user?.id;

  const { data, error } = await supabase.rpc('consume_organization_ai_credits', {
    p_org_id: orgId,
    p_operation: operation,
    p_credits: cost,
    p_profile_id: profileId ?? null,
    p_tokens_in: options?.tokensIn ?? 0,
    p_tokens_out: options?.tokensOut ?? 0,
    p_vision_pages: visionPages,
  });

  if (error) {
    console.error('[chargeAiQuota]', error.message);
    return;
  }

  const result = data as { ok?: boolean; error?: string } | null;
  if (result && result.ok === false && result.error) {
    console.warn('[chargeAiQuota]', result.error);
  }
}

/** Pré-contrôle + message d'erreur pour les appels IA. */
export async function assertAiQuotaForCall(
  orgId: string | undefined,
  operation: AiOperation,
  options?: { visionPages?: number }
): Promise<void> {
  if (!orgId) return;
  const check = await preCheckAiQuota(orgId, operation, options);
  if ('error' in check) {
    throw new AiQuotaExceededError(check.error);
  }
}
