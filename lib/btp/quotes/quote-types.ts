export type QuoteSection = 'materials' | 'equipment' | 'labor' | 'supervision';
export type QuoteLotKind = 'detailed' | 'lump_sum';
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'refused' | 'cancelled';

export const QUOTE_SECTIONS: QuoteSection[] = ['materials', 'equipment', 'labor', 'supervision'];

export const QUOTE_SECTION_LABELS: Record<QuoteSection, string> = {
  materials: 'Matériaux',
  equipment: 'Matériels',
  labor: "Main d'œuvre",
  supervision: 'Suivi et contrôle',
};

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  accepted: 'Accepté',
  refused: 'Refusé',
  cancelled: 'Annulé',
};

export interface QuoteLine {
  id: string;
  section: QuoteSection;
  designation: string;
  unit: string;
  quantity: number;
  unitPrice: number;
}

export interface QuoteLot {
  id: string;
  title: string;
  kind: QuoteLotKind;
  /** Nombre de fois où le lot est compté au récapitulatif (ex. 5 niveaux). */
  quantity: number;
  unit: string;
  /** Prix unitaire d'un lot forfaitaire (sans détail). */
  lumpSumAmount: number;
  lines: QuoteLine[];
}

export interface QuoteHeader {
  title: string;
  subtitle: string;
  clientName: string;
  clientContact: string;
  clientAddress: string;
  location: string;
  quoteDate: string;
  validityDays: number;
  notes: string;
  vatEnabled: boolean;
  vatRate: number;
}

export interface BtpQuote extends QuoteHeader {
  id: string;
  number: string;
  version: number;
  rootQuoteId: string | null;
  status: QuoteStatus;
  lots: QuoteLot[];
  totalHt: number;
  totalTtc: number;
  siteId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BtpQuoteListItem {
  id: string;
  number: string;
  version: number;
  title: string;
  clientName: string | null;
  status: QuoteStatus;
  quoteDate: string;
  totalHt: number;
  totalTtc: number;
  vatEnabled: boolean;
  lotCount: number;
  updatedAt: string;
}

export interface PriceCatalogItem {
  id: string;
  designation: string;
  unit: string;
  unitPrice: number;
  section: QuoteSection;
  updatedAt: string;
}

export interface QuoteSectionTotal {
  section: QuoteSection;
  lines: QuoteLine[];
  total: number;
}

export interface QuoteLotTotals {
  lot: QuoteLot;
  sections: QuoteSectionTotal[];
  /** Montant d'une unité du lot (détail ou forfait). */
  unitTotal: number;
  /** Montant au récapitulatif = unitTotal × quantité. */
  recapTotal: number;
}

export interface QuoteTotals {
  lots: QuoteLotTotals[];
  totalHt: number;
  vatAmount: number;
  totalTtc: number;
  bySection: Record<QuoteSection, number>;
  lumpSumTotal: number;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

export function newQuoteId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function lineAmount(line: Pick<QuoteLine, 'quantity' | 'unitPrice'>): number {
  return round2((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0));
}

export function computeLotTotals(lot: QuoteLot): QuoteLotTotals {
  const sections = QUOTE_SECTIONS.map((section) => {
    const lines = lot.lines.filter((l) => l.section === section);
    return { section, lines, total: round2(lines.reduce((s, l) => s + lineAmount(l), 0)) };
  });
  const unitTotal =
    lot.kind === 'lump_sum'
      ? round2(Number(lot.lumpSumAmount) || 0)
      : round2(sections.reduce((s, sec) => s + sec.total, 0));
  const quantity = Number(lot.quantity) || 0;
  return { lot, sections, unitTotal, recapTotal: round2(unitTotal * quantity) };
}

export function computeQuoteTotals(
  lots: QuoteLot[],
  vat: { vatEnabled: boolean; vatRate: number }
): QuoteTotals {
  const lotTotals = lots.map(computeLotTotals);
  const totalHt = round2(lotTotals.reduce((s, l) => s + l.recapTotal, 0));
  const vatAmount = vat.vatEnabled ? round2((totalHt * (Number(vat.vatRate) || 0)) / 100) : 0;
  const bySection: Record<QuoteSection, number> = {
    materials: 0,
    equipment: 0,
    labor: 0,
    supervision: 0,
  };
  let lumpSumTotal = 0;
  for (const lt of lotTotals) {
    const qty = Number(lt.lot.quantity) || 0;
    if (lt.lot.kind === 'lump_sum') {
      lumpSumTotal += lt.recapTotal;
      continue;
    }
    for (const sec of lt.sections) bySection[sec.section] += round2(sec.total * qty);
  }
  return {
    lots: lotTotals,
    totalHt,
    vatAmount,
    totalTtc: round2(totalHt + vatAmount),
    bySection,
    lumpSumTotal: round2(lumpSumTotal),
  };
}

export function emptyLine(section: QuoteSection): QuoteLine {
  return { id: newQuoteId(), section, designation: '', unit: '', quantity: 0, unitPrice: 0 };
}

/** Lot détaillé prérempli avec les lignes habituelles de main d'œuvre et de suivi. */
export function newDetailedLot(title: string): QuoteLot {
  return {
    id: newQuoteId(),
    title,
    kind: 'detailed',
    quantity: 1,
    unit: 'ens',
    lumpSumAmount: 0,
    lines: [
      emptyLine('materials'),
      { ...emptyLine('labor'), designation: "Main d'œuvre", unit: 'ft', quantity: 1 },
      {
        ...emptyLine('supervision'),
        designation: 'Suivi et contrôle du chantier',
        unit: 'ft',
        quantity: 1,
      },
    ],
  };
}

export function newLumpSumLot(title: string, amount = 0): QuoteLot {
  return {
    id: newQuoteId(),
    title,
    kind: 'lump_sum',
    quantity: 1,
    unit: 'fft',
    lumpSumAmount: amount,
    lines: [],
  };
}

/** Structure de départ proposée à la création d'un devis de construction. */
export function defaultQuoteLots(): QuoteLot[] {
  return [
    newDetailedLot('Installation du chantier'),
    newDetailedLot('Travaux de fondation'),
    newDetailedLot('Élévation'),
    newDetailedLot('Dalle'),
    newDetailedLot('Toiture'),
    newLumpSumLot('Travaux divers et imprévus'),
  ];
}

/** Copie d'un lot (lots répétés : chaque niveau suivi séparément, prix ajustables). */
export function duplicateLot(lot: QuoteLot, title?: string): QuoteLot {
  return {
    ...lot,
    id: newQuoteId(),
    title: title ?? `${lot.title} (copie)`,
    lines: lot.lines.map((l) => ({ ...l, id: newQuoteId() })),
  };
}

function toNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'string' ? Number(value.replace(/\s/g, '').replace(',', '.')) : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toText(value: unknown, max = 500): string {
  return String(value ?? '').trim().slice(0, max);
}

/** Valide et nettoie les lots reçus (client ou base). */
export function parseQuoteLots(raw: unknown): QuoteLot[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 200).map((item): QuoteLot => {
    const o = (item ?? {}) as Record<string, unknown>;
    const kind: QuoteLotKind = o.kind === 'lump_sum' ? 'lump_sum' : 'detailed';
    const linesRaw = Array.isArray(o.lines) ? o.lines : [];
    return {
      id: toText(o.id, 64) || newQuoteId(),
      title: toText(o.title, 200) || 'Lot sans titre',
      kind,
      quantity: Math.max(0, toNumber(o.quantity, 1)),
      unit: toText(o.unit, 20) || (kind === 'lump_sum' ? 'fft' : 'ens'),
      lumpSumAmount: Math.max(0, toNumber(o.lumpSumAmount)),
      lines:
        kind === 'lump_sum'
          ? []
          : linesRaw.slice(0, 500).map((lineRaw): QuoteLine => {
              const l = (lineRaw ?? {}) as Record<string, unknown>;
              const section = QUOTE_SECTIONS.includes(l.section as QuoteSection)
                ? (l.section as QuoteSection)
                : 'materials';
              return {
                id: toText(l.id, 64) || newQuoteId(),
                section,
                designation: toText(l.designation, 300),
                unit: toText(l.unit, 20),
                quantity: Math.max(0, toNumber(l.quantity)),
                unitPrice: Math.max(0, toNumber(l.unitPrice)),
              };
            }),
    };
  });
}

export function quoteValidUntil(quoteDate: string, validityDays: number): string | null {
  const d = new Date(`${quoteDate.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + Math.max(0, validityDays));
  return d.toISOString().slice(0, 10);
}

export function quoteDisplayNumber(q: Pick<BtpQuote, 'number' | 'version'>): string {
  return q.version > 1 ? `${q.number} (V${q.version})` : q.number;
}

/** Montants GNF sans décimales, séparateur d'espace (PDF, Excel, écran). */
export function formatQuoteAmount(amount: number): string {
  const rounded = Math.round(Number(amount) || 0);
  const grouped = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return rounded < 0 ? `-${grouped}` : grouped;
}

export function formatQuoteQuantity(quantity: number): string {
  const n = Number(quantity) || 0;
  if (Number.isInteger(n)) return formatQuoteAmount(n);
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 3 }).replace(/\u202F|\u00a0/g, ' ');
}
