import type { ResolvedPlanningRef } from '@/lib/btp/planning-ref';
import { plannedPhysicalPctFromResolvedRef } from '@/lib/btp/planning-ref';
import {
  computeSiteFinancialTotals,
  compareBudgetByPoste,
  type ExpenseCategory,
} from '@/lib/btp/site-financial';
import type {
  BtpBudgetBreakdown,
  BtpScheduleTask,
  BtpSiteBaseline,
  BtpSiteMilestoneRow,
  BtpWeeklyComparisonMetrics,
  BtpPlannedProgressSnapshot,
  KpiTrafficStatus,
  PlanningRefSlot,
} from '@/lib/btp/site-baseline-types';

const MS_PER_DAY = 86_400_000;

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(`${s.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type ProgressCurvePoint = BtpWeeklyComparisonMetrics['progressCurve'][number];

/** Points pour courbe S : planifié sur toute la durée, réalisé jusqu'à la date du rapport. */
export function buildProjectSCurve(params: {
  resolvedRef: ResolvedPlanningRef;
  asOfDate: string;
  dailyProgressAll: Array<{ date: string; physicalPct: number }>;
  maxPoints?: number;
}): ProgressCurvePoint[] {
  const { resolvedRef, asOfDate, dailyProgressAll, maxPoints = 14 } = params;
  const baseline = resolvedRef.baseline;
  const scheduleTasks = resolvedRef.scheduleTasks;
  const start = parseDate(baseline.startDate);
  const end = parseDate(baseline.endDate);
  if (!start || !end) return [];

  const totalDays = daysBetween(start, end);
  if (totalDays <= 0) return [];

  const sortedDaily = [...dailyProgressAll].sort((a, b) => a.date.localeCompare(b.date));
  const asOf = asOfDate.slice(0, 10);

  const datesSet = new Set<string>([toIsoDate(start), toIsoDate(end), asOf]);
  const step = Math.max(7, Math.ceil(totalDays / Math.max(1, maxPoints - 1)));
  for (let d = 0; d <= totalDays; d += step) {
    datesSet.add(toIsoDate(addDays(start, d)));
  }
  for (const m of baseline.milestones) {
    if (m.plannedDate) datesSet.add(m.plannedDate.slice(0, 10));
  }
  if (scheduleTasks) {
    for (const t of scheduleTasks) {
      datesSet.add(t.startDate.slice(0, 10));
      datesSet.add(t.finishDate.slice(0, 10));
    }
  }

  const dates = [...datesSet].sort();
  const longProject = totalDays > 120;

  return dates.map((date) => {
    const planned = plannedPhysicalPctFromResolvedRef(resolvedRef, date);
    let actual: number | null = null;
    if (date <= asOf) {
      const prior = sortedDaily.filter((d) => d.date <= date);
      actual = prior.length > 0 ? prior[prior.length - 1].physicalPct : 0;
    }
    const d = parseDate(date)!;
    const label = longProject
      ? d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
      : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

    return { date, label, plannedPct: planned, actualPct: actual };
  });
}

/** % planifié cumulé à une date à partir des tâches MS Project (pondération par durée). */
export function plannedPhysicalPctFromSchedule(
  tasks: BtpScheduleTask[],
  asOf: string
): number | null {
  if (tasks.length === 0) return null;
  const date = parseDate(asOf);
  if (!date) return null;

  let totalWeight = 0;
  let earned = 0;

  for (const t of tasks) {
    const start = parseDate(t.startDate);
    const finish = parseDate(t.finishDate);
    if (!start || !finish) continue;

    const w = t.weight > 0 ? t.weight : 1;
    totalWeight += w;

    if (date < start) continue;
    if (date >= finish || t.isMilestone) {
      earned += w;
      continue;
    }

    const span = Math.max(1, daysBetween(start, finish));
    const elapsed = daysBetween(start, date);
    earned += w * Math.min(1, Math.max(0, elapsed / span));
  }

  if (totalWeight <= 0) return null;
  return Math.round((earned / totalWeight) * 1000) / 10;
}

export function comparePlannedVsActual(
  plannedPct: number | null,
  actualPct: number,
  source: BtpPlannedProgressSnapshot['source'],
  label: string,
  refSlot: PlanningRefSlot
): BtpPlannedProgressSnapshot | null {
  if (plannedPct == null) return null;
  const gapPts = Math.round((actualPct - plannedPct) * 10) / 10;
  let status: KpiTrafficStatus = 'neutral';
  if (gapPts < -5) status = 'red';
  else if (gapPts < -2) status = 'amber';
  else status = 'green';

  return { plannedPct, gapPts, status, source, label, refSlot };
}

/** Interpolation linéaire de l'avancement planifié à une date donnée. */
export function plannedPhysicalPctAt(
  baseline: Pick<BtpSiteBaseline, 'startDate' | 'endDate' | 'milestones'>,
  asOf: string,
  scheduleTasks?: BtpScheduleTask[] | null
): number | null {
  if (scheduleTasks && scheduleTasks.length > 0) {
    return plannedPhysicalPctFromSchedule(scheduleTasks, asOf);
  }

  const date = parseDate(asOf);
  const start = parseDate(baseline.startDate);
  const end = parseDate(baseline.endDate);
  if (!date || !start || !end) return null;

  const milestones = [...baseline.milestones].sort(
    (a, b) => a.plannedDate.localeCompare(b.plannedDate) || a.sortOrder - b.sortOrder
  );

  if (milestones.length === 0) {
    const totalDays = daysBetween(start, end);
    if (totalDays <= 0) return null;
    const elapsed = daysBetween(start, date);
    const ratio = Math.min(1, Math.max(0, elapsed / totalDays));
    return Math.round(ratio * 1000) / 10;
  }

  const points: { d: Date; pct: number }[] = [{ d: start, pct: 0 }, ...milestones.map((m) => ({
    d: parseDate(m.plannedDate)!,
    pct: m.targetPhysicalPct,
  }))];

  if (date <= points[0].d) return 0;
  const last = points[points.length - 1];
  if (date >= last.d) return Math.min(100, last.pct);

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (date >= a.d && date <= b.d) {
      const span = daysBetween(a.d, b.d);
      if (span <= 0) return b.pct;
      const t = daysBetween(a.d, date) / span;
      return Math.round((a.pct + t * (b.pct - a.pct)) * 10) / 10;
    }
  }
  return null;
}

export function timeElapsedPct(
  startDate: string | null,
  endDate: string | null,
  asOf: string
): number | null {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const date = parseDate(asOf);
  if (!start || !end || !date) return null;
  const total = daysBetween(start, end);
  if (total <= 0) return null;
  const elapsed = daysBetween(start, date);
  return Math.round(Math.min(100, Math.max(0, (elapsed / total) * 100)) * 10) / 10;
}

/** Dépense planifiée cumulée (linéaire sur la durée contractuelle). */
export function plannedBudgetCumulativeAt(
  budget: number,
  startDate: string | null,
  endDate: string | null,
  asOf: string
): number | null {
  const pct = timeElapsedPct(startDate, endDate, asOf);
  if (pct == null || budget <= 0) return null;
  return Math.round((budget * pct) / 100);
}

export function computeConsumedBudget(params: {
  openingSpent: number;
  fuelCosts: number;
  deliveryAmounts: number;
  laborAmounts?: number;
  expensesByCategory?: Partial<Record<ExpenseCategory, number>>;
}): number {
  return computeSiteFinancialTotals({
    budget: 1,
    openingSpent: params.openingSpent,
    fuelCosts: params.fuelCosts,
    deliveryAmounts: params.deliveryAmounts,
    laborEntryAmounts: params.laborAmounts ?? 0,
    expensesByCategory: params.expensesByCategory ?? {},
  }).total;
}

function milestoneStatus(
  plannedDate: string,
  targetPct: number,
  actualPct: number,
  asOf: string
): KpiTrafficStatus {
  const planned = parseDate(plannedDate);
  const now = parseDate(asOf);
  if (!planned || !now) return 'neutral';
  if (actualPct >= targetPct) return 'green';
  if (now > planned) return 'red';
  const daysTo = daysBetween(now, planned);
  if (daysTo <= 14 && actualPct < targetPct * 0.85) return 'amber';
  return 'green';
}

function overallFrom(parts: KpiTrafficStatus[]): KpiTrafficStatus {
  if (parts.includes('red')) return 'red';
  if (parts.includes('amber')) return 'amber';
  if (parts.every((p) => p === 'neutral')) return 'neutral';
  return 'green';
}

export function buildWeeklyComparisonMetrics(params: {
  siteBaseline: BtpSiteBaseline;
  resolvedRef: ResolvedPlanningRef;
  asOfDate: string;
  periodFrom: string;
  periodTo: string;
  actualPhysicalPct: number;
  dailyProgressInWeek: Array<{ date: string; physicalPct: number }>;
  dailyProgressAll: Array<{ date: string; physicalPct: number }>;
  fuelCostToDate: number;
  deliveryAmountToDate: number;
  laborAmountToDate?: number;
  expensesByCategory?: Partial<Record<ExpenseCategory, number>>;
  fuelLitersWeek: number;
  avgWorkersWeek: number | null;
  delayDays: number;
}): BtpWeeklyComparisonMetrics {
  const {
    siteBaseline,
    resolvedRef,
    asOfDate,
    periodFrom,
    periodTo,
    actualPhysicalPct,
    dailyProgressInWeek,
    dailyProgressAll,
    fuelCostToDate,
    deliveryAmountToDate,
    laborAmountToDate = 0,
    expensesByCategory = {},
    fuelLitersWeek,
    avgWorkersWeek,
    delayDays,
  } = params;

  const baseline = {
    ...siteBaseline,
    startDate: resolvedRef.baseline.startDate ?? siteBaseline.startDate,
    endDate: resolvedRef.baseline.endDate ?? siteBaseline.endDate,
    milestones:
      resolvedRef.sourceType === 'milestones'
        ? resolvedRef.baseline.milestones
        : siteBaseline.milestones,
  };

  const plannedPhysical = plannedPhysicalPctFromResolvedRef(resolvedRef, asOfDate);
  const elapsed = timeElapsedPct(baseline.startDate, baseline.endDate, asOfDate);
  const budgetPlanned = plannedBudgetCumulativeAt(
    baseline.budget,
    baseline.startDate,
    baseline.endDate,
    asOfDate
  );
  const financialTotals = computeSiteFinancialTotals({
    budget: baseline.budget,
    openingSpent: baseline.openingSpent,
    fuelCosts: fuelCostToDate,
    deliveryAmounts: deliveryAmountToDate,
    laborEntryAmounts: laborAmountToDate,
    expensesByCategory,
  });
  const budgetConsumed = financialTotals.total;
  const posteComparison = compareBudgetByPoste(
    baseline.budget,
    baseline.budgetBreakdown,
    financialTotals.byPoste
  );

  const budgetExecutionPct =
    baseline.budget > 0 ? Math.round((budgetConsumed / baseline.budget) * 1000) / 10 : null;
  const financialPctAuto = budgetExecutionPct;
  const physicalVsFinancialGapPts =
    financialPctAuto != null ? Math.round((actualPhysicalPct - financialPctAuto) * 10) / 10 : null;

  const physicalGapPts =
    plannedPhysical != null ? Math.round((actualPhysicalPct - plannedPhysical) * 10) / 10 : null;
  const timeVsPhysicalGapPts =
    elapsed != null ? Math.round((actualPhysicalPct - elapsed) * 10) / 10 : null;
  const budgetGapAmount =
    budgetPlanned != null ? Math.round(budgetConsumed - budgetPlanned) : null;

  const milestoneRows = baseline.milestones.map((m) => {
    const reached = [...dailyProgressAll]
      .filter((d) => d.physicalPct >= m.targetPhysicalPct)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    const actualDate = reached?.date ?? null;
    const gapDays =
      actualDate && m.plannedDate
        ? daysBetween(parseDate(m.plannedDate)!, parseDate(actualDate)!)
        : asOfDate > m.plannedDate && !actualDate
          ? daysBetween(parseDate(m.plannedDate)!, parseDate(asOfDate)!)
          : null;

    return {
      label: m.label,
      targetPhysicalPct: m.targetPhysicalPct,
      plannedDate: m.plannedDate,
      actualPhysicalPct: reached ? reached.physicalPct : actualPhysicalPct,
      actualDate,
      gapDays,
      status: milestoneStatus(m.plannedDate, m.targetPhysicalPct, reached?.physicalPct ?? actualPhysicalPct, asOfDate),
    };
  });

  let planningStatus: KpiTrafficStatus = 'neutral';
  if (plannedPhysical != null) {
    if (physicalGapPts! < -5) planningStatus = 'red';
    else if (physicalGapPts! < -2) planningStatus = 'amber';
    else planningStatus = 'green';
  }

  let budgetStatus: KpiTrafficStatus = 'neutral';
  if (baseline.budget > 0 && budgetExecutionPct != null) {
    if (budgetExecutionPct > baseline.budgetAlertPct + 5) budgetStatus = 'red';
    else if (budgetExecutionPct > baseline.budgetAlertPct) budgetStatus = 'amber';
    else if (budgetGapAmount != null && budgetGapAmount > baseline.budget * 0.05) budgetStatus = 'amber';
    else budgetStatus = 'green';
  }

  let scheduleStatus: KpiTrafficStatus = 'neutral';
  if (delayDays > 7) scheduleStatus = 'red';
  else if (delayDays > 0) scheduleStatus = 'amber';
  else if (elapsed != null && timeVsPhysicalGapPts != null) {
    if (timeVsPhysicalGapPts < -10) scheduleStatus = 'red';
    else if (timeVsPhysicalGapPts < -5) scheduleStatus = 'amber';
    else scheduleStatus = 'green';
  }

  const progressCurve: BtpWeeklyComparisonMetrics['progressCurve'] = [];
  const weekDays = dailyProgressInWeek.length > 0 ? dailyProgressInWeek : dailyProgressAll.filter(
    (d) => d.date >= periodFrom && d.date <= periodTo
  );

  for (const d of weekDays) {
    progressCurve.push({
      date: d.date,
      label: new Date(`${d.date}T12:00:00Z`).toLocaleDateString('fr-FR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }),
      plannedPct: plannedPhysicalPctFromResolvedRef(resolvedRef, d.date),
      actualPct: d.physicalPct,
    });
  }

  if (progressCurve.length === 0 && plannedPhysical != null) {
    progressCurve.push({
      date: asOfDate,
      label: 'Fin semaine',
      plannedPct: plannedPhysical,
      actualPct: actualPhysicalPct,
    });
  }

  const sCurve = buildProjectSCurve({
    resolvedRef,
    asOfDate,
    dailyProgressAll,
  });

  return {
    asOfDate,
    plannedPhysicalPct: plannedPhysical,
    actualPhysicalPct,
    physicalGapPts,
    timeElapsedPct: elapsed,
    timeVsPhysicalGapPts,
    budgetPlannedCumulative: budgetPlanned,
    budgetConsumedCumulative: budgetConsumed,
    budgetGapAmount,
    budgetExecutionPct,
    financialPctAuto,
    physicalVsFinancialGapPts,
    milestoneRows,
    kpis: {
      planning: planningStatus,
      budget: budgetStatus,
      schedule: scheduleStatus,
      overall: overallFrom([planningStatus, budgetStatus, scheduleStatus]),
    },
    progressCurve,
    sCurve,
    plannedSource: resolvedRef.sourceType,
    plannedRefSlot: resolvedRef.slot,
    plannedRefLabel: resolvedRef.label,
    plannedAvgWorkers: baseline.plannedAvgWorkers,
    actualAvgWorkersWeek: avgWorkersWeek,
    plannedFuelMonthLiters: baseline.plannedMonthlyFuelLiters,
    actualFuelWeekLiters: fuelLitersWeek,
    budgetByPoste: financialTotals.byPoste,
    posteComparison,
  };
}

export function parseBudgetBreakdown(raw: unknown): BtpBudgetBreakdown {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  const pick = (k: string) => {
    const v = Number(o[k]);
    return Number.isFinite(v) && v >= 0 ? v : undefined;
  };
  return {
    labor: pick('labor'),
    materials: pick('materials'),
    equipment: pick('equipment'),
    subcontract: pick('subcontract'),
    overhead: pick('overhead'),
  };
}

export function normalizeBudgetBreakdownInput(
  labor: number,
  materials: number,
  equipment: number,
  subcontract: number,
  overhead: number
): BtpBudgetBreakdown {
  const total = labor + materials + equipment + subcontract + overhead;
  if (total <= 0) return {};
  const scale = 100 / total;
  return {
    labor: Math.round(labor * scale * 10) / 10,
    materials: Math.round(materials * scale * 10) / 10,
    equipment: Math.round(equipment * scale * 10) / 10,
    subcontract: Math.round(subcontract * scale * 10) / 10,
    overhead: Math.round(overhead * scale * 10) / 10,
  };
}

export function mapSiteRowToBaseline(
  site: Record<string, unknown>,
  milestones: BtpSiteMilestoneRow[]
): BtpSiteBaseline {
  return {
    client: (site.client as string) ?? null,
    contractRef: (site.contract_ref as string) ?? null,
    startDate: (site.start_date as string)?.slice(0, 10) ?? null,
    endDate: (site.end_date as string)?.slice(0, 10) ?? null,
    budget: Number(site.budget ?? 0),
    openingSpent: Number(site.opening_spent ?? site.spent ?? 0),
    description: (site.description as string) ?? null,
    moaRecipient: (site.moa_recipient as string) ?? null,
    plannedAvgWorkers:
      site.planned_avg_workers != null ? Number(site.planned_avg_workers) : null,
    plannedMonthlyFuelLiters:
      site.planned_monthly_fuel_liters != null
        ? Number(site.planned_monthly_fuel_liters)
        : null,
    budgetAlertPct: Number(site.budget_alert_pct ?? 90),
    budgetBreakdown: parseBudgetBreakdown(site.budget_breakdown),
    milestones,
  };
}

export const BUDGET_POSTE_LABELS: Record<keyof BtpBudgetBreakdown, string> = {
  labor: "Main d'oeuvre",
  materials: 'Matériaux',
  equipment: 'Engins & équipements',
  subcontract: 'Sous-traitance',
  overhead: 'Frais généraux',
};

export function kpiStatusLabel(status: KpiTrafficStatus): string {
  switch (status) {
    case 'green':
      return 'Conforme';
    case 'amber':
      return 'Vigilance';
    case 'red':
      return 'Alerte';
    default:
      return '—';
  }
}
