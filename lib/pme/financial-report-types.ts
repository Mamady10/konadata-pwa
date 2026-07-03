export type PmeReportPeriod = 'week' | 'month' | 'quarter' | 'year' | 'custom';

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

export interface PmeDayRow {
  key: number;
  label: string;
  entrees: number;
  depenses: number;
  reste: number;
}

export interface PmeExpenseCategoryRow {
  category: string;
  byDay: number[]; // 7 valeurs, ordre Lundi→Dimanche
  total: number;
}

export interface PmeFinancialReportData {
  orgName: string;
  periodLabel: string;
  rangeLabel: string;
  generatedAt: string;
  days: PmeDayRow[]; // 7 (Lun→Dim)
  expenseCategories: PmeExpenseCategoryRow[];
  entreesTotal: number;
  depensesTotal: number;
  resteTotal: number;
  salesCount: number;
}
