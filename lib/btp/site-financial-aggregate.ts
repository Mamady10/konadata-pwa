import { parseBudgetBreakdown } from '@/lib/btp/site-baseline';
import {
  compareBudgetByPoste,
  computeSiteFinancialTotals,
  sumLaborEntryAmount,
  type ExpenseCategory,
  type PosteBudgetComparison,
  type SiteFinancialTotals,
} from '@/lib/btp/site-financial';
import { sumPersonnelPayrollYtd } from '@/lib/btp/personnel-payroll';

export interface SiteFinancialRowInput {
  budget: number;
  openingSpent: number;
  budgetBreakdown: unknown;
  fuelRows: Array<{ cost: number | null }>;
  deliveryRows: Array<{
    total_amount: number | null;
    delivery_date: string | null;
    status: string | null;
  }>;
  laborRows: Array<{ days: number | null; daily_rate: number | null }>;
  expenseRows: Array<{ category: string | null; amount: number | null }>;
  payrollRows: Array<{
    monthly_salary: number | null;
    payroll_start_date: string | null;
  }>;
  asOf: string;
}

export function aggregateSiteFinancialRow(input: SiteFinancialRowInput): {
  totals: SiteFinancialTotals;
  posteComparison: PosteBudgetComparison[];
  budget: number;
} {
  const { budget, openingSpent, budgetBreakdown, asOf } = input;
  const breakdown = parseBudgetBreakdown(budgetBreakdown);

  const fuelCosts = input.fuelRows.reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const deliveryAmounts = input.deliveryRows
    .filter((n) => {
      const status = n.status ?? 'validated';
      if (status !== 'validated') return false;
      const d = n.delivery_date || '';
      return !d || d.slice(0, 10) <= asOf;
    })
    .reduce((s, n) => s + Number(n.total_amount ?? 0), 0);

  const laborEntryAmounts = input.laborRows.reduce(
    (s, r) => s + sumLaborEntryAmount(Number(r.days), Number(r.daily_rate)),
    0
  );

  const expensesByCategory: Partial<Record<ExpenseCategory, number>> = {};
  for (const e of input.expenseRows) {
    const cat = e.category as ExpenseCategory;
    expensesByCategory[cat] = (expensesByCategory[cat] ?? 0) + Number(e.amount ?? 0);
  }

  const laborPayrollAmounts = sumPersonnelPayrollYtd(
    input.payrollRows.map((p) => ({
      monthlySalary: Number(p.monthly_salary ?? 0),
      payrollStartDate: p.payroll_start_date ?? null,
    })),
    asOf
  );

  const totals = computeSiteFinancialTotals({
    budget,
    openingSpent,
    fuelCosts,
    deliveryAmounts,
    laborEntryAmounts,
    laborPayrollAmounts,
    expensesByCategory,
  });

  return {
    totals,
    posteComparison: compareBudgetByPoste(budget, breakdown, totals.byPoste),
    budget,
  };
}

export function groupRowsBySiteId<T extends { site_id: string | null }>(
  rows: T[]
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const siteId = row.site_id;
    if (!siteId) continue;
    const bucket = map.get(siteId);
    if (bucket) bucket.push(row);
    else map.set(siteId, [row]);
  }
  return map;
}
