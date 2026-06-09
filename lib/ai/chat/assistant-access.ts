import type { AppRole } from '@/types/database';
import type { AiPlanTier } from '@/lib/ai/quota/types';
import { AI_PLAN_TIER_LABELS } from '@/lib/ai/quota/types';

export const ASSISTANT_DATA_LABEL = 'Assistant données';
export const KONAI_LABEL = 'KonaAI';

const DIRECTOR_ROLES = new Set<string>(['org_admin', 'deputy_director', 'platform_admin']);

export function isDirectorRole(role: AppRole | string | undefined): boolean {
  return role != null && DIRECTOR_ROLES.has(role);
}

/** Offre IA activée par le CEO (palier autre qu'Essentiel). */
export function isAiOfferActiveForWidget(tier: string | null | undefined): boolean {
  const t = tier?.trim().toLowerCase();
  if (!t || t === 'essentiel') return false;
  return true;
}

export function assistantDisplayName(llmAvailable: boolean): string {
  return llmAvailable ? KONAI_LABEL : ASSISTANT_DATA_LABEL;
}

export function aiOfferTierLabel(tier: string | null | undefined): string {
  if (!tier) return AI_PLAN_TIER_LABELS.essentiel;
  return AI_PLAN_TIER_LABELS[tier as AiPlanTier] ?? tier;
}

/** Lien sidebar + page /analyste-ia (directeur + offre IA ≠ Essentiel, ou CEO). */
export function isAssistantNavVisible(
  role: AppRole | string | undefined,
  aiOfferTier: string | null | undefined
): boolean {
  if (role === 'platform_admin') return true;
  if (!isDirectorRole(role)) return false;
  return isAiOfferActiveForWidget(aiOfferTier);
}

export const ASSISTANT_NAV_HREF = '/analyste-ia';
export const AI_MODELS_NAV_HREF = '/parametres/modeles';
