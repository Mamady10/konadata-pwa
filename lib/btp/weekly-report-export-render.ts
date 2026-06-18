import type { jsPDF } from 'jspdf';
import { formatCurrency } from '@/lib/utils';
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
  return text
    .normalize('NFC')
    .replace(/\u2192/g, '->')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2022/g, '-')
    .replace(/\u26a0\ufe0f?/g, '!')
    .replace(/\u00a0/g, ' ');
}

export function formatGnfPdf(amount: number): string {
  return sanitizePdfText(formatCurrency(amount));
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
