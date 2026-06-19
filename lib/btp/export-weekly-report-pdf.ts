import { jsPDF } from 'jspdf';
import type { WeeklyReportExportPayload } from '@/lib/btp/weekly-report-export-types';
import { displayOrgName, slugifyReportFilename } from '@/lib/btp/weekly-report-export-types';
import {
  EXPORT_COLORS,
  sanitizePdfText,
  drawSectionTitle,
  drawTable,
  drawBarChart,
  drawSCurveChart,
  synthesisTableRows,
  identificationTableRows,
  formatGnfPdf,
  formatPdfNumber,
  comparisonMetricsTableRows,
  milestoneTableRows,
  drawKpiRow,
} from '@/lib/btp/weekly-report-export-render';

const PAGE_W = 210;
const MARGIN = 16;
const CONTENT_W = PAGE_W - MARGIN * 2;

function wrapLines(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(sanitizePdfText(text), maxWidth) as string[];
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > 278) {
    doc.addPage();
    return 24;
  }
  return y;
}

function drawPageFooter(doc: jsPDF, orgName: string) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...EXPORT_COLORS.muted);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, 287, PAGE_W - MARGIN, 287);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...EXPORT_COLORS.muted);
    doc.text(sanitizePdfText(`${orgName} - Rapport hebdomadaire`), MARGIN, 292);
    doc.text(
      sanitizePdfText(`Propulse par KonaData - Page ${i}/${pageCount}`),
      PAGE_W - MARGIN,
      292,
      { align: 'right' }
    );
  }
}

export function buildWeeklyReportPdf(payload: WeeklyReportExportPayload): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const orgName = displayOrgName(payload.orgName);
  const { structured: s } = payload;
  const generatedAt = sanitizePdfText(
    payload.generatedAt ??
      new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })
  );

  doc.setFillColor(...EXPORT_COLORS.navy);
  doc.rect(0, 0, PAGE_W, 48, 'F');
  doc.setFillColor(...EXPORT_COLORS.blue);
  doc.rect(0, 46, PAGE_W, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  const orgLines = wrapLines(doc, orgName.toUpperCase(), CONTENT_W);
  doc.text(orgLines, MARGIN, 16);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...EXPORT_COLORS.teal);
  doc.text('Rapport de chantier hebdomadaire · BTP', MARGIN, 24);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(sanitizePdfText(payload.title.replace(/^Rapport de chantier hebdomadaire — /, '')), MARGIN, 33);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(sanitizePdfText(payload.subtitle), MARGIN, 40);

  let y = 58;
  doc.setTextColor(...EXPORT_COLORS.muted);
  doc.setFontSize(8);
  doc.text(sanitizePdfText(`Genere le ${generatedAt} - ${payload.isoWeek}`), MARGIN, y);
  y += 10;

  y = ensureSpace(doc, y, 50);
  y = drawSectionTitle(doc, y, 'Identification', MARGIN);
  y = drawTable(doc, y, MARGIN, CONTENT_W, [52, CONTENT_W - 52], identificationTableRows(orgName, s.identification));

  const cmp = s.comparison;
  if (cmp) {
    y = ensureSpace(doc, y, 70);
    y = drawSectionTitle(doc, y, 'Analyse planifie vs reel', MARGIN);
    y = drawKpiRow(doc, y, MARGIN, [
      { name: 'Planning', status: cmp.kpis.planning },
      { name: 'Budget', status: cmp.kpis.budget },
      { name: 'Delais', status: cmp.kpis.schedule },
      { name: 'Global', status: cmp.kpis.overall },
    ]);
    if (comparisonMetricsTableRows(cmp).length > 1) {
      y = drawTable(doc, y, MARGIN, CONTENT_W, [42, 38, 38, CONTENT_W - 118], comparisonMetricsTableRows(cmp));
    }
    const mRows = milestoneTableRows(cmp);
    if (mRows.length > 0) {
      y = ensureSpace(doc, y, 24);
      y = drawTable(doc, y, MARGIN, CONTENT_W, [36, 28, 18, 48, 22], mRows);
    }
    const curve =
      cmp.sCurve.length >= 2
        ? cmp.sCurve
        : cmp.progressCurve.length >= 2
          ? cmp.progressCurve
          : [];
    if (curve.length >= 2) {
      y = ensureSpace(doc, y, 58);
      y = drawSCurveChart(
        doc,
        y,
        MARGIN,
        CONTENT_W,
        cmp.sCurve.length >= 2
          ? 'Courbe S avancement planifie vs realise (chantier)'
          : 'Courbe avancement planifie vs realise (semaine)',
        curve
      );
    }
    if (cmp.timeElapsedPct != null) {
      y = ensureSpace(doc, y, 42);
      y = drawBarChart(
        doc,
        y,
        MARGIN,
        CONTENT_W,
        'Temps ecoule vs avancement physique (%)',
        [
          { label: 'Temps', value: cmp.timeElapsedPct, color: EXPORT_COLORS.muted },
          { label: 'Travaux', value: cmp.actualPhysicalPct, color: EXPORT_COLORS.bar },
        ],
        { maxValue: 100, unit: '%' }
      );
    }
    if (cmp.budgetPlannedCumulative != null && s.synthesis.budget > 0) {
      y = ensureSpace(doc, y, 42);
      y = drawBarChart(
        doc,
        y,
        MARGIN,
        CONTENT_W,
        'Budget cumule planifie vs consomme (GNF)',
        [
          {
            label: 'Planifie',
            value: Math.round(cmp.budgetPlannedCumulative / 1_000_000),
            color: EXPORT_COLORS.muted,
          },
          {
            label: 'Consomme',
            value: Math.round(cmp.budgetConsumedCumulative / 1_000_000),
            color: EXPORT_COLORS.barSecondary,
          },
        ],
        { unit: 'M' }
      );
    }
  }

  y = ensureSpace(doc, y, 55);
  y = drawSectionTitle(doc, y, 'Synthese de la semaine', MARGIN);
  y = drawTable(doc, y, MARGIN, CONTENT_W, [58, CONTENT_W - 58], synthesisTableRows(s.synthesis));

  y = ensureSpace(doc, y, 50);
  y = drawBarChart(
    doc,
    y,
    MARGIN,
    CONTENT_W,
    'Avancement physique (%)',
    [
      { label: 'Debut', value: s.synthesis.physicalStart, color: EXPORT_COLORS.muted },
      { label: 'Fin', value: s.synthesis.physicalEnd, color: EXPORT_COLORS.bar },
      { label: 'Financier', value: s.synthesis.financialPct, color: EXPORT_COLORS.barSecondary },
    ],
    { maxValue: 100, unit: '%' }
  );

  y = ensureSpace(doc, y, 45);
  y = drawBarChart(
    doc,
    y,
    MARGIN,
    CONTENT_W,
    'Activite de la semaine',
    [
      { label: 'Fiches', value: payload.stats.dailyEntries, color: EXPORT_COLORS.bar },
      { label: 'Carburant', value: payload.stats.fuelLogs, color: [13, 148, 136] },
      { label: 'Bons BL', value: payload.stats.deliveryNotes, color: [124, 58, 237] },
      { label: 'HSE', value: payload.stats.hseMentions, color: [180, 83, 9] },
    ]
  );

  y = ensureSpace(doc, y, 30);
  y = drawSectionTitle(doc, y, 'Fiches journalieres', MARGIN);
  if (s.dailyRows.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...EXPORT_COLORS.text);
    doc.text('Aucune saisie quotidienne sur cette semaine.', MARGIN, y);
    y += 8;
  } else {
    const dailyTable: string[][] = [
      ['Date', 'Avanc.', 'Eff.', 'Meteo', 'Travaux / notes'],
      ...s.dailyRows.map((r) => [
        r.dateLabel,
        `${r.progressPct} %`,
        r.workers != null ? String(r.workers) : '-',
        r.weather ?? '-',
        r.notes,
      ]),
    ];
    y = drawTable(doc, y, MARGIN, CONTENT_W, [24, 16, 14, 22, CONTENT_W - 76], dailyTable);

    if (s.dailyRows.length >= 2) {
      y = ensureSpace(doc, y, 45);
      y = drawBarChart(
        doc,
        y,
        MARGIN,
        CONTENT_W,
        'Evolution avancement journalier (%)',
        s.dailyRows.map((r) => ({
          label: r.dateLabel.split(' ').slice(0, 2).join(' '),
          value: r.progressPct,
        })),
        { maxValue: 100, unit: '%' }
      );
    }

    if (s.avgWorkers != null) {
      y = ensureSpace(doc, y, 8);
      doc.setFontSize(8);
      doc.setTextColor(...EXPORT_COLORS.muted);
      doc.text(`Effectif moyen : ${s.avgWorkers} ouvrier(s) / jour`, MARGIN, y);
      y += 6;
    }
  }

  y = ensureSpace(doc, y, 30);
  y = drawSectionTitle(doc, y, 'Carburant', MARGIN);
  if (s.fuel.count === 0) {
    doc.setFontSize(9);
    doc.setTextColor(...EXPORT_COLORS.text);
    doc.text('Aucun releve carburant sur la periode.', MARGIN, y);
    y += 8;
  } else {
    y = drawTable(doc, y, MARGIN, CONTENT_W, [58, CONTENT_W - 58], [
      ['Indicateur', 'Valeur'],
      ['Total litres', `${formatPdfNumber(s.fuel.totalLiters)} L`],
      ['Cout total', formatGnfPdf(s.fuel.totalCost)],
      ['Releves / anomalies', `${s.fuel.count} / ${s.fuel.anomalies}`],
    ]);
    if (s.fuel.rows.length > 0) {
      y = ensureSpace(doc, y, 20);
      y = drawTable(
        doc,
        y,
        MARGIN,
        CONTENT_W,
        [40, 40, CONTENT_W - 80],
        [
          ['Date', 'Litres', 'Statut'],
          ...s.fuel.rows.slice(0, 8).map((r) => [
            r.dateLabel,
            formatPdfNumber(r.liters),
            r.isAnomaly ? 'Anomalie' : 'Normal',
          ]),
        ]
      );
    }
  }

  y = ensureSpace(doc, y, 30);
  y = drawSectionTitle(doc, y, 'Bons de livraison', MARGIN);
  if (s.deliveries.count === 0) {
    doc.setFontSize(9);
    doc.setTextColor(...EXPORT_COLORS.text);
    doc.text('Aucun bon de livraison sur la periode.', MARGIN, y);
    y += 8;
  } else {
    y = drawTable(doc, y, MARGIN, CONTENT_W, [58, CONTENT_W - 58], [
      ['Resume', 'Valeur'],
      ['Nombre de bons', String(s.deliveries.count)],
      ['Montant total', formatGnfPdf(s.deliveries.totalAmount)],
    ]);
    y = ensureSpace(doc, y, 20);
    y = drawTable(
      doc,
      y,
      MARGIN,
      CONTENT_W,
      [32, 38, 38, CONTENT_W - 108],
      [
        ['Reference', 'Fournisseur', 'Montant', 'Date'],
        ...s.deliveries.rows.map((r) => [
          r.reference,
          r.supplier,
          formatGnfPdf(r.amount),
          r.dateLabel,
        ]),
      ]
    );
  }

  y = ensureSpace(doc, y, 30);
  y = drawSectionTitle(doc, y, 'HSE et pieces jointes', MARGIN);
  y = drawTable(doc, y, MARGIN, CONTENT_W, [58, CONTENT_W - 58], [
    ['Element', 'Detail'],
    ['Mentions securite', `${s.hse.mentions} dans les fiches`],
    ['Documents deposes', `${s.hse.docsCount} (HSE / photos)`],
    ...s.hse.noteSnippets.map((n, i) => [`Note ${i + 1}`, n]),
  ]);

  if (s.comment) {
    y = ensureSpace(doc, y, 24);
    y = drawSectionTitle(doc, y, 'Commentaire chef de chantier', MARGIN);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...EXPORT_COLORS.text);
    for (const line of wrapLines(doc, s.comment, CONTENT_W)) {
      y = ensureSpace(doc, y, 6);
      doc.text(line, MARGIN, y);
      y += 5;
    }
  }

  drawPageFooter(doc, orgName);
  return doc;
}

export function downloadWeeklyReportPdf(payload: WeeklyReportExportPayload): void {
  const doc = buildWeeklyReportPdf(payload);
  const name = `${slugifyReportFilename(payload.title)}-${payload.isoWeek}.pdf`;
  doc.save(name);
}
