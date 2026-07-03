'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LayoutGrid, Sparkles } from 'lucide-react';
import { getPmeBoutiqueComparison } from '@/lib/actions/pme-financial-report';
import {
  PME_REPORT_PERIODS,
  type PmeReportPeriod,
  type PmeBoutiqueComparison,
} from '@/lib/pme/financial-report-types';

function fc(n: number): string {
  const grouped = Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${grouped} GNF`;
}

export function PmeBoutiqueComparisonPanel() {
  const [period, setPeriod] = useState<PmeReportPeriod>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PmeBoutiqueComparison | null>(null);

  async function generate(p: PmeReportPeriod) {
    if (p === 'custom' && (!customStart || !customEnd)) {
      setPeriod(p);
      setError('Sélectionnez une date de début et une date de fin.');
      return;
    }
    setPeriod(p);
    setLoading(true);
    setError(null);
    const res = await getPmeBoutiqueComparison(
      p,
      p === 'custom' ? { start: customStart, end: customEnd } : undefined
    );
    setLoading(false);
    if ('error' in res) {
      setError(res.error);
      return;
    }
    setData(res.data);
  }

  const maxEntree = data ? Math.max(1, ...data.rows.map((r) => r.entrees)) : 1;

  return (
    <Card className="border-primary/25 bg-primary/[0.03]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <LayoutGrid className="h-5 w-5 text-primary" />
          Comparatif des boutiques
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Chiffres de chaque boutique côte à côte sur la période choisie (entrées, dépenses, reste).
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {PME_REPORT_PERIODS.map((p) => (
            <Button
              key={p.id}
              type="button"
              variant={period === p.id ? 'default' : 'outline'}
              size="sm"
              className={period === p.id ? 'bg-[#2563EB]' : ''}
              disabled={loading}
              onClick={() => void generate(p.id)}
            >
              {p.label}
            </Button>
          ))}
        </div>

        {period === 'custom' && (
          <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-background/60 p-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground" htmlFor="cmp-start">Du</label>
              <input
                id="cmp-start"
                type="date"
                value={customStart}
                max={customEnd || undefined}
                onChange={(e) => setCustomStart(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground" htmlFor="cmp-end">Au</label>
              <input
                id="cmp-end"
                type="date"
                value={customEnd}
                min={customStart || undefined}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            <Button
              type="button"
              size="sm"
              className="bg-[#2563EB]"
              disabled={loading || !customStart || !customEnd}
              onClick={() => void generate('custom')}
            >
              Générer
            </Button>
          </div>
        )}

        {loading && (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 animate-pulse" /> Génération…
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {data && !loading && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {data.periodLabel} · {data.rangeLabel}
            </p>

            {data.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune boutique à comparer.</p>
            ) : (
              <>
                <div className="overflow-x-auto rounded-xl border bg-background">
                  <table className="w-full text-xs sm:text-sm border-collapse">
                    <thead>
                      <tr className="bg-muted/50 text-left">
                        <th className="py-2 px-3 font-medium border">Boutique</th>
                        <th className="py-2 px-3 font-medium border text-right">Entrées</th>
                        <th className="py-2 px-3 font-medium border text-right">Dépenses</th>
                        <th className="py-2 px-3 font-medium border text-right">Reste</th>
                        <th className="py-2 px-3 font-medium border text-right">Ventes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((r) => (
                        <tr key={r.boutiqueId ?? 'none'}>
                          <td className="py-1.5 px-3 border font-medium">{r.name}</td>
                          <td className="py-1.5 px-3 border text-right tabular-nums">{fc(r.entrees)}</td>
                          <td className="py-1.5 px-3 border text-right tabular-nums">{fc(r.depenses)}</td>
                          <td className={`py-1.5 px-3 border text-right tabular-nums font-semibold ${r.reste < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {fc(r.reste)}
                          </td>
                          <td className="py-1.5 px-3 border text-right tabular-nums">{r.salesCount}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/50 font-bold">
                        <td className="py-2 px-3 border">Total entreprise</td>
                        <td className="py-2 px-3 border text-right tabular-nums">{fc(data.totals.entrees)}</td>
                        <td className="py-2 px-3 border text-right tabular-nums">{fc(data.totals.depenses)}</td>
                        <td className="py-2 px-3 border text-right tabular-nums">{fc(data.totals.reste)}</td>
                        <td className="py-2 px-3 border text-right tabular-nums">{data.totals.salesCount}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="rounded-xl border bg-background p-4 space-y-3">
                  <h3 className="text-sm font-semibold">Entrées par boutique</h3>
                  {data.rows.map((r) => (
                    <div key={r.boutiqueId ?? 'none'} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="truncate">{r.name}</span>
                        <span className="tabular-nums text-muted-foreground">{fc(r.entrees)}</span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#2563EB]"
                          style={{ width: `${Math.max(2, Math.round((r.entrees / maxEntree) * 100))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
