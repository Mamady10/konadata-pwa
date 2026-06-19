'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { getBtpPlannedProgressPreview } from '@/lib/actions/btp-planning-ref';
import type { BtpPlannedProgressSnapshot } from '@/lib/btp/site-baseline-types';
import { kpiStatusLabel } from '@/lib/btp/site-baseline';
import { Loader2, TrendingDown, TrendingUp, Minus } from 'lucide-react';

interface Props {
  siteId: string;
  progressDate: string;
  physicalPct: number;
  refSlot: 1 | 2;
}

const STATUS_STYLES = {
  green: 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-500/10 text-amber-800 border-amber-200',
  red: 'bg-red-500/10 text-red-700 border-red-200',
  neutral: 'bg-slate-500/10 text-slate-600 border-slate-200',
};

export function BtpPlannedVsActualPanel({ siteId, progressDate, physicalPct, refSlot }: Props) {
  const [snapshot, setSnapshot] = useState<BtpPlannedProgressSnapshot | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!siteId || !progressDate) {
      setSnapshot(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getBtpPlannedProgressPreview(siteId, progressDate, physicalPct, refSlot).then((result) => {
      if (!cancelled) {
        setSnapshot(result);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [siteId, progressDate, physicalPct, refSlot]);

  if (!siteId) return null;

  if (loading && !snapshot) {
    return (
      <div className="sm:col-span-2 flex items-center gap-2 text-sm text-muted-foreground rounded-lg border bg-muted/20 p-3">
        <Loader2 className="h-4 w-4 animate-spin" /> Calcul de la référence planifiée…
      </div>
    );
  }

  if (!snapshot) return null;

  const gapIcon =
    snapshot.gapPts > 0 ? (
      <TrendingUp className="h-4 w-4 text-emerald-600" />
    ) : snapshot.gapPts < 0 ? (
      <TrendingDown className="h-4 w-4 text-red-600" />
    ) : (
      <Minus className="h-4 w-4 text-slate-500" />
    );

  return (
    <div className="sm:col-span-2 rounded-lg border border-blue-200/60 bg-blue-50/50 dark:bg-blue-950/20 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-primary">Comparaison planifié vs réel</p>
        <Badge variant="outline" className={`text-[10px] ${STATUS_STYLES[snapshot.status]}`}>
          {kpiStatusLabel(snapshot.status)}
        </Badge>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-xs text-muted-foreground">Planifié</p>
          <p className="text-lg font-bold">{snapshot.plannedPct} %</p>
          <p className="text-[10px] text-muted-foreground">{snapshot.label}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Réalisé (saisi)</p>
          <p className="text-lg font-bold">{physicalPct} %</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Écart</p>
          <p className="text-lg font-bold flex items-center justify-center gap-1">
            {gapIcon}
            {snapshot.gapPts >= 0 ? '+' : ''}
            {snapshot.gapPts} pt
          </p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {snapshot.source === 'ms_project'
          ? 'Référence calculée depuis le planning MS Project importé (pondération par durée des tâches).'
          : snapshot.source === 'milestones'
            ? 'Référence calculée depuis les jalons du chantier.'
            : 'Référence linéaire entre les dates de début et fin du chantier.'}
      </p>
    </div>
  );
}
