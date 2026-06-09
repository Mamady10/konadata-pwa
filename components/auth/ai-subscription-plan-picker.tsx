'use client';

import { useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  AI_PLAN_DEFAULTS,
  SELECTABLE_AI_PLAN_TIERS,
  type SelectableAiPlanTier,
} from '@/lib/ai/quota/plan-defaults';
import { Bot, Eye, Zap } from 'lucide-react';

interface Props {
  /** Masquer l'essai (ex. BTP / ONG sans essai 30j). */
  allowTrial?: boolean;
  defaultTier?: SelectableAiPlanTier;
}

export function AiSubscriptionPlanPicker({
  allowTrial = true,
  defaultTier = 'standard',
}: Props) {
  const tiers = useMemo(
    () =>
      SELECTABLE_AI_PLAN_TIERS.filter((t) => allowTrial || t !== 'trial'),
    [allowTrial]
  );
  const initial = tiers.includes(defaultTier) ? defaultTier : tiers[0];
  const [tier, setTier] = useState<SelectableAiPlanTier>(initial);
  const plan = AI_PLAN_DEFAULTS[tier];

  return (
    <div className="space-y-3 rounded-lg border border-violet-500/25 bg-violet-500/[0.03] p-4">
      <div className="flex items-center gap-2">
        <Bot className="h-4 w-4 text-violet-600" />
        <p className="text-sm font-medium">Offre KonaAI souhaitée</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Choisissez le palier IA. KonaData validera crédits et requêtes à l&apos;activation.
      </p>

      <div className="grid gap-2 sm:grid-cols-3">
        {tiers.map((t) => {
          const p = AI_PLAN_DEFAULTS[t];
          const selected = tier === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTier(t)}
              className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                selected
                  ? 'border-violet-500 bg-violet-500/10 ring-1 ring-violet-500/40'
                  : 'border-input hover:bg-muted/50'
              }`}
            >
              <span className="font-semibold block">{p.label}</span>
              <span className="text-xs text-muted-foreground mt-1 block">
                {p.monthlyCredits} crédits/mois
              </span>
              <span className="text-xs text-muted-foreground block">
                {p.maxRequestsPerDay} req./jour
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-md bg-background/80 border p-3 text-xs space-y-2">
        <p className="text-muted-foreground">{plan.description}</p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="gap-1">
            <Zap className="h-3 w-3" />
            {plan.monthlyCredits} crédits / mois
          </Badge>
          <Badge variant="secondary">{plan.maxRequestsPerDay} requêtes / jour</Badge>
          {plan.visionEnabled && (
            <Badge variant="secondary" className="gap-1">
              <Eye className="h-3 w-3" />
              {plan.visionPagesMonth} pages OCR / mois
            </Badge>
          )}
        </div>
      </div>

      <input type="hidden" name="requested_ai_tier" value={tier} />
      <input type="hidden" name="requested_ai_monthly_credits" value={plan.monthlyCredits} />
      <input
        type="hidden"
        name="requested_ai_max_requests_per_day"
        value={plan.maxRequestsPerDay}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="requested_ai_monthly_credits_display" className="text-xs">
            Crédits mensuels (indicatif)
          </Label>
          <input
            id="requested_ai_monthly_credits_display"
            name="requested_ai_monthly_credits_display"
            type="number"
            min={0}
            readOnly
            value={plan.monthlyCredits}
            className="flex h-9 w-full rounded-md border border-input bg-muted/50 px-3 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="requested_ai_max_requests_display" className="text-xs">
            Requêtes max / jour (indicatif)
          </Label>
          <input
            id="requested_ai_max_requests_display"
            name="requested_ai_max_requests_display"
            type="number"
            min={0}
            readOnly
            value={plan.maxRequestsPerDay}
            className="flex h-9 w-full rounded-md border border-input bg-muted/50 px-3 text-sm"
          />
        </div>
      </div>
    </div>
  );
}
