import { jsPDF } from 'jspdf';
import type { WeeklyReportExportPayload } from '@/lib/btp/weekly-report-export-types';
import { sectionsForExport, slugifyReportFilename } from '@/lib/btp/weekly-report-export-types';

const COLORS = {
  navy: [10, 25, 47] as [number, number, number],
  blue: [37, 99, 235] as [number, number, number],
  teal: [45, 212, 191] as [number, number, number],
  text: [30, 41, 59] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
};

const PAGE_W = 210;
const MARGIN = 16;
const CONTENT_W = PAGE_W - MARGIN * 2;

function wrapLines(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[];
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > 285) {
    doc.addPage();
    drawPageFooter(doc);
    return 24;
  }
  return y;
}

function drawPageFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...COLORS.muted);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, 287, PAGE_W - MARGIN, 287);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text('KonaData — Rapport de chantier hebdomadaire', MARGIN, 292);
    doc.text(`Page ${i} / ${pageCount}`, PAGE_W - MARGIN, 292, { align: 'right' });
  }
}

export function buildWeeklyReportPdf(payload: WeeklyReportExportPayload): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const generatedAt =
    payload.generatedAt ??
    new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });

  doc.setFillColor(...COLORS.navy);
  doc.rect(0, 0, PAGE_W, 42, 'F');
  doc.setFillColor(...COLORS.blue);
  doc.rect(0, 40, PAGE_W, 2, 'F');

  doc.setTextColor(34, 211, 238);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('KONADATA · BTP', MARGIN, 14);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(17);
  const titleLines = wrapLines(doc, payload.title, CONTENT_W);
  doc.text(titleLines, MARGIN, 24);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.teal);
  doc.text(payload.subtitle, MARGIN, 34);

  let y = 52;
  doc.setTextColor(...COLORS.muted);
  doc.setFontSize(9);
  const meta = [
    payload.orgName ? `Organisation : ${payload.orgName}` : null,
    `Chantier : ${payload.scopeLabel}`,
    `Semaine : ${payload.isoWeek}`,
    `Généré le ${generatedAt}`,
  ].filter(Boolean) as string[];
  for (const line of meta) {
    doc.text(line, MARGIN, y);
    y += 5;
  }

  y += 4;
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(MARGIN, y, CONTENT_W, 18, 2, 2, 'F');
  doc.setTextColor(...COLORS.blue);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Indicateurs de la semaine', MARGIN + 4, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.text);
  doc.text(
    `${payload.stats.dailyEntries} fiche(s) journalière(s)  ·  ${payload.stats.fuelLogs} relevé(s) carburant  ·  ${payload.stats.deliveryNotes} bon(s) de livraison`,
    MARGIN + 4,
    y + 14
  );
  y += 26;

  for (const section of sectionsForExport(payload.sections)) {
    y = ensureSpace(doc, y, 16);
    doc.setFillColor(...COLORS.blue);
    doc.rect(MARGIN, y - 4, 3, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.blue);
    doc.text(section.heading.toUpperCase(), MARGIN + 6, y + 2);
    y += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.text);

    for (const line of section.lines) {
      const chunks = wrapLines(doc, line, CONTENT_W - 4);
      for (const chunk of chunks) {
        y = ensureSpace(doc, y, 6);
        doc.text(chunk, MARGIN + 2, y);
        y += 5.2;
      }
      y += 1.5;
    }
    y += 4;
  }

  drawPageFooter(doc);
  return doc;
}

export function downloadWeeklyReportPdf(payload: WeeklyReportExportPayload): void {
  const doc = buildWeeklyReportPdf(payload);
  const name = `${slugifyReportFilename(payload.title)}-${payload.isoWeek}.pdf`;
  doc.save(name);
}
