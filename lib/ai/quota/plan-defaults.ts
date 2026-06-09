import type { AiPlanTier } from '@/lib/ai/quota/types';
import {
  PLATFORM_V1_AI_OFFERS_ENABLED,
  PLATFORM_V1_DEFAULT_AI_TIER,
} from '@/lib/platform/v1-product';

export type SelectableAiPlanTier = Exclude<AiPlanTier, 'platform' | 'essentiel'>;

export type AiPlanDefaults = {
  tier: SelectableAiPlanTier;
  label: string;
  monthlyCredits: number;
  maxRequestsPerDay: number;
  visionEnabled: boolean;
  visionPagesMonth: number;
  description: string;
};

/** Valeurs alignées sur platform_ai_plan_limits (migration 053). */
export const AI_PLAN_DEFAULTS: Record<SelectableAiPlanTier, AiPlanDefaults> = {
  trial: {
    tier: 'trial',
    label: 'Essai 30 jours',
    monthlyCredits: 150,
    maxRequestsPerDay: 30,
    visionEnabled: true,
    visionPagesMonth: 15,
    description: 'Découverte KonaAI : chat, quelques OCR et rapports.',
  },
  standard: {
    tier: 'standard',
    label: 'Standard',
    monthlyCredits: 800,
    maxRequestsPerDay: 80,
    visionEnabled: true,
    visionPagesMonth: 40,
    description: 'Usage courant : chat, rapports, scans enseignants.',
  },
  premium: {
    tier: 'premium',
    label: 'Premium',
    monthlyCredits: 3000,
    maxRequestsPerDay: 200,
    visionEnabled: true,
    visionPagesMonth: 150,
    description: 'Établissements actifs : bulletins scan, rapports, Data Factory.',
  },
};

export const SELECTABLE_AI_PLAN_TIERS: SelectableAiPlanTier[] = PLATFORM_V1_AI_OFFERS_ENABLED
  ? ['standard', 'premium', 'trial']
  : [];

export function getAiPlanDefaults(tier: string): AiPlanDefaults {
  const key = tier as SelectableAiPlanTier;
  if (AI_PLAN_DEFAULTS[key]) return AI_PLAN_DEFAULTS[key];
  if (tier === PLATFORM_V1_DEFAULT_AI_TIER || !PLATFORM_V1_AI_OFFERS_ENABLED) {
    return {
      tier: 'standard',
      label: 'Essentiel (sans IA)',
      monthlyCredits: 0,
      maxRequestsPerDay: 0,
      visionEnabled: false,
      visionPagesMonth: 0,
      description: 'Plateforme V1 — gestion métier sans assistant KonaAI.',
    };
  }
  return AI_PLAN_DEFAULTS.standard;
}

export function resolveAiTierForAccessMode(
  accessMode: 'annual' | 'trial_30d',
  selectedTier: SelectableAiPlanTier
): SelectableAiPlanTier | 'essentiel' {
  if (accessMode === 'trial_30d') return 'trial';
  return selectedTier;
}
