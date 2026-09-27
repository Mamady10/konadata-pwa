import type { ReportSection } from '@/lib/ai/reports/render-report';

import type {
  BtpBudgetBreakdown,
  BtpWeeklyComparisonMetrics,
  KpiTrafficStatus,
} from '@/lib/btp/site-baseline-types';
import type { ReportPeriodType } from '@/lib/btp/report-period';

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

export interface WeeklyReportImage {
  base64: string;
  format: 'PNG' | 'JPEG';
  width: number;
  height: number;
}

export interface WeeklyReportPhoto extends WeeklyReportImage {
  caption: string;
  dateLabel: string;
}

export type WeeklyReportUpcomingEvent = 'start' | 'finish' | 'ongoing';

export interface WeeklyReportUpcomingTask {
  name: string;
  startDate: string;
  finishDate: string;
  event: WeeklyReportUpcomingEvent;
  /** % prévu de la tâche à la fin de la période suivante. */
  plannedPctAtEnd: number;
  actualPct: number | null;
}

export interface WeeklyReportUpcoming {
  label: string;
  from: string;
  to: string;
  tasks: WeeklyReportUpcomingTask[];
}

export interface WeeklyReportSignatories {
  preparedBy: string | null;
  moa: string | null;
}

export const UPCOMING_EVENT_LABELS: Record<WeeklyReportUpcomingEvent, string> = {
  start: 'Démarrage',
  finish: 'Fin prévue',
  ongoing: 'En cours',
};

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
  logo?: WeeklyReportImage | null;
  photos?: WeeklyReportPhoto[];
  upcoming?: WeeklyReportUpcoming | null;
  signatories?: WeeklyReportSignatories;
  /** Rapport sans données financières (budget, dépensé, reste, montants). */
  hideFinancials?: boolean;
}

const KPI_SEVERITY: Record<KpiTrafficStatus, number> = { neutral: 0, green: 1, amber: 2, red: 3 };

/** Retire du rapport toutes les données financières (le rapport reste identique pour le reste). */
export function stripReportFinancials(s: WeeklyReportExportStructured): WeeklyReportExportStructured {
  const c = s.comparison;
  const overall: KpiTrafficStatus = c
    ? KPI_SEVERITY[c.kpis.planning] >= KPI_SEVERITY[c.kpis.schedule]
      ? c.kpis.planning
      : c.kpis.schedule
    : 'neutral';
  return {
    ...s,
    hideFinancials: true,
    synthesis: { ...s.synthesis, financialPct: 0, budget: 0, spent: 0 },
    budgetBreakdown: {},
    fuel: { ...s.fuel, totalCost: 0 },
    deliveries: {
      ...s.deliveries,
      totalAmount: 0,
      rows: s.deliveries.rows.map((r) => ({ ...r, amount: 0 })),
    },
    comparison: c
      ? {
          ...c,
          budgetPlannedCumulative: null,
          budgetConsumedCumulative: 0,
          budgetGapAmount: null,
          budgetExecutionPct: null,
          financialPctAuto: null,
          physicalVsFinancialGapPts: null,
          kpis: { ...c.kpis, budget: 'neutral', overall },
          budgetByPoste: { labor: 0, materials: 0, equipment: 0, subcontract: 0, overhead: 0, other: 0 },
          posteComparison: [],
        }
      : null,
  };
}

/** Données structurées pour export PDF / PPTX du rapport hebdo chantier. */
export interface WeeklyReportExportPayload {
  title: string;
  subtitle: string;
  isoWeek?: string;
  periodType: ReportPeriodType;
  periodValue: string;
  periodLabel: string;
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

/** Date de génération lisible (« 27 septembre 2026 à 13:21 »), même si on reçoit un ISO. */
export function formatReportGeneratedAt(value?: string | null): string {
  const raw = value?.trim();
  const date = !raw ? new Date() : /^\d{4}-\d{2}-\d{2}T/.test(raw) ? new Date(raw) : null;
  if (!date) return raw ?? '';
  if (Number.isNaN(date.getTime())) return raw ?? '';
  return date.toLocaleString('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Africa/Conakry',
  });
}
