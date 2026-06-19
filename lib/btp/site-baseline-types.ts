/** Postes budgétaires (niveau B) — pourcentages, total = 100. */
export interface BtpBudgetBreakdown {
  labor?: number;
  materials?: number;
  equipment?: number;
  subcontract?: number;
  overhead?: number;
}

export interface BtpSiteMilestoneInput {
  label: string;
  targetPhysicalPct: number;
  plannedDate: string;
  sortOrder?: number;
}

export interface BtpSiteMilestoneRow extends BtpSiteMilestoneInput {
  id: string;
}

/** Tâche feuille issue d'un import MS Project XML. */
export interface BtpScheduleTask {
  uid: string;
  name: string;
  startDate: string;
  finishDate: string;
  durationDays: number;
  /** Pondération pour le % planifié cumulé (durée en jours ou 1 pour jalon). */
  weight: number;
  isMilestone: boolean;
  outlineLevel: number;
  sortOrder: number;
}

export interface BtpSiteSchedule {
  id: string;
  siteId: string;
  sourceFilename: string | null;
  projectTitle: string | null;
  startDate: string | null;
  endDate: string | null;
  taskCount: number;
  tasks: BtpScheduleTask[];
  importedAt: string;
}

export interface BtpPlannedProgressSnapshot {
  plannedPct: number;
  gapPts: number;
  status: KpiTrafficStatus;
  source: 'ms_project' | 'milestones' | 'linear';
  label: string;
}

export interface BtpSiteBaseline {
  client: string | null;
  contractRef: string | null;
  startDate: string | null;
  endDate: string | null;
  budget: number;
  openingSpent: number;
  description: string | null;
  moaRecipient: string | null;
  plannedAvgWorkers: number | null;
  plannedMonthlyFuelLiters: number | null;
  budgetAlertPct: number;
  budgetBreakdown: BtpBudgetBreakdown;
  milestones: BtpSiteMilestoneRow[];
}

export type KpiTrafficStatus = 'green' | 'amber' | 'red' | 'neutral';

export interface BtpMilestoneComparisonRow {
  label: string;
  targetPhysicalPct: number;
  plannedDate: string;
  actualPhysicalPct: number | null;
  actualDate: string | null;
  gapDays: number | null;
  status: KpiTrafficStatus;
}

export interface BtpWeeklyComparisonMetrics {
  asOfDate: string;
  /** Avancement physique planifié à la date (interpolation jalons). */
  plannedPhysicalPct: number | null;
  actualPhysicalPct: number;
  physicalGapPts: number | null;
  /** % du temps contractuel écoulé. */
  timeElapsedPct: number | null;
  timeVsPhysicalGapPts: number | null;
  budgetPlannedCumulative: number | null;
  budgetConsumedCumulative: number;
  budgetGapAmount: number | null;
  budgetExecutionPct: number | null;
  financialPctAuto: number | null;
  physicalVsFinancialGapPts: number | null;
  milestoneRows: BtpMilestoneComparisonRow[];
  kpis: {
    planning: KpiTrafficStatus;
    budget: KpiTrafficStatus;
    schedule: KpiTrafficStatus;
    overall: KpiTrafficStatus;
  };
  /** Points journaliers planifié vs réalisé (semaine en cours). */
  progressCurve: Array<{
    date: string;
    label: string;
    plannedPct: number | null;
    actualPct: number | null;
  }>;
  /** Courbe S chantier : avancement cumulé sur toute la durée contractuelle. */
  sCurve: Array<{
    date: string;
    label: string;
    plannedPct: number | null;
    actualPct: number | null;
  }>;
  plannedSource: 'ms_project' | 'milestones' | 'linear';
  plannedAvgWorkers: number | null;
  actualAvgWorkersWeek: number | null;
  plannedFuelMonthLiters: number | null;
  actualFuelWeekLiters: number;
}
