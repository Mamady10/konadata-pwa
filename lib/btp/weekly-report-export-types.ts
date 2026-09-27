import type { ReportSection } from '@/lib/ai/reports/render-report';

import type { BtpBudgetBreakdown, BtpWeeklyComparisonMetrics } from '@/lib/btp/site-baseline-types';
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
