import type { WorkSheet } from 'xlsx';
import {
  computeQuoteTotals,
  QUOTE_SECTION_LABELS,
  quoteDisplayNumber,
  type BtpQuote,
  type QuoteLine,
} from '@/lib/btp/quotes/quote-types';
import { quoteFileBaseName } from '@/lib/btp/quotes/quote-pdf';

type Cell = string | number | null;

const AMOUNT_FORMAT = '#,##0';
const qtyFormat = (value: number) => (Number.isInteger(value) ? '#,##0' : '#,##0.###');
const HEADER = ['N°', 'Désignation', 'Unité', 'Quantité', 'PU (GNF)', 'Montant (GNF)'];

function sheetName(index: number, title: string, used: Set<string>): string {
  const base = `${index + 1} ${title}`.replace(/[[\]:*?/\\]/g, ' ').replace(/\s+/g, ' ').trim();
  let name = base.slice(0, 31);
  let n = 2;
  while (used.has(name.toLowerCase())) {
    const suffix = ` (${n++})`;
    name = `${base.slice(0, 31 - suffix.length)}${suffix}`;
  }
  used.add(name.toLowerCase());
  return name;
}

function sheetRef(name: string): string {
  return `'${name.replace(/'/g, "''")}'`;
}

function isPrintableLine(line: QuoteLine): boolean {
  return Boolean(line.designation.trim()) || line.quantity > 0 || line.unitPrice > 0;
}

export async function downloadQuoteExcel(quote: BtpQuote, orgName: string) {
  const XLSX = await import('xlsx');
  const totals = computeQuoteTotals(quote.lots, quote);
  const wb = XLSX.utils.book_new();
  const usedNames = new Set<string>(['récapitulatif']);
  const intro = (subtitle: string): Cell[][] => [
    [orgName],
    [quote.title],
    [quote.subtitle || ''],
    [`Devis N° ${quoteDisplayNumber(quote)} — ${subtitle}`],
    [],
    HEADER,
  ];

  const setFormula = (ws: WorkSheet, row: number, col: number, formula: string, value: number, format = AMOUNT_FORMAT) => {
    ws[XLSX.utils.encode_cell({ r: row, c: col })] = { t: 'n', f: formula, v: value, z: format };
  };
  const setFormat = (ws: WorkSheet, row: number, col: number, format: string) => {
    const cell = ws[XLSX.utils.encode_cell({ r: row, c: col })];
    if (cell && cell.t === 'n') cell.z = format;
  };
  const finishSheet = (ws: WorkSheet, merges: Array<[number, number, number]>) => {
    ws['!cols'] = [{ wch: 6 }, { wch: 42 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 18 }];
    ws['!merges'] = [
      ...[0, 1, 2, 3].map((r) => ({ s: { r, c: 0 }, e: { r, c: 5 } })),
      ...merges.map(([r, c1, c2]) => ({ s: { r, c: c1 }, e: { r, c: c2 } })),
    ];
  };

  /** Ligne Excel (0-based) de la cellule « total du lot » pour le récapitulatif. */
  const lotTotalRef = new Map<string, string>();

  totals.lots.forEach((lt, lotIndex) => {
    if (lt.lot.kind !== 'detailed') return;
    const name = sheetName(lotIndex, lt.lot.title, usedNames);
    const rows: Cell[][] = intro(`Lot ${lotIndex + 1} : ${lt.lot.title}`);
    const formulas: Array<() => void> = [];
    const merges: Array<[number, number, number]> = [];
    const subtotalRows: number[] = [];
    let lineNo = 0;
    let ws: WorkSheet;

    for (const section of lt.sections) {
      const lines = section.lines.filter(isPrintableLine);
      if (lines.length === 0) continue;
      merges.push([rows.length, 0, 5]);
      rows.push([QUOTE_SECTION_LABELS[section.section].toUpperCase()]);
      const first = rows.length;
      for (const line of lines) {
        lineNo += 1;
        const r = rows.length;
        rows.push([lineNo, line.designation, line.unit, line.quantity, line.unitPrice, null]);
        const amount = line.quantity * line.unitPrice;
        formulas.push(() => {
          setFormat(ws, r, 3, qtyFormat(line.quantity));
          setFormat(ws, r, 4, AMOUNT_FORMAT);
          setFormula(ws, r, 5, `D${r + 1}*E${r + 1}`, amount);
        });
      }
      const last = rows.length - 1;
      const sub = rows.length;
      subtotalRows.push(sub);
      merges.push([sub, 0, 4]);
      rows.push([`Sous-total ${QUOTE_SECTION_LABELS[section.section]}`, null, null, null, null, null]);
      formulas.push(() => setFormula(ws, sub, 5, `SUM(F${first + 1}:F${last + 1})`, section.total));
    }
    const totalRow = rows.length;
    merges.push([totalRow, 0, 4]);
    rows.push([`TOTAL ${lt.lot.title.toUpperCase()}`, null, null, null, null, null]);
    const totalFormula = subtotalRows.length > 0 ? subtotalRows.map((r) => `F${r + 1}`).join('+') : '0';
    formulas.push(() => setFormula(ws, totalRow, 5, totalFormula, lt.unitTotal));

    ws = XLSX.utils.aoa_to_sheet(rows);
    formulas.forEach((apply) => apply());
    finishSheet(ws, merges);
    XLSX.utils.book_append_sheet(wb, ws, name);
    lotTotalRef.set(lt.lot.id, `${sheetRef(name)}!F${totalRow + 1}`);
  });

  // Récapitulatif
  const rows: Cell[][] = intro('Récapitulatif');
  const recapFormulas: Array<(ws: WorkSheet) => void> = [];
  const merges: Array<[number, number, number]> = [];
  const firstRecap = rows.length;
  totals.lots.forEach((lt, i) => {
    const r = rows.length;
    rows.push([i + 1, lt.lot.title, lt.lot.unit, lt.lot.quantity, lt.unitTotal, null]);
    const ref = lotTotalRef.get(lt.lot.id);
    recapFormulas.push((ws) => {
      setFormat(ws, r, 3, qtyFormat(lt.lot.quantity));
      if (ref) setFormula(ws, r, 4, ref, lt.unitTotal);
      else setFormat(ws, r, 4, AMOUNT_FORMAT);
      setFormula(ws, r, 5, `D${r + 1}*E${r + 1}`, lt.recapTotal);
    });
  });
  const lastRecap = rows.length - 1;
  const htRow = rows.length;
  merges.push([htRow, 0, 4]);
  rows.push([quote.vatEnabled ? 'TOTAL HT' : 'TOTAL', null, null, null, null, null]);
  recapFormulas.push((ws) =>
    setFormula(
      ws,
      htRow,
      5,
      totals.lots.length > 0 ? `SUM(F${firstRecap + 1}:F${lastRecap + 1})` : '0',
      totals.totalHt
    )
  );
  if (quote.vatEnabled) {
    const vatRow = rows.length;
    merges.push([vatRow, 0, 3]);
    rows.push([`TVA`, null, null, null, quote.vatRate / 100, null]);
    const ttcRow = rows.length;
    merges.push([ttcRow, 0, 4]);
    rows.push(['TOTAL TTC', null, null, null, null, null]);
    recapFormulas.push((ws) => {
      setFormat(ws, vatRow, 4, '0.00%');
      setFormula(ws, vatRow, 5, `F${htRow + 1}*E${vatRow + 1}`, totals.vatAmount);
      setFormula(ws, ttcRow, 5, `F${htRow + 1}+F${vatRow + 1}`, totals.totalTtc);
    });
  }
  const recap = XLSX.utils.aoa_to_sheet(rows);
  recapFormulas.forEach((apply) => apply(recap));
  finishSheet(recap, merges);
  XLSX.utils.book_append_sheet(wb, recap, 'Récapitulatif');

  XLSX.writeFile(wb, `${quoteFileBaseName(quote)}.xlsx`);
}
