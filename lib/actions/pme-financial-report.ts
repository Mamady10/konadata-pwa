'use server';

import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/actions/auth';
import type {
  PmeReportPeriod,
  PmeReportCustomRange,
  PmeDayRow,
  PmeExpenseCategoryRow,
  PmeFinancialReportData,
} from '@/lib/pme/financial-report-types';

/** Jours dans l'ordre Lundi → Dimanche. getDay() : 0 = dimanche. */
const WEEKDAYS: { key: number; label: string }[] = [
  { key: 1, label: 'Lundi' },
  { key: 2, label: 'Mardi' },
  { key: 3, label: 'Mercredi' },
  { key: 4, label: 'Jeudi' },
  { key: 5, label: 'Vendredi' },
  { key: 6, label: 'Samedi' },
  { key: 0, label: 'Dimanche' },
];

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
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
    const start = new Date(y, now.getMonth(), 1, 0, 0, 0);
    const end = new Date(y, now.getMonth() + 1, 0, 23, 59, 59);
    return {
      start,
      end,
      label: now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
    };
  }

  if (period === 'quarter') {
    const q = Math.floor(now.getMonth() / 3);
    const start = new Date(y, q * 3, 1, 0, 0, 0);
    const end = new Date(y, q * 3 + 3, 0, 23, 59, 59);
    return { start, end, label: `T${q + 1} ${y}` };
  }

  if (period === 'year') {
    return {
      start: new Date(y, 0, 1, 0, 0, 0),
      end: new Date(y, 11, 31, 23, 59, 59),
      label: `Année ${y}`,
    };
  }

  // week : lundi → dimanche de la semaine courante
  const day = now.getDay(); // 0 = dimanche
  const diffToMonday = (day + 6) % 7;
  const start = new Date(now);
  start.setDate(now.getDate() - diffToMonday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return {
    start,
    end,
    label: `Semaine du ${start.toLocaleDateString('fr-FR')}`,
  };
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

  const dayIndex = new Map<number, number>();
  WEEKDAYS.forEach((d, i) => dayIndex.set(d.key, i));

  const days: PmeDayRow[] = WEEKDAYS.map((d) => ({
    key: d.key,
    label: d.label,
    entrees: 0,
    depenses: 0,
    reste: 0,
  }));

  // Entrées : ventes
  let salesCount = 0;
  for (const s of salesRes.data ?? []) {
    if (!s.sold_at) continue;
    const idx = dayIndex.get(new Date(s.sold_at as string).getDay());
    if (idx == null) continue;
    days[idx].entrees += Number(s.total) || 0;
    salesCount += 1;
  }

  // Dépenses : catégories (achats = Marchandises + dépenses par catégorie)
  const catMap = new Map<string, number[]>();
  const addCat = (label: string, idx: number, amount: number) => {
    if (!catMap.has(label)) catMap.set(label, new Array(7).fill(0));
    catMap.get(label)![idx] += amount;
    days[idx].depenses += amount;
  };

  for (const p of purchasesRes.data ?? []) {
    if (!p.purchased_at) continue;
    const idx = dayIndex.get(new Date(p.purchased_at as string).getDay());
    if (idx == null) continue;
    addCat('Marchandises', idx, Number(p.total) || 0);
  }

  for (const e of expensesRes.data ?? []) {
    if (!e.expense_date) continue;
    const idx = dayIndex.get(new Date(`${e.expense_date}T12:00:00`).getDay());
    if (idx == null) continue;
    addCat(prettifyCategory(e.category as string), idx, Number(e.amount) || 0);
  }

  for (const d of days) d.reste = d.entrees - d.depenses;

  const expenseCategories: PmeExpenseCategoryRow[] = [...catMap.entries()]
    .map(([category, byDay]) => ({
      category,
      byDay,
      total: byDay.reduce((s, x) => s + x, 0),
    }))
    .sort((a, b) => b.total - a.total);

  const entreesTotal = days.reduce((s, d) => s + d.entrees, 0);
  const depensesTotal = days.reduce((s, d) => s + d.depenses, 0);

  return {
    data: {
      orgName,
      periodLabel: label,
      rangeLabel: `${start.toLocaleDateString('fr-FR')} – ${end.toLocaleDateString('fr-FR')}`,
      generatedAt: new Date().toISOString(),
      days,
      expenseCategories,
      entreesTotal,
      depensesTotal,
      resteTotal: entreesTotal - depensesTotal,
      salesCount,
    },
  };
}
