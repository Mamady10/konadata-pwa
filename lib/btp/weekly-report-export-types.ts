import type { ReportSection } from '@/lib/ai/reports/render-report';

import type { BtpBudgetBreakdown, BtpWeeklyComparisonMetrics } from '@/lib/btp/site-baseline-types';

export interface WeeklyReportExportStats {
  dailyEntries: number;
  fuelLogs: number;
  deliveryNotes: number;
  hseMentions: number;
}

export interface WeeklyReportIdentification {
  chantier: string;
  localisation: string | null;
  statut: string;
  periode: string;
  client?: string | null;
  contractRef?: string | null;
  moaRecipient?: string | null;
  planningStart?: string | null;
  planningEnd?: string | null;
}

export interface WeeklyReportSynthesis {
  physicalStart: number;
  physicalEnd: number;
  financialPct: number;
  delayDays: number;
  budget: number;
  spent: number;
  dailyCount: number;
}

export interface WeeklyReportDailyRow {
  dateLabel: string;
  progressPct: number;
  workers: number | null;
  weather: string | null;
  notes: string;
}

export interface WeeklyReportFuelRow {
  dateLabel: string;
  liters: number;
  isAnomaly: boolean;
}

export interface WeeklyReportDeliveryRow {
  reference: string;
  supplier: string;
  amount: number;
  dateLabel: string;
}

export interface WeeklyReportExportStructured {
  identification: WeeklyReportIdentification;
  synthesis: WeeklyReportSynthesis;
  dailyRows: WeeklyReportDailyRow[];
  avgWorkers: number | null;
  fuel: {
    totalLiters: number;
    totalCost: number;
    count: number;
    anomalies: number;
    rows: WeeklyReportFuelRow[];
  };
  deliveries: {
    count: number;
    totalAmount: number;
    rows: WeeklyReportDeliveryRow[];
  };
  hse: {
    mentions: number;
    docsCount: number;
    noteSnippets: string[];
  };
  comment: string | null;
  comparison: BtpWeeklyComparisonMetrics | null;
  budgetBreakdown: BtpBudgetBreakdown;
}

/** Données structurées pour export PDF / PPTX du rapport hebdo chantier. */
export interface WeeklyReportExportPayload {
  title: string;
  subtitle: string;
  isoWeek: string;
  scopeLabel: string;
  orgName?: string | null;
  sections: ReportSection[];
  structured: WeeklyReportExportStructured;
  stats: WeeklyReportExportStats;
  generatedAt?: string;
}

export function slugifyReportFilename(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 72) || 'rapport-chantier'
  );
}

/** Sections destinées au MOA (sans consignes internes). */
export function sectionsForExport(sections: ReportSection[]): ReportSection[] {
  return sections.filter((s) => s.heading !== 'Prochaine étape');
}

export function displayOrgName(orgName?: string | null): string {
  return orgName?.trim() || 'Organisation';
}
