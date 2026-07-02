import { formatCurrency } from '@/lib/utils';
import type { SchoolDirectorReportData } from '@/lib/actions/school-director-report';

const STATUS_COLORS = ['#2563EB', '#059669', '#D97706', '#7C3AED', '#DC2626', '#0891B2', '#64748B'];

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function nf(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n).replace(/\u202F/g, ' ');
}

function fc(n: number): string {
  return formatCurrency(n).replace(/\u202F/g, ' ');
}

function avgColor(avg: number | null): string {
  if (avg == null) return '#94A3B8';
  if (avg >= 12) return '#059669';
  if (avg >= 10) return '#2563EB';
  if (avg >= 8) return '#D97706';
  return '#DC2626';
}

function verticalBars(
  items: { label: string; value: number; color: string; caption: string }[]
): string {
  const max = Math.max(1, ...items.map((i) => i.value));
  const bars = items
    .map((it) => {
      const h = Math.max(4, Math.round((it.value / max) * 120));
      return `<div class="col">
        <div class="cap">${esc(it.caption)}</div>
        <div class="bar" style="height:${h}px;background:${it.color}"></div>
        <div class="lbl">${esc(it.label)}</div>
      </div>`;
    })
    .join('');
  return `<div class="vbars">${bars}</div>`;
}

function progressCell(ratio: number, color: string): string {
  const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
  return `<div class="prog"><div class="prog-fill" style="width:${pct}%;background:${color}"></div></div><span class="pct">${pct}%</span>`;
}

export function buildDirectorReportPrintHtml(data: SchoolDirectorReportData): string {
  const generated = new Date(data.generatedAt).toLocaleDateString('fr-FR', { dateStyle: 'long' });

  const kpis = [
    { label: 'Élèves inscrits', value: nf(data.kpis.studentsEnrolled), color: '#2563EB' },
    { label: 'Classes actives', value: nf(data.kpis.classesActive), color: '#7C3AED' },
    { label: 'Nouvelles inscriptions', value: nf(data.kpis.newEnrollmentsPeriod), color: '#0891B2' },
    { label: 'Encaissé (période)', value: fc(data.kpis.collectedPeriod), color: '#059669' },
    { label: 'Notes saisies', value: nf(data.kpis.gradesPeriod), color: '#D97706' },
    { label: 'Bulletins générés', value: nf(data.kpis.bulletinsPeriod), color: '#DC2626' },
  ]
    .map(
      (k) => `<div class="kpi">
        <div class="kpi-tick" style="background:${k.color}"></div>
        <div class="kpi-label">${esc(k.label)}</div>
        <div class="kpi-value">${esc(k.value)}</div>
      </div>`
    )
    .join('');

  const trend =
    data.collectionTrend.length > 0
      ? verticalBars(
          data.collectionTrend.map((t) => ({
            label: t.label,
            value: t.amount,
            color: '#2563EB',
            caption: t.amount > 0 ? `${nf(Math.round(t.amount / 1000))}k` : '0',
          }))
        )
      : '<p class="muted">Aucun encaissement.</p>';

  const financeRows =
    data.finance.rows.length > 0
      ? data.finance.rows
          .map((r) => {
            const ratio = r.expected > 0 ? r.collected / r.expected : 0;
            const color = ratio >= 0.8 ? '#059669' : ratio >= 0.5 ? '#D97706' : '#DC2626';
            const gapClass = r.gap > 0 ? 'neg' : 'pos';
            return `<tr>
              <td class="strong">${esc(r.className)}</td>
              <td class="r">${nf(r.enrolled)}</td>
              <td class="r">${fc(r.expected)}</td>
              <td class="r">${fc(r.collected)}</td>
              <td class="prog-td">${progressCell(ratio, color)}</td>
              <td class="r ${gapClass}">${fc(r.gap)}</td>
            </tr>`;
          })
          .join('')
      : '';

  const financeTable =
    data.finance.rows.length > 0
      ? `<table>
          <thead><tr>
            <th>Classe</th><th class="r">Inscrits</th><th class="r">Attendu</th>
            <th class="r">Encaissé</th><th>Taux</th><th class="r">Écart</th>
          </tr></thead>
          <tbody>${financeRows}</tbody>
          <tfoot><tr class="total">
            <td>Total</td>
            <td class="r">${nf(data.finance.totals.enrolled)}</td>
            <td class="r">${fc(data.finance.totals.expected)}</td>
            <td class="r">${fc(data.finance.totals.collected)}</td>
            <td></td>
            <td class="r">${fc(data.finance.totals.gap)}</td>
          </tr></tfoot>
        </table>`
      : '<p class="muted">Aucune classe active.</p>';

  const statusTotal = data.enrollmentStatus.reduce((s, e) => s + e.count, 0);
  const statusBars =
    statusTotal > 0
      ? data.enrollmentStatus
          .map((s, i) => {
            const ratio = s.count / statusTotal;
            const pct = Math.round(ratio * 100);
            return `<div class="hbar">
              <span class="hbar-label">${esc(s.label)}</span>
              <div class="prog"><div class="prog-fill" style="width:${pct}%;background:${STATUS_COLORS[i % STATUS_COLORS.length]}"></div></div>
              <span class="hbar-count">${s.count}</span>
            </div>`;
          })
          .join('')
      : '<p class="muted">Aucun dossier.</p>';

  const results =
    data.resultsByClass.length > 0
      ? verticalBars(
          data.resultsByClass.map((r) => ({
            label: r.className,
            value: r.average ?? 0,
            color: avgColor(r.average),
            caption: r.average != null ? r.average.toFixed(1) : '—',
          }))
        )
      : '<p class="muted">Aucune note enregistrée.</p>';

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/>
<title>${esc(data.orgName)} — Rapport ${esc(data.periodLabel)}</title>
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 28px 32px; }
  h1 { font-size: 20px; margin: 0; }
  h2 { font-size: 14px; margin: 22px 0 10px; padding-bottom: 4px; border-bottom: 2px solid #e2e8f0; }
  .sub { color: #475569; font-size: 12px; margin-top: 2px; }
  .meta { color: #64748b; font-size: 11px; margin-top: 2px; }
  .muted { color: #64748b; font-size: 12px; }
  .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 16px; }
  .kpi { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; }
  .kpi-tick { width: 30px; height: 5px; border-radius: 4px; margin-bottom: 6px; }
  .kpi-label { font-size: 11px; color: #64748b; }
  .kpi-value { font-size: 19px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; color: #64748b; font-weight: 600; font-size: 11px; border-bottom: 1px solid #e2e8f0; padding: 6px 8px; }
  td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; }
  td.r, th.r { text-align: right; }
  td.strong { font-weight: 600; }
  td.neg { color: #dc2626; font-weight: 600; }
  td.pos { color: #059669; font-weight: 600; }
  tr.total td { border-top: 2px solid #e2e8f0; font-weight: 700; }
  .prog-td { min-width: 130px; }
  .prog { display: inline-block; vertical-align: middle; width: 90px; height: 8px; background: #eef2f7; border-radius: 999px; overflow: hidden; }
  .prog-fill { height: 100%; border-radius: 999px; }
  .pct { font-size: 10px; color: #64748b; margin-left: 6px; }
  .hbar { display: flex; align-items: center; gap: 10px; margin: 5px 0; }
  .hbar-label { width: 130px; font-size: 11px; }
  .hbar .prog { flex: 1; width: auto; }
  .hbar-count { width: 28px; text-align: right; font-weight: 600; font-size: 11px; }
  .vbars { display: flex; align-items: flex-end; gap: 14px; height: 170px; padding-top: 12px; border-bottom: 1px solid #e2e8f0; }
  .col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 4px; }
  .bar { width: 100%; max-width: 52px; border-radius: 6px 6px 0 0; }
  .cap { font-size: 10px; font-weight: 600; color: #334155; }
  .lbl { font-size: 10px; color: #64748b; text-align: center; }
  .foot { margin-top: 24px; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  .card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-top: 12px; }
  @media print { body { padding: 0; } h2 { page-break-after: avoid; } .card, table { page-break-inside: avoid; } }
</style></head>
<body>
  <h1>${esc(data.orgName)}</h1>
  <div class="sub">Rapport de direction — ${esc(data.periodLabel)}</div>
  <div class="meta">Année ${esc(data.academicYear)} · ${esc(data.rangeLabel)} · Généré le ${esc(generated)}</div>

  <div class="kpis">${kpis}</div>

  <h2>Encaissements sur la période — total ${fc(data.kpis.collectedPeriod)}</h2>
  <div class="card">${trend}</div>

  <h2>Situation financière par classe (cumul annuel)</h2>
  ${financeTable}

  <h2>Candidatures &amp; inscriptions</h2>
  <div class="card">${statusBars}</div>

  <h2>Résultats par classe — moyenne sur 20</h2>
  <div class="card">${results}</div>

  <div class="foot">Rapport basé uniquement sur les données enregistrées dans KonaData. Vérifiez les chiffres avant diffusion officielle.</div>
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 250); };</script>
</body></html>`;
}
