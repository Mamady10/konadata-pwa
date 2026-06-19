import type {
  BtpScheduleTask,
  BtpSiteMilestoneInput,
  BtpSiteMilestoneRow,
  PlanningRefSlot,
  PlanningSourceType,
} from '@/lib/btp/site-baseline-types';
import type { BtpSiteBaseline } from '@/lib/btp/site-baseline-types';
import {
  plannedPhysicalPctAt,
  plannedPhysicalPctFromSchedule,
} from '@/lib/btp/site-baseline';

export interface BtpSitePlanningRef {
  id: string;
  siteId: string;
  slot: PlanningRefSlot;
  label: string;
  sourceType: PlanningSourceType;
  startDate: string | null;
  endDate: string | null;
  milestones: BtpSiteMilestoneInput[];
  tasks: BtpScheduleTask[];
  sourceFilename: string | null;
  projectTitle: string | null;
  updatedAt: string;
}

export interface ResolvedPlanningRef {
  slot: PlanningRefSlot;
  label: string;
  sourceType: PlanningSourceType;
  baseline: Pick<BtpSiteBaseline, 'startDate' | 'endDate' | 'milestones'>;
  scheduleTasks: BtpScheduleTask[] | null;
}

export function mapPlanningRefRow(row: Record<string, unknown>): BtpSitePlanningRef {
  const milestonesRaw = row.milestones;
  const tasksRaw = row.tasks;
  return {
    id: row.id as string,
    siteId: row.site_id as string,
    slot: Number(row.slot) as PlanningRefSlot,
    label: row.label as string,
    sourceType: row.source_type as PlanningSourceType,
    startDate: (row.start_date as string)?.slice(0, 10) ?? null,
    endDate: (row.end_date as string)?.slice(0, 10) ?? null,
    milestones: Array.isArray(milestonesRaw) ? (milestonesRaw as BtpSiteMilestoneInput[]) : [],
    tasks: Array.isArray(tasksRaw) ? (tasksRaw as BtpScheduleTask[]) : [],
    sourceFilename: (row.source_filename as string) ?? null,
    projectTitle: (row.project_title as string) ?? null,
    updatedAt: row.updated_at as string,
  };
}

export function planningRefSummary(ref: BtpSitePlanningRef): string {
  switch (ref.sourceType) {
    case 'ms_project':
      return `${ref.label} · MS Project (${ref.tasks.length} tâches)`;
    case 'milestones':
      return `${ref.label} · ${ref.milestones.length} jalon(s)`;
    default:
      return `${ref.label} · Dates début/fin`;
  }
}

export function resolvePlanningRef(
  siteBaseline: BtpSiteBaseline,
  ref: BtpSitePlanningRef
): ResolvedPlanningRef {
  const startDate = ref.startDate ?? siteBaseline.startDate;
  const endDate = ref.endDate ?? siteBaseline.endDate;

  const milestoneRows: BtpSiteMilestoneRow[] = ref.milestones.map((m, i) => ({
    id: `ref-${ref.slot}-${i}`,
    label: m.label,
    targetPhysicalPct: Number(m.targetPhysicalPct),
    plannedDate: m.plannedDate,
    sortOrder: m.sortOrder ?? i,
  }));

  return {
    slot: ref.slot,
    label: ref.label,
    sourceType: ref.sourceType,
    baseline: {
      startDate,
      endDate,
      milestones: ref.sourceType === 'milestones' ? milestoneRows : [],
    },
    scheduleTasks:
      ref.sourceType === 'ms_project' && ref.tasks.length > 0 ? ref.tasks : null,
  };
}

export function plannedPhysicalPctFromResolvedRef(
  resolved: ResolvedPlanningRef,
  asOf: string
): number | null {
  if (resolved.sourceType === 'ms_project' && resolved.scheduleTasks) {
    return plannedPhysicalPctFromSchedule(resolved.scheduleTasks, asOf);
  }
  return plannedPhysicalPctAt(resolved.baseline, asOf, null);
}

export const PLANNING_REF_SLOT_LABELS: Record<PlanningRefSlot, string> = {
  1: 'Référence 1',
  2: 'Référence 2',
};

export const PLANNING_SOURCE_LABELS: Record<PlanningSourceType, string> = {
  linear: 'Dates début / fin uniquement',
  milestones: 'Jalons KonaData',
  ms_project: 'Import MS Project (XML)',
};
