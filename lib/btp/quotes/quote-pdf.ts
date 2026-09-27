import { jsPDF } from 'jspdf';
import { EXPORT_COLORS, fitImage, sanitizePdfText } from '@/lib/btp/weekly-report-export-render';
import { slugifyReportFilename, type WeeklyReportImage } from '@/lib/btp/weekly-report-export-types';
import { amountInWordsGnf } from '@/lib/btp/quotes/amount-in-words';
import {
  computeQuoteTotals,
  formatQuoteAmount,
  formatQuoteQuantity,
  QUOTE_SECTION_LABELS,
  quoteDisplayNumber,
  quoteValidUntil,
  type BtpQuote,
  type QuoteLine,
} from '@/lib/btp/quotes/quote-types';

export interface QuotePdfAssets {
  orgName: string;
  logo: WeeklyReportImage | null;
}

type Rgb = [number, number, number];
type Align = 'left' | 'center' | 'right';

const PAGE_W = 210;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;
const RUNNING_HEADER_H = 14;
const CONTENT_TOP = RUNNING_HEADER_H + 8;
const PAGE_BOTTOM = 280;
const COLS = [10, 74, 18, 20, 28, 32];
const COL_ALIGN: Align[] = ['center', 'left', 'center', 'right', 'right', 'right'];
const HEADERS = ['N°', 'Désignation', 'Unité', 'Quantité', 'PU (GNF)', 'Montant (GNF)'];
const CELL_PAD = 1.6;
const LINE_H = 3.9;
const SECTION_BG: Rgb = [226, 232, 240];
const SUBTOTAL_BG: Rgb = [241, 245, 249];
const BORDER: Rgb = [148, 163, 184];

function t(text: string): string {
  return sanitizePdfText(String(text ?? '').replace(/œ/g, 'oe').replace(/Œ/g, 'OE'));
}

function frDate(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10).split('-').reverse().join('/');
}

function imageDataUrl(img: WeeklyReportImage): string {
  return `data:image/${img.format === 'JPEG' ? 'jpeg' : 'png'};base64,${img.base64}`;
}

function drawLogo(doc: jsPDF, logo: WeeklyReportImage, x: number, y: number, maxW: number, maxH: number, align: 'left' | 'right') {
  const fit = fitImage(logo.width, logo.height, maxW, maxH);
  const left = align === 'right' ? x + maxW - fit.w : x;
  try {
    doc.addImage(imageDataUrl(logo), logo.format, left, y + fit.dy, fit.w, fit.h);
    return fit.w;
  } catch {
    return 0;
  }
}

function colX(index: number): number {
  return MARGIN + COLS.slice(0, index).reduce((s, w) => s + w, 0);
}

function isPrintableLine(line: QuoteLine): boolean {
  return Boolean(line.designation.trim()) || line.quantity > 0 || line.unitPrice > 0;
}

export function buildQuotePdf(quote: BtpQuote, assets: QuotePdfAssets): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const totals = computeQuoteTotals(quote.lots, quote);
  const numberLabel = quoteDisplayNumber(quote);
  const validUntil = quoteValidUntil(quote.quoteDate, quote.validityDays);
  let tableHeaderActive = false;

  const drawHeaderRow = (y: number): number => {
    const h = 7;
    doc.setFillColor(...EXPORT_COLORS.headerBg);
    doc.rect(MARGIN, y, CONTENT_W, h, 'F');
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.2);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...EXPORT_COLORS.blue);
    HEADERS.forEach((label, i) => {
      doc.rect(colX(i), y, COLS[i], h, 'S');
      const align = i === 1 ? 'left' : 'center';
      const x = align === 'left' ? colX(i) + CELL_PAD : colX(i) + COLS[i] / 2;
      doc.text(t(label), x, y + 4.7, { align });
    });
    return y + h;
  };

  const ensure = (y: number, needed: number): number => {
    if (y + needed <= PAGE_BOTTOM) return y;
    doc.addPage();
    return tableHeaderActive ? drawHeaderRow(CONTENT_TOP) : CONTENT_TOP;
  };

  const drawLineRow = (y: number, cells: string[]): number => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const wrapped = cells.map((c, i) => doc.splitTextToSize(t(c), COLS[i] - CELL_PAD * 2) as string[]);
    const lines = Math.max(1, ...wrapped.map((w) => w.length));
    const h = Math.max(6, lines * LINE_H + 2.4);
    y = ensure(y, h);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.2);
    doc.setTextColor(...EXPORT_COLORS.text);
    wrapped.forEach((w, i) => {
      doc.rect(colX(i), y, COLS[i], h, 'S');
      const align = COL_ALIGN[i];
      const x =
        align === 'left'
          ? colX(i) + CELL_PAD
          : align === 'right'
            ? colX(i) + COLS[i] - CELL_PAD
            : colX(i) + COLS[i] / 2;
      doc.text(w, x, y + 4.1, { align });
    });
    return y + h;
  };

  /** Ligne fusionnée : libellé sur les 5 premières colonnes, montant dans la dernière. */
  const drawSpanRow = (
    y: number,
    label: string,
    amount: string | null,
    style: { fill: Rgb; text: Rgb; align: Align; bold?: boolean; size?: number; h?: number }
  ): number => {
    const h = style.h ?? 6.5;
    y = ensure(y, h);
    const labelW = amount == null ? CONTENT_W : CONTENT_W - COLS[5];
    doc.setFillColor(...style.fill);
    doc.rect(MARGIN, y, CONTENT_W, h, 'F');
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.2);
    doc.rect(MARGIN, y, labelW, h, 'S');
    if (amount != null) doc.rect(MARGIN + labelW, y, COLS[5], h, 'S');
    doc.setFont('helvetica', style.bold === false ? 'normal' : 'bold');
    doc.setFontSize(style.size ?? 8.5);
    doc.setTextColor(...style.text);
    const labelX =
      style.align === 'center'
        ? MARGIN + labelW / 2
        : style.align === 'right'
          ? MARGIN + labelW - CELL_PAD
          : MARGIN + CELL_PAD;
    const text = doc.splitTextToSize(t(label), labelW - CELL_PAD * 2)[0] as string;
    doc.text(text, labelX, y + h / 2 + 1.3, { align: style.align });
    if (amount != null) {
      doc.text(t(amount), MARGIN + CONTENT_W - CELL_PAD, y + h / 2 + 1.3, { align: 'right' });
    }
    return y + h;
  };

  const drawBlockTitle = (y: number, title: string): number => {
    y = ensure(y, 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(...EXPORT_COLORS.navy);
    const lines = doc.splitTextToSize(t(title.toUpperCase()), CONTENT_W) as string[];
    doc.text(lines, PAGE_W / 2, y + 4, { align: 'center' });
    return y + 4 + lines.length * 5 + 2;
  };

  // ─── En-tête de la première page ──────────────────────────────────
  const logo = assets.logo;
  doc.setFillColor(...EXPORT_COLORS.navy);
  doc.rect(0, 0, PAGE_W, 42, 'F');
  doc.setFillColor(...EXPORT_COLORS.blue);
  doc.rect(0, 40, PAGE_W, 2, 'F');
  const logoW = logo ? drawLogo(doc, logo, PAGE_W - MARGIN - 50, 6, 50, 30, 'right') : 0;
  const headTextW = CONTENT_W - (logoW > 0 ? logoW + 6 : 0);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text((doc.splitTextToSize(t(assets.orgName.toUpperCase()), headTextW) as string[])[0], MARGIN, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...EXPORT_COLORS.teal);
  doc.text(t('Devis estimatif'), MARGIN, 21);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(t(`N° ${numberLabel}`), MARGIN, 29);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(
    t(`Date : ${frDate(quote.quoteDate)}${validUntil ? ` - Valable jusqu'au ${frDate(validUntil)}` : ''}`),
    MARGIN,
    35.5
  );

  // Blocs client / projet
  let y = 48;
  const boxW = (CONTENT_W - 6) / 2;
  const clientLines = [quote.clientName, quote.clientContact, quote.clientAddress].filter(Boolean);
  const projectLines = [quote.title, quote.subtitle, quote.location ? `Lieu : ${quote.location}` : ''].filter(Boolean);
  doc.setFontSize(9);
  const wrapBox = (lines: string[]) =>
    lines.flatMap((l, idx) => {
      doc.setFont('helvetica', idx === 0 ? 'bold' : 'normal');
      return (doc.splitTextToSize(t(l), boxW - 6) as string[]).map((text) => ({ text, bold: idx === 0 }));
    });
  const clientWrapped = wrapBox(clientLines.length > 0 ? clientLines : ['-']);
  const projectWrapped = wrapBox(projectLines);
  const boxH = Math.max(clientWrapped.length, projectWrapped.length) * 4.4 + 11;
  [
    { title: 'Client', lines: clientWrapped, x: MARGIN },
    { title: 'Projet', lines: projectWrapped, x: MARGIN + boxW + 6 },
  ].forEach((box) => {
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(...EXPORT_COLORS.rowAlt);
    doc.setLineWidth(0.3);
    doc.roundedRect(box.x, y, boxW, boxH, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...EXPORT_COLORS.blue);
    doc.text(t(box.title.toUpperCase()), box.x + 3, y + 5.5);
    doc.setFontSize(9);
    doc.setTextColor(...EXPORT_COLORS.text);
    box.lines.forEach((line, i) => {
      doc.setFont('helvetica', line.bold ? 'bold' : 'normal');
      doc.text(line.text, box.x + 3, y + 11 + i * 4.4);
    });
  });
  y += boxH + 8;

  // ─── Lots détaillés (un lot par page) ─────────────────────────────
  let firstLot = true;
  totals.lots.forEach((lt, lotIndex) => {
    if (lt.lot.kind !== 'detailed') return;
    if (!firstLot) {
      doc.addPage();
      y = CONTENT_TOP;
    }
    firstLot = false;
    tableHeaderActive = false;
    y = drawBlockTitle(y, `Lot ${lotIndex + 1} : ${lt.lot.title}`);
    y = drawHeaderRow(y);
    tableHeaderActive = true;

    let lineNo = 0;
    for (const section of lt.sections) {
      const lines = section.lines.filter(isPrintableLine);
      if (lines.length === 0) continue;
      y = drawSpanRow(y, QUOTE_SECTION_LABELS[section.section].toUpperCase(), null, {
        fill: SECTION_BG,
        text: EXPORT_COLORS.navy,
        align: 'center',
      });
      for (const line of lines) {
        lineNo += 1;
        const amount = line.quantity * line.unitPrice;
        y = drawLineRow(y, [
          String(lineNo),
          line.designation,
          line.unit,
          line.quantity > 0 ? formatQuoteQuantity(line.quantity) : '-',
          line.unitPrice > 0 ? formatQuoteAmount(line.unitPrice) : '-',
          amount > 0 ? formatQuoteAmount(amount) : '-',
        ]);
      }
      y = drawSpanRow(y, `Sous-total ${QUOTE_SECTION_LABELS[section.section]}`, formatQuoteAmount(section.total), {
        fill: SUBTOTAL_BG,
        text: EXPORT_COLORS.text,
        align: 'right',
      });
    }
    y = drawSpanRow(y, `TOTAL ${lt.lot.title.toUpperCase()}`, formatQuoteAmount(lt.unitTotal), {
      fill: EXPORT_COLORS.navy,
      text: [255, 255, 255],
      align: 'center',
      size: 9.5,
      h: 8,
    });
    tableHeaderActive = false;
    if (lt.lot.quantity !== 1) {
      y = ensure(y, 8);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(...EXPORT_COLORS.muted);
      doc.text(
        t(
          `Lot compté ${formatQuoteQuantity(lt.lot.quantity)} fois au récapitulatif : ${formatQuoteQuantity(lt.lot.quantity)} x ${formatQuoteAmount(lt.unitTotal)} = ${formatQuoteAmount(lt.recapTotal)} GNF`
        ),
        MARGIN,
        y + 5
      );
      y += 8;
    }
  });

  // ─── Récapitulatif ────────────────────────────────────────────────
  if (!firstLot) {
    doc.addPage();
    y = CONTENT_TOP;
  }
  tableHeaderActive = false;
  y = drawBlockTitle(y, 'Récapitulatif');
  y = drawHeaderRow(y);
  tableHeaderActive = true;
  totals.lots.forEach((lt, i) => {
    y = drawLineRow(y, [
      String(i + 1),
      lt.lot.title,
      lt.lot.unit,
      formatQuoteQuantity(lt.lot.quantity),
      lt.unitTotal > 0 ? formatQuoteAmount(lt.unitTotal) : '-',
      lt.recapTotal > 0 ? formatQuoteAmount(lt.recapTotal) : '-',
    ]);
  });
  const totalStyle = { fill: SUBTOTAL_BG, text: EXPORT_COLORS.text, align: 'right' as Align, size: 9 };
  if (quote.vatEnabled) {
    y = drawSpanRow(y, 'TOTAL HT', formatQuoteAmount(totals.totalHt), totalStyle);
    y = drawSpanRow(y, `TVA ${formatQuoteQuantity(quote.vatRate)} %`, formatQuoteAmount(totals.vatAmount), {
      ...totalStyle,
      bold: false,
    });
  }
  y = drawSpanRow(
    y,
    quote.vatEnabled ? 'TOTAL TTC' : 'TOTAL',
    formatQuoteAmount(totals.totalTtc),
    { fill: EXPORT_COLORS.navy, text: [255, 255, 255], align: 'right', size: 10, h: 8.5 }
  );
  tableHeaderActive = false;

  y += 6;
  doc.setFontSize(9);
  const words = doc.splitTextToSize(
    t(
      `Arrêté le présent devis à la somme de : ${amountInWordsGnf(totals.totalTtc)} (${formatQuoteAmount(totals.totalTtc)} GNF)${quote.vatEnabled ? ' TTC' : ''}.`
    ),
    CONTENT_W
  ) as string[];
  y = ensure(y, words.length * 4.6 + 4);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...EXPORT_COLORS.text);
  doc.text(words, MARGIN, y + 3);
  y += words.length * 4.6 + 3;

  const conditions = [
    validUntil ? `Devis valable ${quote.validityDays} jours, jusqu'au ${frDate(validUntil)}.` : '',
    !quote.vatEnabled ? 'Montants hors TVA.' : '',
    quote.notes,
  ].filter(Boolean);
  if (conditions.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...EXPORT_COLORS.muted);
    const wrapped = conditions.flatMap((c) => doc.splitTextToSize(t(c), CONTENT_W) as string[]);
    y = ensure(y, wrapped.length * 4 + 4);
    doc.text(wrapped, MARGIN, y + 3);
    y += wrapped.length * 4 + 4;
  }

  // Signatures
  const sigH = 32;
  y = ensure(y + 4, sigH + 4);
  const sigW = (CONTENT_W - 8) / 2;
  [
    { title: 'Le client', sub: 'Bon pour accord - date et signature' },
    { title: "L'entreprise", sub: assets.orgName },
  ].forEach((box, i) => {
    const x = MARGIN + i * (sigW + 8);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, sigW, sigH, 1.5, 1.5, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...EXPORT_COLORS.blue);
    doc.text(t(box.title), x + 3, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...EXPORT_COLORS.muted);
    doc.text((doc.splitTextToSize(t(box.sub), sigW - 6) as string[])[0], x + 3, y + 11);
  });

  // ─── Bandeau des pages suivantes + pied de page ───────────────────
  const pageCount = doc.getNumberOfPages();
  const smallLogoW = logo ? fitImage(logo.width, logo.height, 26, 9).w : 0;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    if (i > 1) {
      doc.setFillColor(...EXPORT_COLORS.navy);
      doc.rect(0, 0, PAGE_W, RUNNING_HEADER_H, 'F');
      doc.setFillColor(...EXPORT_COLORS.blue);
      doc.rect(0, RUNNING_HEADER_H, PAGE_W, 0.8, 'F');
      if (logo) drawLogo(doc, logo, MARGIN, 2.5, 26, 9, 'left');
      const textX = MARGIN + (smallLogoW > 0 ? smallLogoW + 3 : 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(255, 255, 255);
      doc.text((doc.splitTextToSize(t(assets.orgName.toUpperCase()), 90) as string[])[0], textX, 8.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(203, 213, 225);
      doc.text(
        (doc.splitTextToSize(t(`Devis N° ${numberLabel} - ${quote.title}`), 88) as string[])[0],
        PAGE_W - MARGIN,
        8.5,
        { align: 'right' }
      );
    }
    doc.setDrawColor(...EXPORT_COLORS.muted);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, 287, PAGE_W - MARGIN, 287);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...EXPORT_COLORS.muted);
    doc.text(t(`${assets.orgName} - Devis N° ${numberLabel}`), MARGIN, 292);
    doc.text(t(`Page ${i}/${pageCount}`), PAGE_W - MARGIN, 292, { align: 'right' });
  }

  return doc;
}

export function quoteFileBaseName(quote: Pick<BtpQuote, 'number' | 'version' | 'title'>): string {
  const version = quote.version > 1 ? `-V${quote.version}` : '';
  return `Devis-${quote.number}${version}-${slugifyReportFilename(quote.title)}`;
}

export function downloadQuotePdf(quote: BtpQuote, assets: QuotePdfAssets) {
  buildQuotePdf(quote, assets).save(`${quoteFileBaseName(quote)}.pdf`);
}
