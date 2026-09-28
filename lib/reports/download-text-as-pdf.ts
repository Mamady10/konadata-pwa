import type { jsPDF } from 'jspdf';

export function slugifyReportFilename(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'rapport'
  );
}

export interface DownloadTextPdfOptions {
  title: string;
  content: string;
  fileName?: string;
  metaLine?: string;
  archiveRef?: string | null;
}

type Rgb = [number, number, number];

const C = {
  navy: [10, 25, 47] as Rgb,
  blue: [37, 99, 235] as Rgb,
  teal: [45, 212, 191] as Rgb,
  text: [30, 41, 59] as Rgb,
  muted: [100, 116, 139] as Rgb,
  rule: [226, 232, 240] as Rgb,
  headerBg: [239, 246, 255] as Rgb,
  rowAlt: [248, 250, 252] as Rgb,
  headerSub: [191, 219, 254] as Rgb,
};

const MARGIN = 16;
const BODY_SIZE = 10;
const LINE_FACTOR = 0.44;

/** Texte compatible avec les polices standard de jsPDF (WinAnsi), en conservant les espaces. */
function pdfSafe(text: string): string {
  return String(text ?? '')
    .normalize('NFC')
    .replace(/[\u202F\u00A0\u2007\u2009]/g, ' ')
    .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/[\u2192\u21D2\u279C]/g, '->')
    .replace(/\u2190/g, '<-')
    .replace(/\u2265/g, '>=')
    .replace(/\u2264/g, '<=')
    .replace(/[\u2022\u25CF\u25AA\u25A0\u2023\u2043]/g, '-')
    .replace(/[\u2713\u2714\u2705]/g, '')
    .replace(/[\u26A0]\uFE0F?/g, '!')
    .replace(/[^\x09\x20-\x7E\u00A0-\u00FF\u0152\u0153\u20AC]/g, '')
    .replace(/\t/g, '    ')
    .replace(/(\S) {2,}/g, '$1 ');
}

interface Segment {
  text: string;
  bold: boolean;
}

/** **gras**, *italique* et `code` -> segments (seul le gras est rendu). */
function parseInline(text: string, baseBold = false): Segment[] {
  const out: Segment[] = [];
  const re = /\*\*(.+?)\*\*|__(.+?)__/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const clean = (s: string) => s.replace(/`([^`]*)`/g, '$1').replace(/(^|[\s(])\*(\S[^*]*?)\*(?=[\s).,;:!?]|$)/g, '$1$2');
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ text: clean(text.slice(last, m.index)), bold: baseBold });
    out.push({ text: clean(m[1] ?? m[2] ?? ''), bold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: clean(text.slice(last)), bold: baseBold });
  return out.filter((s) => s.text.length > 0);
}

type Block =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'rule' }
  | { type: 'space' }
  | { type: 'bullet'; marker: string; indent: number; segments: Segment[] }
  | { type: 'para'; segments: Segment[] }
  | { type: 'table'; rows: string[][] };

const RULE_RE = /^\s*([-=_*\u2500\u2550\u2014])\1{2,}\s*$/;
const TABLE_ROW_RE = /^\s*\|.*\|\s*$/;
const TABLE_SEP_RE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function isAllCapsHeading(line: string): boolean {
  const t = line.trim();
  if (t.length < 4 || t.length > 80 || /[.;,]$/.test(t)) return false;
  const letters = t.replace(/[^A-Za-zÀ-ÖØ-öø-ÿŒœ]/g, '');
  return letters.length >= 4 && letters === letters.toUpperCase();
}

function parseBlocks(content: string, title: string): Block[] {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  const normTitle = pdfSafe(title).trim().toLowerCase();
  let skippedTitle = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = pdfSafe(lines[i]).replace(/\s+$/, '');
    const line = raw.trim();

    if (!line) {
      if (blocks.length && blocks[blocks.length - 1].type !== 'space') blocks.push({ type: 'space' });
      continue;
    }
    if (!skippedTitle && blocks.length === 0) {
      skippedTitle = true;
      if (line.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim().toLowerCase() === normTitle) continue;
    }
    if (RULE_RE.test(line)) {
      blocks.push({ type: 'rule' });
      continue;
    }
    if (TABLE_ROW_RE.test(line)) {
      const rows: string[][] = [];
      let j = i;
      while (j < lines.length && TABLE_ROW_RE.test(pdfSafe(lines[j]).trim())) {
        const r = pdfSafe(lines[j]).trim();
        if (!TABLE_SEP_RE.test(r)) {
          rows.push(
            r
              .replace(/^\|/, '')
              .replace(/\|$/, '')
              .split('|')
              .map((c) => c.trim().replace(/\*\*/g, ''))
          );
        }
        j++;
      }
      i = j - 1;
      if (rows.length) blocks.push({ type: 'table', rows });
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = Math.min(3, h[1].length) as 1 | 2 | 3;
      blocks.push({ type: 'heading', level, text: h[2].replace(/\*\*/g, '').replace(/:$/, '') });
      continue;
    }
    const fullBold = line.match(/^\*\*([^*]+)\*\*\s*:?$/);
    if (fullBold) {
      blocks.push({ type: 'heading', level: 3, text: fullBold[1].replace(/:$/, '') });
      continue;
    }
    if (isAllCapsHeading(line)) {
      blocks.push({ type: 'heading', level: 2, text: line });
      continue;
    }
    if (/^-\s.+\s-$/.test(line)) {
      blocks.push({ type: 'para', segments: [{ text: line.replace(/^-\s*|\s*-$/g, ''), bold: false }] });
      continue;
    }
    const indent = Math.min(3, Math.floor((raw.length - raw.trimStart().length) / 2));
    const bullet = line.match(/^([-*+])\s+(.*)$/);
    if (bullet) {
      blocks.push({ type: 'bullet', marker: 'dot', indent, segments: parseInline(bullet[2]) });
      continue;
    }
    const numbered = line.match(/^(\d{1,2}[.)])\s+(.*)$/);
    if (numbered) {
      blocks.push({ type: 'bullet', marker: numbered[1], indent, segments: parseInline(numbered[2]) });
      continue;
    }
    const keyValue = line.match(/^([^:*]{2,42}?)\s:\s(.+)$/);
    if (keyValue && !line.includes('**')) {
      blocks.push({
        type: 'para',
        segments: [{ text: `${keyValue[1]} : `, bold: true }, ...parseInline(keyValue[2])],
      });
      continue;
    }
    blocks.push({ type: 'para', segments: parseInline(line) });
  }
  while (blocks.length && blocks[blocks.length - 1].type === 'space') blocks.pop();
  return blocks;
}

interface Word {
  text: string;
  bold: boolean;
  width: number;
  space: number;
}

/** Découpe des segments mixtes (gras / normal) en lignes de largeur maxW. */
function wrapSegments(doc: jsPDF, segments: Segment[], size: number, maxW: number): Word[][] {
  const words: Word[] = [];
  for (const seg of segments) {
    doc.setFont('helvetica', seg.bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    const space = doc.getTextWidth(' ');
    const parts = seg.text.split(/(\s+)/);
    for (const p of parts) {
      if (!p) continue;
      if (/^\s+$/.test(p)) {
        if (words.length) words[words.length - 1].space = space;
        continue;
      }
      let rest = p;
      while (doc.getTextWidth(rest) > maxW && rest.length > 1) {
        let cut = rest.length - 1;
        while (cut > 1 && doc.getTextWidth(rest.slice(0, cut)) > maxW) cut--;
        words.push({ text: rest.slice(0, cut), bold: seg.bold, width: doc.getTextWidth(rest.slice(0, cut)), space: 0 });
        rest = rest.slice(cut);
      }
      words.push({ text: rest, bold: seg.bold, width: doc.getTextWidth(rest), space: 0 });
    }
  }
  const lines: Word[][] = [];
  let current: Word[] = [];
  let w = 0;
  for (const word of words) {
    const prevSpace = current.length ? current[current.length - 1].space : 0;
    if (current.length && w + prevSpace + word.width > maxW) {
      lines.push(current);
      current = [];
      w = 0;
    }
    w += (current.length ? current[current.length - 1].space : 0) + word.width;
    current.push(word);
  }
  if (current.length) lines.push(current);
  return lines;
}

/** Export texte multi-pages en PDF (client uniquement), avec mise en page KonaData. */
export async function downloadTextAsPdf(options: DownloadTextPdfOptions): Promise<void> {
  const doc = await buildTextReportPdf(options);
  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(options.fileName ?? `${slugifyReportFilename(options.title)}-${stamp}.pdf`);
}

export async function buildTextReportPdf({
  title,
  content,
  metaLine,
  archiveRef,
}: DownloadTextPdfOptions): Promise<jsPDF> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const maxW = pageW - MARGIN * 2;
  const bottom = pageH - 16;
  const safeTitle = pdfSafe(title).trim() || 'Rapport';
  const meta = pdfSafe(
    metaLine ??
      `Généré le ${new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}${
        archiveRef ? ` - Réf. ${archiveRef.slice(0, 8)}` : ''
      }`
  );

  // En-tête de la première page
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  const titleLines = (doc.splitTextToSize(safeTitle, maxW) as string[]).slice(0, 3);
  const bandH = 22 + titleLines.length * 7.2;
  doc.setFillColor(...C.navy);
  doc.rect(0, 0, pageW, bandH, 'F');
  doc.setFillColor(...C.blue);
  doc.rect(0, bandH, pageW, 1.4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.teal);
  doc.text('KONADATA', MARGIN, 11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.headerSub);
  doc.text('RAPPORT', pageW - MARGIN, 11, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(255, 255, 255);
  titleLines.forEach((l, i) => doc.text(l, MARGIN, 20 + i * 7.2));
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...C.headerSub);
  doc.text(meta, MARGIN, 20 + titleLines.length * 7.2 + 1);

  let y = bandH + 11;
  const topOfPage = 22;

  const ensure = (h: number) => {
    if (y + h > bottom) {
      doc.addPage();
      y = topOfPage;
    }
  };

  const drawWords = (lines: Word[][], x: number, size: number, color: Rgb) => {
    const lh = size * LINE_FACTOR;
    for (const line of lines) {
      ensure(lh);
      let cx = x;
      for (const word of line) {
        doc.setFont('helvetica', word.bold ? 'bold' : 'normal');
        doc.setFontSize(size);
        doc.setTextColor(...(word.bold ? C.navy : color));
        doc.text(word.text, cx, y);
        cx += word.width + word.space;
      }
      y += lh;
    }
  };

  const blocks = parseBlocks(content, title);
  for (let bi = 0; bi < blocks.length; bi++) {
    const b = blocks[bi];
    switch (b.type) {
      case 'space':
        y += 2.6;
        break;
      case 'rule':
        ensure(6);
        doc.setDrawColor(...C.rule);
        doc.setLineWidth(0.4);
        doc.line(MARGIN, y - 1, pageW - MARGIN, y - 1);
        y += 4;
        break;
      case 'heading': {
        if (b.level <= 2) {
          const size = b.level === 1 ? 13 : 11.5;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(size);
          const hl = doc.splitTextToSize(b.text, maxW - 8) as string[];
          const h = hl.length * size * LINE_FACTOR + 6;
          ensure(h + 12);
          y += 3;
          doc.setFillColor(...C.headerBg);
          doc.rect(MARGIN, y - size * 0.36 - 2.2, maxW, hl.length * size * LINE_FACTOR + 3.6, 'F');
          doc.setFillColor(...C.blue);
          doc.rect(MARGIN, y - size * 0.36 - 2.2, 1.6, hl.length * size * LINE_FACTOR + 3.6, 'F');
          doc.setTextColor(...C.navy);
          hl.forEach((l, i) => doc.text(l, MARGIN + 5, y + i * size * LINE_FACTOR));
          y += hl.length * size * LINE_FACTOR + 4;
        } else {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10.5);
          const hl = doc.splitTextToSize(b.text, maxW) as string[];
          ensure(hl.length * 4.6 + 10);
          y += 1.5;
          doc.setTextColor(...C.blue);
          hl.forEach((l, i) => doc.text(l, MARGIN, y + i * 4.6));
          y += hl.length * 4.6 + 1.2;
        }
        break;
      }
      case 'bullet': {
        const x = MARGIN + 2 + b.indent * 5;
        const textX = x + (b.marker === 'dot' ? 4.5 : 6.5);
        const lines = wrapSegments(doc, b.segments, BODY_SIZE, pageW - MARGIN - textX);
        ensure(BODY_SIZE * LINE_FACTOR);
        if (b.marker === 'dot') {
          doc.setFillColor(...(b.indent ? C.muted : C.blue));
          doc.circle(x + 1, y - 1.3, b.indent ? 0.7 : 0.9, 'F');
        } else {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(BODY_SIZE);
          doc.setTextColor(...C.blue);
          doc.text(b.marker, x, y);
        }
        drawWords(lines, textX, BODY_SIZE, C.text);
        y += 0.8;
        break;
      }
      case 'para': {
        const lines = wrapSegments(doc, b.segments, BODY_SIZE, maxW);
        drawWords(lines, MARGIN, BODY_SIZE, C.text);
        y += 0.8;
        break;
      }
      case 'table': {
        const cols = Math.max(...b.rows.map((r) => r.length));
        const colW = maxW / cols;
        const size = cols > 5 ? 8 : 9;
        const lh = size * 0.42;
        b.rows.forEach((row, ri) => {
          doc.setFont('helvetica', ri === 0 ? 'bold' : 'normal');
          doc.setFontSize(size);
          const cells = Array.from({ length: cols }, (_, ci) =>
            (doc.splitTextToSize(row[ci] ?? '', colW - 3) as string[]).slice(0, 6)
          );
          const rowH = Math.max(...cells.map((c) => c.length)) * lh + 3;
          ensure(rowH);
          if (ri === 0) doc.setFillColor(...C.navy);
          else doc.setFillColor(...(ri % 2 ? ([255, 255, 255] as Rgb) : C.rowAlt));
          doc.rect(MARGIN, y - lh - 0.4, maxW, rowH, 'F');
          doc.setTextColor(...(ri === 0 ? ([255, 255, 255] as Rgb) : C.text));
          cells.forEach((c, ci) => c.forEach((l, li) => doc.text(l, MARGIN + ci * colW + 1.5, y + 0.6 + li * lh)));
          y += rowH;
        });
        doc.setDrawColor(...C.rule);
        doc.setLineWidth(0.2);
        doc.line(MARGIN, y - lh - 0.4, pageW - MARGIN, y - lh - 0.4);
        y += 2;
        break;
      }
    }
  }

  const pages = doc.getNumberOfPages();
  const shortTitle = safeTitle.length > 90 ? `${safeTitle.slice(0, 87)}...` : safeTitle;
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    if (i > 1) {
      doc.setFillColor(...C.navy);
      doc.rect(0, 0, pageW, 11, 'F');
      doc.setFillColor(...C.blue);
      doc.rect(0, 11, pageW, 0.8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...C.teal);
      doc.text('KONADATA', MARGIN, 7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(255, 255, 255);
      doc.text(shortTitle, MARGIN + 20, 7);
    }
    doc.setDrawColor(...C.rule);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, pageH - 11, pageW - MARGIN, pageH - 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.muted);
    doc.text('Généré avec KonaData - konadatagn.com', MARGIN, pageH - 6.5);
    doc.text(`Page ${i} / ${pages}`, pageW - MARGIN, pageH - 6.5, { align: 'right' });
  }

  return doc;
}

export function formatReportItemAsText(item: {
  title: string;
  subtitle: string;
  status: string;
  date?: string;
}): string {
  return [
    item.title,
    item.subtitle,
    `Statut : ${item.status}`,
    item.date ? `Date : ${item.date}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}
