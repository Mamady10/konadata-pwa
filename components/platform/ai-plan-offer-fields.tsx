'use client';

import { useEffect, useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  AI_PLAN_DEFAULTS,
  SELECTABLE_AI_PLAN_TIERS,
  getAiPlanDefaults,
  resolveAiTierForAccessMode,
  type SelectableAiPlanTier,
} from '@/lib/ai/quota/plan-defaults';
import { Bot, Eye } from 'lucide-react';
import {
  PLATFORM_V1_AI_OFFERS_ENABLED,
  PLATFORM_V1_DEFAULT_AI_TIER,
  PLATFORM_V1_DEFAULT_AI_CREDITS,
  PLATFORM_V1_DEFAULT_AI_REQUESTS_PER_DAY,
} from '@/lib/platform/v1-product';

interface Props {
  orgType: string;
  trialMode: boolean;
  initialTier?: string | null;
  initialCredits?: number | null;
  initialRequests?: number | null;
  requestedTier?: string | null;
  requestedCredits?: number | null;
  requestedRequests?: number | null;
}

export function AiPlanOfferFields({
  orgType,
  trialMode,
  initialTier,
  initialCredits,
  initialRequests,
  requestedTier,
  requestedCredits,
  requestedRequests,
}: Props) {
  const allowTrial = orgType === 'school';
  const tiers = useMemo(
    () => SELECTABLE_AI_PLAN_TIERS.filter((t) => allowTrial || t !== 'trial'),
    [allowTrial]
  );

  const defaultTier = (initialTier && tiers.includes(initialTier as SelectableAiPlanTier)
    ? initialTier
    : requestedTier && tiers.includes(requestedTier as SelectableAiPlanTier)
      ? requestedTier
      : 'standard') as SelectableAiPlanTier;

  if (!PLATFORM_V1_AI_OFFERS_ENABLED) {
    return (
      <div className="sm:col-span-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground flex items-center gap-2">
          <Bot className="h-4 w-4 text-slate-500" />
          KonaAI — non proposé en V1
        </p>
        <p className="mt-1 text-xs">
          Palier <strong>Essentiel (sans IA)</strong> appliqué automatiquement. Standard et Premium
          seront réactivés avec la commercialisation de l&apos;assistant.
        </p>
        <input type="hidden" name="ai_plan_tier" value={PLATFORM_V1_DEFAULT_AI_TIER} />
        <input type="hidden" name="ai_monthly_credits" value={PLATFORM_V1_DEFAULT_AI_CREDITS} />
        <input
          type="hidden"
          name="ai_max_requests_per_day"
          value={PLATFORM_V1_DEFAULT_AI_REQUESTS_PER_DAY}
        />
      </div>
    );
  }

  const [tier, setTier] = useState<SelectableAiPlanTier>(defaultTier);
  const effectiveTier = resolveAiTierForAccessMode(
    trialMode ? 'trial_30d' : 'annual',
    tier
  );
  const plan =
    effectiveTier === 'essentiel'
      ? AI_PLAN_DEFAULTS.standard
      : getAiPlanDefaults(effectiveTier);

  const [credits, setCredits] = useState(
    String(initialCredits ?? requestedCredits ?? plan.monthlyCredits)
  );
  const [requests, setRequests] = useState(
    String(initialRequests ?? requestedRequests ?? plan.maxRequestsPerDay)
  );

  useEffect(() => {
    if (trialMode) {
      const t = AI_PLAN_DEFAULTS.trial;
      setCredits(String(t.monthlyCredits));
      setRequests(String(t.maxRequestsPerDay));
      return;
    }
    const p = getAiPlanDefaults(tier);
    setCredits(String(initialCredits ?? requestedCredits ?? p.monthlyCredits));
    setRequests(String(initialRequests ?? requestedRequests ?? p.maxRequestsPerDay));
  }, [tier, trialMode, initialCredits, initialRequests, requestedCredits, requestedRequests]);

  function onTierChange(next: SelectableAiPlanTier) {
    setTier(next);
    const p = getAiPlanDefaults(next);
    setCredits(String(p.monthlyCredits));
    setRequests(String(p.maxRequestsPerDay));
  }

  return (
    <div className="sm:col-span-3 space-y-3 rounded-lg border border-violet-500/30 bg-violet-500/[0.03] p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm font-medium flex items-center gap-2">
          <Bot className="h-4 w-4 text-violet-600" />
          Abonnement KonaAI
        </p>
        {requestedTier && (
          <Badge variant="outline" className="text-xs">
            Demandé : {getAiPlanDefaults(requestedTier).label}
            {requestedCredits != null && ` · ${requestedCredits} cr.`}
          </Badge>
        )}
      </div>

      {trialMode ? (
        <p className="text-xs text-muted-foreground">
          Essai 30 jours → palier <strong>Trial</strong> ({AI_PLAN_DEFAULTS.trial.monthlyCredits}{' '}
          crédits, {AI_PLAN_DEFAULTS.trial.maxRequestsPerDay} req./jour).
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tiers.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTierChange(t)}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                tier === t
                  ? 'border-violet-500 bg-violet-500/15 text-violet-800'
                  : 'border-input hover:bg-muted/60'
              }`}
            >
              {AI_PLAN_DEFAULTS[t].label}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="ai_monthly_credits">Crédits KonaAI / mois</Label>
          <Input
            id="ai_monthly_credits"
            type="number"
            min={0}
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
            disabled={trialMode}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ai_max_requests_per_day">Requêtes max / jour</Label>
          <Input
            id="ai_max_requests_per_day"
            type="number"
            min={0}
            value={requests}
            onChange={(e) => setRequests(e.target.value)}
            disabled={trialMode}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Eye className="h-3 w-3" />
        Vision OCR : {plan.visionEnabled ? `${plan.visionPagesMonth} pages/mois` : 'non inclus'} —
        appliqué à l&apos;activation (paiement ou essai).
      </p>

      <input
        type="hidden"
        name="ai_plan_tier"
        value={trialMode ? 'trial' : tier}
      />
      <input type="hidden" name="ai_monthly_credits" value={credits} />
      <input type="hidden" name="ai_max_requests_per_day" value={requests} />
    </div>
  );
}
