'use server';

import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/actions/auth';
import type {
  PmeReportPeriod,
  PmeReportCustomRange,
  PmeGranularity,
  PmeBucketRow,
  PmeExpenseCategoryRow,
  PmeFinancialReportData,
} from '@/lib/pme/financial-report-types';

const WEEKDAY_NAMES = [
  'Dimanche',
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
];
const WEEKDAY_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function ddmm(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const diff = (x.getDay() + 6) % 7; // lundi = 0
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function resolvePeriod(
  period: PmeReportPeriod,
  custom?: PmeReportCustomRange
): { start: Date; end: Date; label: string } {
  const now = new Date();
  const y = now.getFullYear();

  if (period === 'custom' && custom) {
    const start = new Date(`${custom.start}T00:00:00`);
    const end = new Date(`${custom.end}T23:59:59`);
    return {
      start,
      end,
      label: `Du ${start.toLocaleDateString('fr-FR')} au ${end.toLocaleDateString('fr-FR')}`,
    };
  }

  if (period === 'month') {
    return {
      start: new Date(y, now.getMonth(), 1, 0, 0, 0),
      end: new Date(y, now.getMonth() + 1, 0, 23, 59, 59),
      label: now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
    };
  }

  if (period === 'quarter') {
    const q = Math.floor(now.getMonth() / 3);
    return {
      start: new Date(y, q * 3, 1, 0, 0, 0),
      end: new Date(y, q * 3 + 3, 0, 23, 59, 59),
      label: `T${q + 1} ${y}`,
    };
  }

  if (period === 'year') {
    return {
      start: new Date(y, 0, 1, 0, 0, 0),
      end: new Date(y, 11, 31, 23, 59, 59),
      label: `Année ${y}`,
    };
  }

  // semaine courante (lundi → dimanche)
  const start = startOfWeek(now);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end, label: `Semaine du ${start.toLocaleDateString('fr-FR')}` };
}

/** Choix du découpage : semaine→jour, mois→semaine, trimestre/année→mois. */
function resolveGranularity(period: PmeReportPeriod, start: Date, end: Date): PmeGranularity {
  if (period === 'week') return 'day';
  if (period === 'month') return 'week';
  if (period === 'quarter' || period === 'year') return 'month';
  // custom : selon l'étendue
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (days <= 8) return 'day';
  if (days <= 70) return 'week';
  return 'month';
}

interface Bucket {
  label: string;
  short: string;
  start: Date;
  end: Date;
}

function buildBuckets(
  period: PmeReportPeriod,
  granularity: PmeGranularity,
  start: Date,
  end: Date
): Bucket[] {
  const buckets: Bucket[] = [];
  const last = new Date(end);

  if (granularity === 'day') {
    const cur = new Date(start);
    cur.setHours(0, 0, 0, 0);
    while (cur <= last) {
      const s = new Date(cur);
      const e = new Date(cur);
      e.setHours(23, 59, 59, 999);
      // semaine : noms de jours ; sinon date
      const isWeek = period === 'week';
      buckets.push({
        label: isWeek ? WEEKDAY_NAMES[s.getDay()] : ddmm(s),
        short: isWeek ? WEEKDAY_SHORT[s.getDay()] : ddmm(s),
        start: s,
        end: e,
      });
      cur.setDate(cur.getDate() + 1);
    }
    return buckets;
  }

  if (granularity === 'week') {
    let ws = startOfWeek(start);
    let i = 1;
    while (ws <= last) {
      const we = new Date(ws);
      we.setDate(ws.getDate() + 6);
      we.setHours(23, 59, 59, 999);
      buckets.push({
        label: `Sem. ${i} (${ddmm(ws)})`,
        short: `S${i}`,
        start: new Date(ws),
        end: we,
      });
      ws = new Date(ws);
      ws.setDate(ws.getDate() + 7);
      i++;
    }
    return buckets;
  }

  // month
  let ms = new Date(start.getFullYear(), start.getMonth(), 1, 0, 0, 0);
  while (ms <= last) {
    const me = new Date(ms.getFullYear(), ms.getMonth() + 1, 0, 23, 59, 59, 999);
    const monthShort = ms.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
    buckets.push({
      label: ms.toLocaleDateString('fr-FR', { month: 'long' }),
      short: monthShort.slice(0, 4),
      start: new Date(ms),
      end: me,
    });
    ms = new Date(ms.getFullYear(), ms.getMonth() + 1, 1);
  }
  return buckets;
}

function prettifyCategory(raw: string | null | undefined): string {
  const c = (raw ?? '').trim().toLowerCase();
  const MAP: Record<string, string> = {
    general: 'Autres',
    autre: 'Autres',
    autres: 'Autres',
    marchandise: 'Marchandises',
    marchandises: 'Marchandises',
    nourriture: 'Nourritures',
    nourritures: 'Nourritures',
    transport: 'Transport',
    electricite: 'Électricité',
    'électricité': 'Électricité',
    loyer: 'Loyer/Boutique',
    boutique: 'Loyer/Boutique',
    'loyer/boutique': 'Loyer/Boutique',
  };
  if (!c) return 'Autres';
  if (MAP[c]) return MAP[c];
  return raw!.charAt(0).toUpperCase() + raw!.slice(1);
}

function bucketIndex(buckets: Bucket[], d: Date): number {
  for (let i = 0; i < buckets.length; i++) {
    if (d >= buckets[i].start && d <= buckets[i].end) return i;
  }
  return -1;
}

export async function getPmeFinancialAnalysis(
  period: PmeReportPeriod = 'week',
  custom?: PmeReportCustomRange
): Promise<{ data: PmeFinancialReportData } | { error: string }> {
  const session = await getSession();
  const orgId = session?.profile?.organization_id;
  const orgName =
    (session?.profile?.organizations as { name?: string } | null)?.name ?? 'PME';
  if (!orgId) return { error: 'Organisation introuvable.' };

  if (period === 'custom') {
    if (!custom?.start || !custom?.end) {
      return { error: 'Sélectionnez une date de début et une date de fin.' };
    }
    if (custom.start > custom.end) {
      return { error: 'La date de début doit précéder la date de fin.' };
    }
  }

  const { start, end, label } = resolvePeriod(period, custom);
  const granularity = resolveGranularity(period, start, end);
  const buckets = buildBuckets(period, granularity, start, end);
  const startIso = fmtDate(start);
  const endIso = fmtDate(end);

  const supabase = await createClient();

  const [salesRes, purchasesRes, expensesRes] = await Promise.all([
    supabase
      .from('pme_sales')
      .select('total, sold_at')
      .eq('organization_id', orgId)
      .gte('sold_at', start.toISOString())
      .lte('sold_at', end.toISOString()),
    supabase
      .from('pme_purchases')
      .select('total, purchased_at')
      .eq('organization_id', orgId)
      .gte('purchased_at', start.toISOString())
      .lte('purchased_at', end.toISOString()),
    supabase
      .from('pme_expenses')
      .select('amount, category, expense_date')
      .eq('organization_id', orgId)
      .gte('expense_date', startIso)
      .lte('expense_date', endIso),
  ]);

  const rows: PmeBucketRow[] = buckets.map((b) => ({
    label: b.label,
    short: b.short,
    entrees: 0,
    depenses: 0,
    reste: 0,
  }));

  let salesCount = 0;
  for (const s of salesRes.data ?? []) {
    if (!s.sold_at) continue;
    const idx = bucketIndex(buckets, new Date(s.sold_at as string));
    if (idx < 0) continue;
    rows[idx].entrees += Number(s.total) || 0;
    salesCount += 1;
  }

  const catMap = new Map<string, number[]>();
  const addCat = (category: string, idx: number, amount: number) => {
    if (!catMap.has(category)) catMap.set(category, new Array(buckets.length).fill(0));
    catMap.get(category)![idx] += amount;
    rows[idx].depenses += amount;
  };

  for (const p of purchasesRes.data ?? []) {
    if (!p.purchased_at) continue;
    const idx = bucketIndex(buckets, new Date(p.purchased_at as string));
    if (idx < 0) continue;
    addCat('Marchandises', idx, Number(p.total) || 0);
  }

  for (const e of expensesRes.data ?? []) {
    if (!e.expense_date) continue;
    const idx = bucketIndex(buckets, new Date(`${e.expense_date}T12:00:00`));
    if (idx < 0) continue;
    addCat(prettifyCategory(e.category as string), idx, Number(e.amount) || 0);
  }

  for (const r of rows) r.reste = r.entrees - r.depenses;

  const expenseCategories: PmeExpenseCategoryRow[] = [...catMap.entries()]
    .map(([category, byBucket]) => ({
      category,
      byBucket,
      total: byBucket.reduce((s, x) => s + x, 0),
    }))
    .sort((a, b) => b.total - a.total);

  const entreesTotal = rows.reduce((s, d) => s + d.entrees, 0);
  const depensesTotal = rows.reduce((s, d) => s + d.depenses, 0);

  const unitLabel =
    granularity === 'day' ? 'jour' : granularity === 'week' ? 'semaine' : 'mois';
  const columnHeader =
    granularity === 'day' ? 'Jour' : granularity === 'week' ? 'Semaine' : 'Mois';

  return {
    data: {
      orgName,
      periodLabel: label,
      rangeLabel: `${start.toLocaleDateString('fr-FR')} – ${end.toLocaleDateString('fr-FR')}`,
      generatedAt: new Date().toISOString(),
      granularity,
      unitLabel,
      columnHeader,
      buckets: rows,
      expenseCategories,
      entreesTotal,
      depensesTotal,
      resteTotal: entreesTotal - depensesTotal,
      salesCount,
    },
  };
}
