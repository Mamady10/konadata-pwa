import type { jsPDF } from 'jspdf';
import type { WeeklyReportExportStructured } from '@/lib/btp/weekly-report-export-types';
import { kpiStatusLabel } from '@/lib/btp/site-baseline';
import type { KpiTrafficStatus } from '@/lib/btp/site-baseline-types';

export const EXPORT_COLORS = {
  navy: [10, 25, 47] as [number, number, number],
  blue: [37, 99, 235] as [number, number, number],
  teal: [45, 212, 191] as [number, number, number],
  text: [30, 41, 59] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  rowAlt: [248, 250, 252] as [number, number, number],
  headerBg: [239, 246, 255] as [number, number, number],
  bar: [37, 99, 235] as [number, number, number],
  barSecondary: [16, 185, 129] as [number, number, number],
};

/** jsPDF helvetica ne gère pas bien certains caractères Unicode. */
export function sanitizePdfText(text: string): string {
  return String(text ?? '')
    .normalize('NFC')
    .replace(/\u202F/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\u2192/g, '->')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2022/g, '-')
    .replace(/\u26a0\ufe0f?/g, '!')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\u00C0-\u024F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Montants GNF lisibles en PDF (ASCII, sans Intl). */
export function formatGnfPdf(amount: number): string {
  const rounded = Math.round(Number(amount) || 0);
  const abs = Math.abs(rounded);
  const grouped = abs
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return rounded < 0 ? `-${grouped} GNF` : `${grouped} GNF`;
}

export function formatPdfNumber(value: number): string {
  const rounded = Math.round(Number(value) || 0);
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function drawSectionTitle(doc: jsPDF, y: number, title: string, margin: number): number {
  doc.setFillColor(...EXPORT_COLORS.blue);
  doc.rect(margin, y - 4, 3, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...EXPORT_COLORS.blue);
  doc.text(sanitizePdfText(title.toUpperCase()), margin + 6, y + 2);
  return y + 10;
}

export function drawTable(
  doc: jsPDF,
  startY: number,
  margin: number,
  contentW: number,
  colWidths: number[],
  rows: string[][],
  options?: { headerRows?: number }
): number {
  const headerRows = options?.headerRows ?? 1;
  const rowH = 7;
  let y = startY;

  for (let r = 0; r < rows.length; r++) {
    const isHeader = r < headerRows;
    if (isHeader) {
      doc.setFillColor(...EXPORT_COLORS.headerBg);
    } else if (r % 2 === 0) {
      doc.setFillColor(...EXPORT_COLORS.rowAlt);
    } else {
      doc.setFillColor(255, 255, 255);
    }
    doc.rect(margin, y, contentW, rowH, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.rect(margin, y, contentW, rowH, 'S');

    let x = margin;
    for (let c = 0; c < rows[r].length; c++) {
      const w = colWidths[c] ?? contentW / rows[r].length;
      if (c > 0) doc.line(x, y, x, y + rowH);
      doc.setFont('helvetica', isHeader ? 'bold' : 'normal');
      doc.setFontSize(isHeader ? 8.5 : 8);
      doc.setTextColor(...(isHeader ? EXPORT_COLORS.blue : EXPORT_COLORS.text));
      const cell = sanitizePdfText(rows[r][c] ?? '');
      const lines = doc.splitTextToSize(cell, w - 3) as string[];
      doc.text(lines[0] ?? '', x + 2, y + 4.8);
      x += w;
    }
    y += rowH;
  }
  return y + 4;
}

export function drawBarChart(
  doc: jsPDF,
  startY: number,
  margin: number,
  contentW: number,
  title: string,
  items: { label: string; value: number; color?: [number, number, number] }[],
  options?: { maxValue?: number; unit?: string }
): number {
  if (items.length === 0) return startY;

  const maxVal = options?.maxValue ?? Math.max(...items.map((i) => i.value), 1);
  const chartH = 36;
  const labelH = 8;
  const totalH = chartH + labelH + 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...EXPORT_COLORS.muted);
  doc.text(sanitizePdfText(title), margin, startY);
  let y = startY + 5;

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.line(margin, y + chartH, margin + contentW, y + chartH);

  const barW = Math.min(22, (contentW - 8) / items.length - 4);
  const gap = (contentW - barW * items.length) / (items.length + 1);

  items.forEach((item, i) => {
    const x = margin + gap + i * (barW + gap);
    const h = Math.max(2, (item.value / maxVal) * (chartH - 4));
    const color = item.color ?? EXPORT_COLORS.bar;
    doc.setFillColor(...color);
    doc.roundedRect(x, y + chartH - h, barW, h, 1, 1, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...EXPORT_COLORS.text);
    const valText = `${item.value}${options?.unit ?? ''}`;
    doc.text(valText, x + barW / 2, y + chartH - h - 1.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...EXPORT_COLORS.muted);
    const labelLines = doc.splitTextToSize(sanitizePdfText(item.label), barW + 4) as string[];
    doc.text(labelLines[0] ?? '', x + barW / 2, y + chartH + 4, { align: 'center' });
  });

  return y + totalH;
}

export type SCurvePoint = {
  date: string;
  label: string;
  plannedPct: number | null;
  actualPct: number | null;
};

/** Courbe S planifie vs realise (lignes cumulatives, axe temps). */
export function drawSCurveChart(
  doc: jsPDF,
  startY: number,
  margin: number,
  contentW: number,
  title: string,
  points: SCurvePoint[]
): number {
  if (points.length < 2) return startY;

  const padL = 10;
  const chartH = 44;
  const plotW = contentW - padL - 2;
  const plotH = chartH - 6;
  const plotX = margin + padL;
  const plotY = startY + 7;
  const yMax = 100;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...EXPORT_COLORS.muted);
  doc.text(sanitizePdfText(title), margin, startY);

  const yAt = (v: number) => plotY + plotH - (Math.min(yMax, Math.max(0, v)) / yMax) * plotH;
  const xAt = (i: number) => plotX + (i / (points.length - 1)) * plotW;

  for (const tick of [0, 25, 50, 75, 100]) {
    const y = yAt(tick);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.15);
    doc.line(plotX, y, plotX + plotW, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...EXPORT_COLORS.muted);
    doc.text(String(tick), margin + 1, y + 1);
  }

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.25);
  doc.line(plotX, plotY + plotH, plotX + plotW, plotY + plotH);

  doc.setDrawColor(...EXPORT_COLORS.muted);
  doc.setLineWidth(0.55);
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i].plannedPct;
    const b = points[i + 1].plannedPct;
    if (a != null && b != null) {
      doc.line(xAt(i), yAt(a), xAt(i + 1), yAt(b));
    }
  }

  doc.setDrawColor(...EXPORT_COLORS.bar);
  doc.setLineWidth(0.85);
  let lastActualIdx: number | null = null;
  for (let i = 0; i < points.length; i++) {
    const v = points[i].actualPct;
    if (v == null) continue;
    if (lastActualIdx != null) {
      doc.line(
        xAt(lastActualIdx),
        yAt(points[lastActualIdx].actualPct!),
        xAt(i),
        yAt(v)
      );
    }
    lastActualIdx = i;
  }

  const n = points.length;
  const labelEvery = Math.max(1, Math.ceil(n / 6));
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(...EXPORT_COLORS.muted);
  for (let i = 0; i < n; i += labelEvery) {
    doc.text(sanitizePdfText(points[i].label), xAt(i), plotY + plotH + 5, { align: 'center' });
  }
  if ((n - 1) % labelEvery !== 0) {
    doc.text(sanitizePdfText(points[n - 1].label), xAt(n - 1), plotY + plotH + 5, { align: 'center' });
  }

  const legY = plotY + plotH + 11;
  doc.setDrawColor(...EXPORT_COLORS.muted);
  doc.setLineWidth(0.55);
  doc.line(margin + 2, legY - 0.5, margin + 10, legY - 0.5);
  doc.text('Planifie', margin + 12, legY);
  doc.setDrawColor(...EXPORT_COLORS.bar);
  doc.setLineWidth(0.85);
  doc.line(margin + 32, legY - 0.5, margin + 40, legY - 0.5);
  doc.text('Realise', margin + 42, legY);

  return legY + 5;
}

export function synthesisTableRows(s: WeeklyReportExportStructured['synthesis']): string[][] {
  const delta = s.physicalEnd - s.physicalStart;
  const sign = delta >= 0 ? '+' : '';
  return [
    ['Indicateur', 'Valeur'],
    ['Avancement physique', `${s.physicalStart} % -> ${s.physicalEnd} % (${sign}${Math.round(delta)} pt)`],
    ['Avancement financier', `${Math.round(s.financialPct)} %`],
    ['Retard cumule', `${s.delayDays} jour(s)`],
    ['Budget', formatGnfPdf(s.budget)],
    ['Depense', formatGnfPdf(s.spent)],
    ['Reste a engager', formatGnfPdf(Math.max(0, s.budget - s.spent))],
    ['Fiches journalieres', `${s.dailyCount} sur la periode`],
  ];
}

export function identificationTableRows(
  orgName: string,
  id: WeeklyReportExportStructured['identification']
): string[][] {
  const rows: string[][] = [
    ['Champ', 'Valeur'],
    ['Organisation', orgName],
    ['Chantier', id.chantier],
  ];
  if (id.client) rows.push(['Client / MOA', id.client]);
  if (id.contractRef) rows.push(['N° contrat', id.contractRef]);
  if (id.moaRecipient) rows.push(['Destinataire rapport', id.moaRecipient]);
  rows.push(
    ['Localisation', id.localisation ?? '-'],
    ['Statut', id.statut]
  );
  if (id.planningStart && id.planningEnd) {
    rows.push(['Planning', `${id.planningStart} -> ${id.planningEnd}`]);
  }
  rows.push(['Periode rapport', id.periode]);
  return rows;
}

const KPI_COLORS: Record<string, [number, number, number]> = {
  green: [16, 185, 129],
  amber: [245, 158, 11],
  red: [239, 68, 68],
  neutral: [148, 163, 184],
};

export function drawKpiRow(
  doc: jsPDF,
  y: number,
  margin: number,
  labels: { name: string; status: KpiTrafficStatus }[]
): number {
  let x = margin;
  for (const item of labels) {
    const color = KPI_COLORS[item.status] ?? KPI_COLORS.neutral;
    doc.setFillColor(...color);
    doc.circle(x + 2, y + 1.5, 1.8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...EXPORT_COLORS.text);
    doc.text(sanitizePdfText(item.name), x + 5, y + 2.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...EXPORT_COLORS.muted);
    doc.text(sanitizePdfText(kpiStatusLabel(item.status)), x + 5, y + 6);
    x += 46;
  }
  return y + 12;
}

export function comparisonMetricsTableRows(
  c: NonNullable<WeeklyReportExportStructured['comparison']>
): string[][] {
  const rows: string[][] = [['Indicateur', 'Planifie / Ref.', 'Reel', 'Ecart']];
  if (c.plannedPhysicalPct != null) {
    rows.push([
      'Avancement physique',
      `${c.plannedPhysicalPct} %`,
      `${c.actualPhysicalPct} %`,
      c.physicalGapPts != null ? `${c.physicalGapPts >= 0 ? '+' : ''}${c.physicalGapPts} pt` : '-',
    ]);
  }
  if (c.timeElapsedPct != null) {
    rows.push([
      'Temps vs travaux',
      `${c.timeElapsedPct} % temps`,
      `${c.actualPhysicalPct} % travaux`,
      c.timeVsPhysicalGapPts != null
        ? `${c.timeVsPhysicalGapPts >= 0 ? '+' : ''}${c.timeVsPhysicalGapPts} pt`
        : '-',
    ]);
  }
  if (c.budgetPlannedCumulative != null) {
    rows.push([
      'Budget cumule',
      formatGnfPdf(c.budgetPlannedCumulative),
      formatGnfPdf(c.budgetConsumedCumulative),
      c.budgetGapAmount != null
        ? `${c.budgetGapAmount >= 0 ? '+' : ''}${formatGnfPdf(c.budgetGapAmount)}`
        : '-',
    ]);
  }
  if (c.financialPctAuto != null) {
    rows.push([
      'Physique vs financier',
      `${c.actualPhysicalPct} % phys.`,
      `${c.financialPctAuto} % fin.`,
      c.physicalVsFinancialGapPts != null
        ? `${c.physicalVsFinancialGapPts >= 0 ? '+' : ''}${c.physicalVsFinancialGapPts} pt`
        : '-',
    ]);
  }
  return rows;
}

export function milestoneTableRows(
  c: NonNullable<WeeklyReportExportStructured['comparison']>
): string[][] {
  if (c.milestoneRows.length === 0) return [];
  return [
    ['Jalon', 'Prevu', 'Cible', 'Realise', 'Ecart (j)'],
    ...c.milestoneRows.map((m) => [
      m.label,
      m.plannedDate,
      `${m.targetPhysicalPct} %`,
      m.actualDate ? `${m.actualDate} (${m.actualPhysicalPct} %)` : 'Non atteint',
      m.gapDays != null ? String(m.gapDays) : '-',
    ]),
  ];
}
