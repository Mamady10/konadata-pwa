import type { BtpBudgetBreakdown, BudgetConsumedByPoste, PosteBudgetComparison } from '@/lib/btp/site-baseline-types';
import { BUDGET_POSTE_LABELS } from '@/lib/btp/site-baseline';

export type ExpenseCategory = keyof BtpBudgetBreakdown | 'other';

export interface SiteFinancialTotals {
  openingSpent: number;
  fuel: number;
  byPoste: BudgetConsumedByPoste;
  /** Hors carburant (inclus dans equipment via fuel) */
  equipmentExpenses: number;
  laborFromEntries: number;
  laborFromExpenses: number;
  materialsFromDeliveryNotes: number;
  materialsFromExpenses: number;
  total: number;
  financialPct: number | null;
}

const POSTE_KEYS: ExpenseCategory[] = [
  'labor',
  'materials',
  'equipment',
  'subcontract',
  'overhead',
  'other',
];

export interface BtpFinancialDashboardRow {
  siteId: string;
  siteName: string;
  budget: number;
  spent: number;
  financialPct: number;
  labor: number;
  materials: number;
  equipment: number;
  subcontract: number;
  overhead: number;
}

export function sumLaborEntryAmount(days: number, dailyRate: number): number {
  return Math.round(Number(days) * Number(dailyRate));
}

export function computeSiteFinancialTotals(params: {
  budget: number;
  openingSpent: number;
  fuelCosts: number;
  deliveryAmounts: number;
  laborEntryAmounts: number;
  expensesByCategory: Partial<Record<ExpenseCategory, number>>;
}): SiteFinancialTotals {
  const {
    budget,
    openingSpent,
    fuelCosts,
    deliveryAmounts,
    laborEntryAmounts,
    expensesByCategory,
  } = params;

  const laborFromExpenses = Math.round(expensesByCategory.labor ?? 0);
  const materialsFromExpenses = Math.round(expensesByCategory.materials ?? 0);
  const equipmentExpenses = Math.round(expensesByCategory.equipment ?? 0);
  const subcontract = Math.round(expensesByCategory.subcontract ?? 0);
  const overhead = Math.round(expensesByCategory.overhead ?? 0);
  const other = Math.round(expensesByCategory.other ?? 0);

  const byPoste: BudgetConsumedByPoste = {
    labor: laborEntryAmounts + laborFromExpenses,
    materials: deliveryAmounts + materialsFromExpenses,
    equipment: fuelCosts + equipmentExpenses,
    subcontract,
    overhead,
    other,
  };

  const total =
    Math.round(openingSpent) +
    byPoste.labor +
    byPoste.materials +
    byPoste.equipment +
    byPoste.subcontract +
    byPoste.overhead +
    byPoste.other;

  const financialPct = budget > 0 ? Math.round((total / budget) * 1000) / 10 : null;

  return {
    openingSpent: Math.round(openingSpent),
    fuel: Math.round(fuelCosts),
    byPoste,
    equipmentExpenses,
    laborFromEntries: laborEntryAmounts,
    laborFromExpenses,
    materialsFromDeliveryNotes: Math.round(deliveryAmounts),
    materialsFromExpenses,
    total,
    financialPct,
  };
}

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  labor: "Main d'oeuvre",
  materials: 'Matériaux',
  equipment: 'Engins & équipement',
  subcontract: 'Sous-traitance',
  overhead: 'Frais généraux',
  other: 'Autre',
};

/** @deprecated Utiliser computeSiteFinancialTotals */
export function computeConsumedBudget(params: {
  openingSpent: number;
  fuelCosts: number;
  deliveryAmounts: number;
  laborAmounts?: number;
  expenseAmounts?: number;
}): number {
  return computeSiteFinancialTotals({
    budget: 1,
    openingSpent: params.openingSpent,
    fuelCosts: params.fuelCosts,
    deliveryAmounts: params.deliveryAmounts,
    laborEntryAmounts: params.laborAmounts ?? 0,
    expensesByCategory: {
      subcontract: 0,
      overhead: 0,
      other: params.expenseAmounts ?? 0,
    },
  }).total;
}

export function compareBudgetByPoste(
  budget: number,
  breakdown: BtpBudgetBreakdown,
  byPoste: BudgetConsumedByPoste
): PosteBudgetComparison[] {
  if (budget <= 0) return [];

  return POSTE_KEYS.map((poste) => {
    const plannedPct = Number(breakdown[poste as keyof BtpBudgetBreakdown] ?? 0);
    const plannedAmount = Math.round((budget * plannedPct) / 100);
    const actualAmount = byPoste[poste as keyof BudgetConsumedByPoste] ?? 0;
    const gapAmount = actualAmount - plannedAmount;
    const executionPct =
      plannedAmount > 0 ? Math.round((actualAmount / plannedAmount) * 1000) / 10 : null;

    return {
      poste,
      label: BUDGET_POSTE_LABELS[poste as keyof BtpBudgetBreakdown] ?? poste,
      plannedPct,
      plannedAmount,
      actualAmount,
      gapAmount,
      executionPct,
    };
  }).filter((r) => r.plannedPct > 0 || r.actualAmount > 0);
}
