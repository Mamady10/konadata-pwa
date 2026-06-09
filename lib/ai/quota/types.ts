export type AiPlanTier = 'essentiel' | 'trial' | 'standard' | 'premium' | 'platform';

export type AiQuotaStatus = {
  tier: string;
  tierLabel: string;
  period: string;
  monthlyCredits: number;
  bonusCredits: number;
  creditsTotal: number;
  creditsUsed: number;
  creditsRemaining: number;
  requestsToday: number;
  maxRequestsPerDay: number;
  visionEnabled: boolean;
  visionPagesUsed: number;
  visionPagesLimit: number;
  hardBlock: boolean;
  description: string | null;
};

export const AI_PLAN_TIER_LABELS: Record<AiPlanTier, string> = {
  essentiel: 'Essentiel (sans IA)',
  trial: 'Essai 30 jours',
  standard: 'Standard',
  premium: 'Premium',
  platform: 'Plateforme',
};
