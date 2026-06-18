import { jsPDF } from 'jspdf';
import type { WeeklyReportExportPayload } from '@/lib/btp/weekly-report-export-types';
import { displayOrgName, slugifyReportFilename } from '@/lib/btp/weekly-report-export-types';
import {
  EXPORT_COLORS,
  sanitizePdfText,
  drawSectionTitle,
  drawTable,
  drawBarChart,
  synthesisTableRows,
  identificationTableRows,
  formatGnfPdf,
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
    drawPageFooter(doc);
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
    doc.text(sanitizePdfText(`${orgName} — Rapport hebdomadaire`), MARGIN, 292);
    doc.text(`Propulse par KonaData · Page ${i}/${pageCount}`, PAGE_W - MARGIN, 292, {
      align: 'right',
    });
  }
}

export function buildWeeklyReportPdf(payload: WeeklyReportExportPayload): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const orgName = displayOrgName(payload.orgName);
  const { structured: s } = payload;
  const generatedAt =
    payload.generatedAt ??
    new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });

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
  doc.text(sanitizePdfText(`Genere le ${generatedAt} · ${payload.isoWeek}`), MARGIN, y);
  y += 10;

  y = ensureSpace(doc, y, 50);
  y = drawSectionTitle(doc, y, 'Identification', MARGIN);
  y = drawTable(doc, y, MARGIN, CONTENT_W, [52, CONTENT_W - 52], identificationTableRows(orgName, s.identification));

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
      ['Total litres', `${s.fuel.totalLiters.toLocaleString('fr-FR')} L`],
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
            r.liters.toLocaleString('fr-FR'),
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
