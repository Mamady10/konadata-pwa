'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, Printer, Sparkles } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import {
  getSchoolDirectorReport,
  type SchoolDirectorReportData,
} from '@/lib/actions/school-director-report';
import {
  SCHOOL_REPORT_PERIODS,
  type SchoolReportPeriod,
} from '@/lib/school/report-period';
import { buildDirectorReportPrintHtml } from '@/lib/school/director-report-print';

const STATUS_COLORS = ['#2563EB', '#059669', '#D97706', '#7C3AED', '#DC2626', '#0891B2', '#64748B'];

function nf(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n).replace(/\u202F/g, ' ');
}

function avgColor(avg: number | null): string {
  if (avg == null) return '#94A3B8';
  if (avg >= 12) return '#059669';
  if (avg >= 10) return '#2563EB';
  if (avg >= 8) return '#D97706';
  return '#DC2626';
}

/** Barres verticales colorées (encaissements par mois, moyennes par classe). */
function VerticalBars({
  items,
  format,
}: {
  items: { label: string; value: number; color: string; caption?: string }[];
  format?: (v: number) => string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="flex items-end gap-3 h-44 pt-4">
      {items.map((it, idx) => {
        const h = Math.round((it.value / max) * 130);
        return (
          <div key={idx} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0">
            <span className="text-[10px] font-semibold text-foreground/70 truncate max-w-full">
              {it.caption ?? (format ? format(it.value) : nf(it.value))}
            </span>
            <div
              className="w-full max-w-[54px] rounded-t-md transition-all"
              style={{ height: `${Math.max(4, h)}px`, backgroundColor: it.color }}
            />
            <span className="text-[10px] text-muted-foreground truncate max-w-full text-center">
              {it.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Barre horizontale de progression (encaissé / attendu). */
function ProgressBar({ ratio, color }: { ratio: number; color: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
  return (
    <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

export function SchoolDirectorReport() {
  const [period, setPeriod] = useState<SchoolReportPeriod>('month');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SchoolDirectorReportData | null>(null);

  async function generate(p: SchoolReportPeriod) {
    setPeriod(p);
    setLoading(true);
    setError(null);
    const res = await getSchoolDirectorReport(p);
    setLoading(false);
    if ('error' in res) {
      setError(res.error);
      return;
    }
    setData(res.data);
  }

  function handlePrint() {
    if (!data) return;
    const w = window.open('', '_blank', 'noopener,noreferrer');
    if (!w) return;
    w.document.write(buildDirectorReportPrintHtml(data));
    w.document.close();
  }

  const statusTotal = data ? data.enrollmentStatus.reduce((s, e) => s + e.count, 0) : 0;

  return (
    <Card className="border-primary/25 bg-primary/[0.03] print:border-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Rapport de direction — présentable
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Synthèse visuelle (indicateurs, tableaux, graphiques) à partir des données Supabase.
          Choisissez la période puis imprimez ou exportez en PDF.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {SCHOOL_REPORT_PERIODS.map((p) => (
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
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={handlePrint}
            >
              <Printer className="h-4 w-4 mr-1" />
              Imprimer / PDF
            </Button>
          )}
        </div>

        {loading && (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 animate-pulse" /> Génération…
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {data && !loading && (
          <div className="space-y-6">
            {/* En-tête */}
            <div className="rounded-xl border bg-background p-4">
              <h2 className="text-lg font-bold">{data.orgName}</h2>
              <p className="text-sm text-muted-foreground">
                Rapport de direction — {data.periodLabel}
              </p>
              <p className="text-xs text-muted-foreground">
                Année {data.academicYear} · {data.rangeLabel} · Généré le{' '}
                {new Date(data.generatedAt).toLocaleDateString('fr-FR', {
                  dateStyle: 'long',
                })}
              </p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: 'Élèves inscrits', value: nf(data.kpis.studentsEnrolled), color: '#2563EB' },
                { label: 'Classes actives', value: nf(data.kpis.classesActive), color: '#7C3AED' },
                { label: 'Nouvelles inscriptions', value: nf(data.kpis.newEnrollmentsPeriod), color: '#0891B2' },
                { label: 'Encaissé (période)', value: formatCurrency(data.kpis.collectedPeriod), color: '#059669' },
                { label: 'Notes saisies', value: nf(data.kpis.gradesPeriod), color: '#D97706' },
                { label: 'Bulletins générés', value: nf(data.kpis.bulletinsPeriod), color: '#DC2626' },
              ].map((k) => (
                <div key={k.label} className="rounded-xl border bg-background p-3">
                  <div className="h-1.5 w-8 rounded-full mb-2" style={{ backgroundColor: k.color }} />
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <p className="text-xl font-bold">{k.value}</p>
                </div>
              ))}
            </div>

            {/* Encaissements sur la période */}
            <div className="rounded-xl border bg-background p-4">
              <h3 className="font-semibold text-sm mb-1">Encaissements sur la période</h3>
              <p className="text-xs text-muted-foreground mb-2">
                Total : <span className="font-semibold text-foreground">{formatCurrency(data.kpis.collectedPeriod)}</span>
              </p>
              {data.collectionTrend.length > 0 ? (
                <VerticalBars
                  items={data.collectionTrend.map((t) => ({
                    label: t.label,
                    value: t.amount,
                    color: '#2563EB',
                    caption: t.amount > 0 ? `${nf(Math.round(t.amount / 1000))}k` : '0',
                  }))}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Aucun encaissement.</p>
              )}
            </div>

            {/* Finances par classe */}
            <div className="rounded-xl border bg-background p-4">
              <h3 className="font-semibold text-sm mb-3">
                Situation financière par classe <span className="text-muted-foreground font-normal">(cumul annuel)</span>
              </h3>
              {data.finance.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune classe active.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-3 font-medium">Classe</th>
                        <th className="py-2 px-2 font-medium text-right">Inscrits</th>
                        <th className="py-2 px-2 font-medium text-right">Attendu</th>
                        <th className="py-2 px-2 font-medium text-right">Encaissé</th>
                        <th className="py-2 px-2 font-medium w-40">Taux</th>
                        <th className="py-2 pl-2 font-medium text-right">Écart</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.finance.rows.map((r) => {
                        const ratio = r.expected > 0 ? r.collected / r.expected : 0;
                        return (
                          <tr key={r.className} className="border-b last:border-0">
                            <td className="py-2 pr-3 font-medium">{r.className}</td>
                            <td className="py-2 px-2 text-right">{nf(r.enrolled)}</td>
                            <td className="py-2 px-2 text-right">{formatCurrency(r.expected)}</td>
                            <td className="py-2 px-2 text-right">{formatCurrency(r.collected)}</td>
                            <td className="py-2 px-2">
                              <div className="flex items-center gap-2">
                                <ProgressBar ratio={ratio} color={ratio >= 0.8 ? '#059669' : ratio >= 0.5 ? '#D97706' : '#DC2626'} />
                                <span className="text-xs text-muted-foreground w-9 text-right">{Math.round(ratio * 100)}%</span>
                              </div>
                            </td>
                            <td className={`py-2 pl-2 text-right font-medium ${r.gap > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {formatCurrency(r.gap)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t font-semibold">
                        <td className="py-2 pr-3">Total</td>
                        <td className="py-2 px-2 text-right">{nf(data.finance.totals.enrolled)}</td>
                        <td className="py-2 px-2 text-right">{formatCurrency(data.finance.totals.expected)}</td>
                        <td className="py-2 px-2 text-right">{formatCurrency(data.finance.totals.collected)}</td>
                        <td className="py-2 px-2" />
                        <td className="py-2 pl-2 text-right">{formatCurrency(data.finance.totals.gap)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Candidatures & inscriptions */}
            <div className="rounded-xl border bg-background p-4">
              <h3 className="font-semibold text-sm mb-3">Candidatures &amp; inscriptions</h3>
              {statusTotal === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun dossier.</p>
              ) : (
                <div className="space-y-2">
                  {data.enrollmentStatus.map((s, i) => (
                    <div key={s.status} className="flex items-center gap-3">
                      <span className="text-xs w-28 shrink-0">{s.label}</span>
                      <div className="flex-1">
                        <ProgressBar ratio={s.count / statusTotal} color={STATUS_COLORS[i % STATUS_COLORS.length]} />
                      </div>
                      <span className="text-xs font-semibold w-8 text-right">{s.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Résultats par classe */}
            <div className="rounded-xl border bg-background p-4">
              <h3 className="font-semibold text-sm mb-1">Résultats par classe</h3>
              <p className="text-xs text-muted-foreground mb-2">Moyenne générale sur 20 (cumul)</p>
              {data.resultsByClass.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune note enregistrée.</p>
              ) : (
                <VerticalBars
                  items={data.resultsByClass.map((r) => ({
                    label: r.className,
                    value: r.average ?? 0,
                    color: avgColor(r.average),
                    caption: r.average != null ? r.average.toFixed(1) : '—',
                  }))}
                />
              )}
            </div>

            <p className="text-[11px] text-muted-foreground">
              Rapport basé uniquement sur les données enregistrées dans KonaData. Vérifiez les chiffres
              avant diffusion officielle.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
