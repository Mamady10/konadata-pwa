import { jsPDF } from 'jspdf';
import type {
  WeeklyReportExportPayload,
  WeeklyReportImage,
  WeeklyReportPhoto,
  WeeklyReportSignatories,
} from '@/lib/btp/weekly-report-export-types';
import {
  displayOrgName,
  formatReportGeneratedAt,
  slugifyReportFilename,
  UPCOMING_EVENT_LABELS,
} from '@/lib/btp/weekly-report-export-types';
import {
  EXPORT_COLORS,
  drawSummaryCards,
  drawTaskProgressBars,
  fitImage,
  summaryCards,
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
} from '@/lib/btp/weekly-report-export-render';

const PAGE_W = 210;
const MARGIN = 16;
const CONTENT_W = PAGE_W - MARGIN * 2;
const RUNNING_HEADER_H = 15;
const CONTENT_TOP = RUNNING_HEADER_H + 11;
const PAGE_BOTTOM = 278;
const COVER_LOGO_MAX_W = 52;
const COVER_LOGO_MAX_H = 34;
const HEADER_LOGO_MAX_W = 30;
const HEADER_LOGO_MAX_H = 11;

function wrapLines(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(sanitizePdfText(text), maxWidth) as string[];
}

function firstLine(doc: jsPDF, text: string, maxWidth: number): string {
  const lines = wrapLines(doc, text, maxWidth);
  if (lines.length <= 1) return lines[0] ?? '';
  return `${lines[0].slice(0, -3).trimEnd()}...`;
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_BOTTOM) {
    doc.addPage();
    return CONTENT_TOP;
  }
  return y;
}

function imageDataUrl(img: WeeklyReportImage): string {
  return `data:image/${img.format === 'JPEG' ? 'jpeg' : 'png'};base64,${img.base64}`;
}

/**
 * Logo sans cadre, ajusté (ratio conservé) dans la zone maxW × maxH, centré verticalement.
 * Retourne la largeur réellement occupée (0 si l'image est illisible).
 */
function drawLogo(
  doc: jsPDF,
  logo: WeeklyReportImage,
  x: number,
  y: number,
  maxW: number,
  maxH: number,
  align: 'left' | 'right' = 'left'
): number {
  const fit = fitImage(logo.width, logo.height, maxW, maxH);
  const left = align === 'right' ? x + maxW - fit.w : x;
  try {
    doc.addImage(imageDataUrl(logo), logo.format, left, y + fit.dy, fit.w, fit.h);
    return fit.w;
  } catch {
    return 0;
  }
}

function logoFitWidth(logo: WeeklyReportImage | null, maxW: number, maxH: number): number {
  return logo ? fitImage(logo.width, logo.height, maxW, maxH).w : 0;
}

/** Bandeau rappelant entreprise, chantier et période sur les pages suivant la couverture. */
function drawRunningHeaders(
  doc: jsPDF,
  orgName: string,
  scopeLabel: string,
  periodLabel: string,
  logo: WeeklyReportImage | null
) {
  const pageCount = doc.getNumberOfPages();
  const half = CONTENT_W / 2 - 4;
  const logoW = logoFitWidth(logo, HEADER_LOGO_MAX_W, HEADER_LOGO_MAX_H);
  const textX = logoW > 0 ? MARGIN + logoW + 3 : MARGIN;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const scopeW = doc.getTextWidth(sanitizePdfText(scopeLabel));
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const periodW = doc.getTextWidth(sanitizePdfText(periodLabel));
  const rightW = Math.min(half, Math.max(scopeW, periodW));
  const orgW = CONTENT_W - (textX - MARGIN) - rightW - 6;
  for (let i = 2; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(...EXPORT_COLORS.navy);
    doc.rect(0, 0, PAGE_W, RUNNING_HEADER_H, 'F');
    doc.setFillColor(...EXPORT_COLORS.blue);
    doc.rect(0, RUNNING_HEADER_H, PAGE_W, 1, 'F');
    if (logo) drawLogo(doc, logo, MARGIN, 2, HEADER_LOGO_MAX_W, HEADER_LOGO_MAX_H);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(firstLine(doc, orgName.toUpperCase(), orgW), textX, 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...EXPORT_COLORS.teal);
    doc.text('Rapport de chantier', textX, 11.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(firstLine(doc, scopeLabel, half), PAGE_W - MARGIN, 7, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(203, 213, 225);
    doc.text(firstLine(doc, periodLabel, half), PAGE_W - MARGIN, 11.5, { align: 'right' });
  }
}

/** Photos en grille de 2 colonnes avec légende et date. */
function drawPhotoGrid(doc: jsPDF, startY: number, photos: WeeklyReportPhoto[]): number {
  const gap = 6;
  const cellW = (CONTENT_W - gap) / 2;
  const imgH = 62;
  const cellH = imgH + 10;
  let y = startY;

  for (let i = 0; i < photos.length; i += 2) {
    y = ensureSpace(doc, y, cellH + 2);
    photos.slice(i, i + 2).forEach((photo, j) => {
      const x = MARGIN + j * (cellW + gap);
      doc.setFillColor(...EXPORT_COLORS.rowAlt);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.roundedRect(x, y, cellW, cellH, 1.5, 1.5, 'FD');
      const fit = fitImage(photo.width, photo.height, cellW - 4, imgH - 2);
      try {
        doc.addImage(imageDataUrl(photo), photo.format, x + 2 + fit.dx, y + 2 + fit.dy, fit.w, fit.h);
      } catch {
        doc.setFontSize(8);
        doc.setTextColor(...EXPORT_COLORS.muted);
        doc.text('Photo illisible', x + cellW / 2, y + imgH / 2, { align: 'center' });
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...EXPORT_COLORS.text);
      doc.text(firstLine(doc, photo.caption, cellW - 30), x + 3, y + imgH + 5.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...EXPORT_COLORS.muted);
      doc.text(sanitizePdfText(photo.dateLabel), x + cellW - 3, y + imgH + 5.5, { align: 'right' });
    });
    y += cellH + 4;
  }
  return y;
}

function drawSignatureBlock(doc: jsPDF, startY: number, signatories: WeeklyReportSignatories): number {
  const gap = 6;
  const w = (CONTENT_W - gap) / 2;
  const h = 36;
  const y = ensureSpace(doc, startY, h + 10);
  const yTitle = drawSectionTitle(doc, y, 'Validation', MARGIN);
  const boxes = [
    { title: 'Établi par (chef de chantier)', name: signatories.preparedBy },
    { title: "Visa du maître d'ouvrage", name: signatories.moa },
  ];
  boxes.forEach((b, i) => {
    const x = MARGIN + i * (w + gap);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, yTitle, w, h, 1.5, 1.5, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...EXPORT_COLORS.blue);
    doc.text(sanitizePdfText(b.title), x + 3, yTitle + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...EXPORT_COLORS.text);
    doc.text(firstLine(doc, `Nom : ${b.name ?? ''}`, w - 6), x + 3, yTitle + 13);
    doc.text('Date :', x + 3, yTitle + 20);
    doc.text('Signature :', x + 3, yTitle + 27);
    doc.setDrawColor(226, 232, 240);
    doc.line(x + 14, yTitle + 20.5, x + w - 4, yTitle + 20.5);
  });
  return yTitle + h + 6;
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
    doc.text(sanitizePdfText(`${orgName} - Rapport périodique`), MARGIN, 292);
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
  const generatedAt = sanitizePdfText(formatReportGeneratedAt(payload.generatedAt));
  const newPage = () => {
    doc.addPage();
    return CONTENT_TOP;
  };
  const table = (y: number, widths: number[], rows: string[][]): number =>
    drawTable(doc, y, MARGIN, CONTENT_W, widths, rows, { pageBottom: PAGE_BOTTOM, newPage });

  const logo = s.logo ?? null;
  const coverLogoW = logoFitWidth(logo, COVER_LOGO_MAX_W, COVER_LOGO_MAX_H);
  const coverTextW = coverLogoW > 0 ? CONTENT_W - coverLogoW - 6 : CONTENT_W;
  const titleMatch = payload.title.match(/^(Rapport de chantier \S+) — (.+)$/);
  const reportKind = titleMatch?.[1] ?? 'Rapport de chantier';
  const siteTitle = titleMatch?.[2] ?? payload.title;

  doc.setFillColor(...EXPORT_COLORS.navy);
  doc.rect(0, 0, PAGE_W, 48, 'F');
  doc.setFillColor(...EXPORT_COLORS.blue);
  doc.rect(0, 46, PAGE_W, 2, 'F');
  if (logo) {
    drawLogo(
      doc,
      logo,
      PAGE_W - MARGIN - COVER_LOGO_MAX_W,
      (46 - COVER_LOGO_MAX_H) / 2,
      COVER_LOGO_MAX_W,
      COVER_LOGO_MAX_H,
      'right'
    );
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(firstLine(doc, orgName.toUpperCase(), coverTextW), MARGIN, 16);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...EXPORT_COLORS.teal);
  doc.text(sanitizePdfText(`${reportKind} - BTP`), MARGIN, 24);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(firstLine(doc, siteTitle, coverTextW), MARGIN, 33);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(firstLine(doc, payload.subtitle, coverTextW), MARGIN, 40);

  let y = 58;
  doc.setTextColor(...EXPORT_COLORS.muted);
  doc.setFontSize(8);
  doc.text(sanitizePdfText(`Généré le ${generatedAt} - ${payload.periodLabel}`), MARGIN, y);
  y += 10;

  y = drawSectionTitle(doc, y, 'Résumé', MARGIN);
  y = drawSummaryCards(doc, y, MARGIN, CONTENT_W, summaryCards(s));

  y = ensureSpace(doc, y, 50);
  y = drawSectionTitle(doc, y, 'Identification', MARGIN);
  y = table(y, [52, CONTENT_W - 52], identificationTableRows(orgName, s.identification));

  const cmp = s.comparison;
  if (cmp) {
    y = ensureSpace(doc, y, 70);
    y = drawSectionTitle(doc, y, 'Analyse planifie vs reel', MARGIN);
    if (comparisonMetricsTableRows(cmp).length > 1) {
      y = table(y, [42, 38, 38, CONTENT_W - 118], comparisonMetricsTableRows(cmp));
    }
    const taskRows = cmp.taskRows ?? [];
    if (taskRows.length > 0) {
      const blockH = 13 + taskRows.length * 10;
      y = ensureSpace(doc, y, blockH <= PAGE_BOTTOM - CONTENT_TOP ? blockH : 30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...EXPORT_COLORS.muted);
      doc.text(sanitizePdfText('Avancement par tâche (réalisé / prévu)'), MARGIN, y);
      y += 6;
      y = drawTaskProgressBars(doc, y, MARGIN, CONTENT_W, taskRows, {
        pageBottom: PAGE_BOTTOM,
        newPage,
      });
    } else {
      const mRows = milestoneTableRows(cmp);
      if (mRows.length > 0) {
        y = ensureSpace(doc, y, 24);
        y = table(y, [36, 28, 18, 48, 22], mRows);
      }
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
          ? `${cmp.plannedRefLabel} — Courbe S planifie vs realise`
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

  if (s.upcoming && s.upcoming.tasks.length > 0) {
    y = ensureSpace(doc, y, 34);
    y = drawSectionTitle(doc, y, `Prévisions - ${s.upcoming.label}`, MARGIN);
    y = table(y, [62, 42, 26, 26, CONTENT_W - 156], [
      ['Tâche', 'Période', 'Événement', 'Prévu fin', 'Actuel'],
      ...s.upcoming.tasks.map((t) => [
        t.name,
        `${t.startDate.split('-').reverse().join('/')} -> ${t.finishDate.split('-').reverse().join('/')}`,
        UPCOMING_EVENT_LABELS[t.event],
        `${t.plannedPctAtEnd} %`,
        t.actualPct != null ? `${t.actualPct} %` : '-',
      ]),
    ]);
  }

  y = ensureSpace(doc, y, 55);
  y = drawSectionTitle(doc, y, 'Synthese de la semaine', MARGIN);
  y = table(y, [58, CONTENT_W - 58], synthesisTableRows(s.synthesis, s.hideFinancials));

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
      ...(s.hideFinancials
        ? []
        : [{ label: 'Financier', value: s.synthesis.financialPct, color: EXPORT_COLORS.barSecondary }]),
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
    y = table(y, [24, 16, 14, 22, CONTENT_W - 76], dailyTable);

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
    y = table(y, [58, CONTENT_W - 58], [
      ['Indicateur', 'Valeur'],
      ['Total litres', `${formatPdfNumber(s.fuel.totalLiters)} L`],
      ...(s.hideFinancials ? [] : [['Cout total', formatGnfPdf(s.fuel.totalCost)]]),
      ['Releves / anomalies', `${s.fuel.count} / ${s.fuel.anomalies}`],
    ]);
    if (s.fuel.rows.length > 0) {
      y = ensureSpace(doc, y, 20);
      y = table(
        y,
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
    y = table(y, [58, CONTENT_W - 58], [
      ['Resume', 'Valeur'],
      ['Nombre de bons', String(s.deliveries.count)],
      ...(s.hideFinancials ? [] : [['Montant total', formatGnfPdf(s.deliveries.totalAmount)]]),
    ]);
    y = ensureSpace(doc, y, 20);
    y = s.hideFinancials
      ? table(
          y,
          [40, 50, CONTENT_W - 90],
          [
            ['Reference', 'Fournisseur', 'Date'],
            ...s.deliveries.rows.map((r) => [r.reference, r.supplier, r.dateLabel]),
          ]
        )
      : table(
          y,
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
  y = table(y, [58, CONTENT_W - 58], [
    ['Element', 'Detail'],
    ['Mentions securite', `${s.hse.mentions} dans les fiches`],
    ['Documents deposes', `${s.hse.docsCount} (HSE / photos)`],
    ...s.hse.noteSnippets.map((n, i) => [`Note ${i + 1}`, n]),
  ]);

  const photos = s.photos ?? [];
  if (photos.length > 0) {
    y = ensureSpace(doc, y, 90);
    y = drawSectionTitle(doc, y, 'Photos du chantier', MARGIN);
    y = drawPhotoGrid(doc, y, photos);
  }

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

  drawSignatureBlock(doc, y + 4, s.signatories ?? { preparedBy: null, moa: s.identification.moaRecipient ?? null });

  drawRunningHeaders(doc, orgName, payload.scopeLabel, payload.periodLabel, logo);
  drawPageFooter(doc, orgName);
  return doc;
}

export function downloadWeeklyReportPdf(payload: WeeklyReportExportPayload): void {
  const doc = buildWeeklyReportPdf(payload);
  const periodToken = payload.periodValue || payload.isoWeek || new Date().toISOString().slice(0, 10);
  const name = `${slugifyReportFilename(payload.title)}-${periodToken}.pdf`;
  doc.save(name);
}
