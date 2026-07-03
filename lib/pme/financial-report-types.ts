export type PmeReportPeriod = 'week' | 'month' | 'quarter' | 'year' | 'custom';
export type PmeGranularity = 'day' | 'week' | 'month';

export interface PmeReportCustomRange {
  start: string;
  end: string;
}

export const PME_REPORT_PERIODS: { id: PmeReportPeriod; label: string }[] = [
  { id: 'week', label: 'Semaine' },
  { id: 'month', label: 'Mois' },
  { id: 'quarter', label: 'Trimestre' },
  { id: 'year', label: 'Année' },
  { id: 'custom', label: 'Personnalisée' },
];

export interface PmeBucketRow {
  label: string; // libellé complet (ex : "Lundi", "S1 (03/07)", "janv.")
  short: string; // libellé court pour graphes/colonnes (ex : "Lun", "S1", "jan")
  entrees: number;
  depenses: number;
  reste: number;
}

export interface PmeExpenseCategoryRow {
  category: string;
  byBucket: number[]; // aligné sur l'ordre des buckets
  total: number;
}

export interface PmeFinancialReportData {
  orgName: string;
  periodLabel: string;
  rangeLabel: string;
  generatedAt: string;
  granularity: PmeGranularity;
  unitLabel: string; // "jour" | "semaine" | "mois"
  columnHeader: string; // "Jour" | "Semaine" | "Mois"
  buckets: PmeBucketRow[];
  expenseCategories: PmeExpenseCategoryRow[];
  entreesTotal: number;
  depensesTotal: number;
  resteTotal: number;
  salesCount: number;
}
