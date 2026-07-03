'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, Download, Sparkles, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { getPmeFinancialAnalysis } from '@/lib/actions/pme-financial-report';
import {
  PME_REPORT_PERIODS,
  type PmeFinancialReportData,
  type PmeReportPeriod,
} from '@/lib/pme/financial-report-types';
import { downloadPmeFinancialReportPdf } from '@/lib/pme/financial-report-pdf';

function fc(n: number): string {
  const grouped = Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${grouped} GNF`;
}

const ENTREE_COLOR = '#2563EB';
const DEPENSE_COLOR = '#DC2626';
const RESTE_COLOR = '#059669';

/** Barres verticales colorées (une par jour). */
function DayBars({
  items,
  color,
}: {
  items: { label: string; value: number }[];
  color: string;
}) {
  const max = Math.max(1, ...items.map((i) => Math.abs(i.value)));
  return (
    <div className="flex items-end gap-2 h-40 pt-6">
      {items.map((it, idx) => {
        const h = Math.round((Math.abs(it.value) / max) * 110);
        const negative = it.value < 0;
        return (
          <div key={idx} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0">
            <span className="text-[9px] font-semibold text-foreground/70 truncate max-w-full">
              {it.value !== 0 ? `${Math.round(it.value / 1000)}k` : '0'}
            </span>
            <div
              className="w-full max-w-[42px] rounded-t-md transition-all"
              style={{
                height: `${Math.max(3, h)}px`,
                backgroundColor: negative ? '#F59E0B' : color,
              }}
            />
            <span className="text-[9px] text-muted-foreground truncate max-w-full text-center">
              {it.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function PmeFinancialReport({
  boutiques = [],
}: {
  boutiques?: { id: string; name: string }[];
}) {
  const [period, setPeriod] = useState<PmeReportPeriod>('week');
  const [boutiqueId, setBoutiqueId] = useState('');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PmeFinancialReportData | null>(null);

  async function generate(p: PmeReportPeriod, boutique = boutiqueId) {
    if (p === 'custom' && (!customStart || !customEnd)) {
      setPeriod(p);
      setError('Sélectionnez une date de début et une date de fin.');
      return;
    }
    setPeriod(p);
    setLoading(true);
    setError(null);
    const res = await getPmeFinancialAnalysis(
      p,
      p === 'custom' ? { start: customStart, end: customEnd } : undefined,
      boutique || undefined
    );
    setLoading(false);
    if ('error' in res) {
      setError(res.error);
      return;
    }
    setData(res.data);
  }

  return (
    <Card className="border-primary/25 bg-primary/[0.03]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Analyse financière — présentable
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Entrées, dépenses et reste par jour, à partir de vos ventes, achats et dépenses.
          Choisissez la période puis exportez en PDF.
        </p>

        {boutiques.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm font-medium" htmlFor="pme-boutique">
              Boutique
            </label>
            <select
              id="pme-boutique"
              value={boutiqueId}
              disabled={loading}
              onChange={(e) => {
                const v = e.target.value;
                setBoutiqueId(v);
                if (data || period !== 'custom') void generate(period, v);
              }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Toutes les boutiques (rapport général)</option>
              {boutiques.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}

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
          {data && (
            <Button
              type="button"
              size="sm"
              className="ml-auto bg-emerald-600 hover:bg-emerald-700"
              onClick={() => void downloadPmeFinancialReportPdf(data)}
            >
              <Download className="h-4 w-4 mr-1" /> Télécharger PDF
            </Button>
          )}
        </div>

        {period === 'custom' && (
          <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-background/60 p-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground" htmlFor="pme-start">Du</label>
              <input
                id="pme-start"
                type="date"
                value={customStart}
                max={customEnd || undefined}
                onChange={(e) => setCustomStart(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground" htmlFor="pme-end">Au</label>
              <input
                id="pme-end"
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
          <div className="space-y-6">
            {/* En-tête */}
            <div className="rounded-xl border bg-[#0A192F] p-4 text-white">
              <h2 className="text-base font-bold uppercase tracking-wide">
                Analyses financières — {data.orgName}
              </h2>
              <p className="text-xs text-white/80 mt-0.5">
                {data.boutiqueName ? `Boutique : ${data.boutiqueName}` : 'Toutes les boutiques (rapport général)'}
              </p>
              <p className="text-xs text-white/70 mt-0.5">
                {data.periodLabel} · {data.rangeLabel} · {data.salesCount} vente(s)
              </p>
            </div>

            {/* Bilan (3 cartes) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <BilanCard title="Entrées" value={fc(data.entreesTotal)} icon={TrendingUp} color="bg-blue-600" />
              <BilanCard title="Dépenses" value={fc(data.depensesTotal)} icon={TrendingDown} color="bg-red-600" />
              <BilanCard
                title="Reste"
                value={fc(data.resteTotal)}
                icon={Wallet}
                color={data.resteTotal >= 0 ? 'bg-emerald-600' : 'bg-amber-600'}
              />
            </div>

            {/* ENTREES */}
            <SectionTable
              title="Entrées d'argent (ventes)"
              columnHeader={data.columnHeader}
              accent="bg-blue-50 dark:bg-blue-950/30"
              columns={data.buckets.map((d) => d.short)}
              rows={[{ label: 'Montant', values: data.buckets.map((d) => d.entrees), strong: true }]}
              total={data.entreesTotal}
            />
            <ChartBlock title={`Entrées par ${data.unitLabel}`}>
              <DayBars items={data.buckets.map((d) => ({ label: d.short, value: d.entrees }))} color={ENTREE_COLOR} />
            </ChartBlock>

            {/* DEPENSES */}
            <SectionTable
              title="Dépenses par catégorie"
              columnHeader={data.columnHeader}
              accent="bg-red-50 dark:bg-red-950/30"
              columns={data.buckets.map((d) => d.short)}
              rows={[
                ...data.expenseCategories.map((c) => ({
                  label: c.category,
                  values: c.byBucket,
                  strong: false,
                })),
                { label: 'Total dépenses', values: data.buckets.map((d) => d.depenses), strong: true },
              ]}
              total={data.depensesTotal}
              emptyMessage={data.expenseCategories.length === 0 ? 'Aucune dépense sur la période.' : undefined}
            />
            <ChartBlock title={`Dépenses par ${data.unitLabel}`}>
              <DayBars items={data.buckets.map((d) => ({ label: d.short, value: d.depenses }))} color={DEPENSE_COLOR} />
            </ChartBlock>

            {/* RESTE */}
            <SectionTable
              title="Reste (entrées − dépenses)"
              columnHeader={data.columnHeader}
              accent="bg-emerald-50 dark:bg-emerald-950/30"
              columns={data.buckets.map((d) => d.short)}
              rows={[{ label: 'Reste', values: data.buckets.map((d) => d.reste), strong: true, colorize: true }]}
              total={data.resteTotal}
            />
            <ChartBlock title={`Reste par ${data.unitLabel}`}>
              <DayBars items={data.buckets.map((d) => ({ label: d.short, value: d.reste }))} color={RESTE_COLOR} />
            </ChartBlock>

            <p className="text-[11px] text-muted-foreground">
              Analyse basée uniquement sur les données enregistrées dans KonaData (ventes, achats, dépenses).
              Vérifiez les chiffres avant diffusion.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BilanCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  icon: typeof Wallet;
  color: string;
}) {
  return (
    <div className="rounded-xl border bg-background p-4 flex items-center gap-3">
      <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${color}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="text-lg font-bold truncate">{value}</p>
      </div>
    </div>
  );
}

function ChartBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <h3 className="font-semibold text-sm mb-1">{title}</h3>
      {children}
    </div>
  );
}

function SectionTable({
  title,
  columnHeader,
  accent,
  columns,
  rows,
  total,
  emptyMessage,
}: {
  title: string;
  columnHeader: string;
  accent: string;
  columns: string[];
  rows: { label: string; values: number[]; strong?: boolean; colorize?: boolean }[];
  total: number;
  emptyMessage?: string;
}) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <h3 className="font-semibold text-sm mb-3">{title}</h3>
      {emptyMessage ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm border-collapse">
            <thead>
              <tr className={`text-left ${accent}`}>
                <th className="py-2 px-2 font-medium border">{columnHeader}</th>
                {columns.map((d, i) => (
                  <th key={`${d}-${i}`} className="py-2 px-2 font-medium border text-right whitespace-nowrap">
                    {d}
                  </th>
                ))}
                <th className="py-2 px-2 font-medium border text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const rowTotal = r.values.reduce((s, x) => s + x, 0);
                return (
                  <tr key={r.label} className={r.strong ? 'font-semibold' : ''}>
                    <td className="py-1.5 px-2 border whitespace-nowrap">{r.label}</td>
                    {r.values.map((v, i) => (
                      <td
                        key={i}
                        className={`py-1.5 px-2 border text-right whitespace-nowrap tabular-nums ${
                          r.colorize && v < 0 ? 'text-rose-600' : r.colorize && v > 0 ? 'text-emerald-600' : ''
                        }`}
                      >
                        {v !== 0 ? fc(v) : '—'}
                      </td>
                    ))}
                    <td className="py-1.5 px-2 border text-right whitespace-nowrap tabular-nums font-semibold">
                      {fc(rowTotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className={`${accent} font-bold`}>
                <td className="py-2 px-2 border" colSpan={columns.length + 1}>
                  Total période
                </td>
                <td className="py-2 px-2 border text-right tabular-nums">{fc(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
