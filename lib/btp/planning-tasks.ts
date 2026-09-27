import type {
  BtpScheduleTask,
  BtpTaskProgressEntry,
  KpiTrafficStatus,
} from '@/lib/btp/site-baseline-types';

/** Tâche saisie dans KonaData (création chantier ou référence planning). */
export interface BtpPlanningTaskInput {
  uid: string;
  name: string;
  startDate: string;
  finishDate: string;
}

const MS_PER_DAY = 86_400_000;

function parseIso(s: string | null | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  const d = new Date(`${s.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function addDaysIso(iso: string, days: number): string {
  const d = parseIso(iso);
  if (!d) return '';
  return new Date(d.getTime() + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Durée en jours calendaires, début et fin inclus (01/10 → 30/10 = 30 j). */
export function taskDurationDays(startDate: string, finishDate: string): number | null {
  const start = parseIso(startDate);
  const finish = parseIso(finishDate);
  if (!start || !finish) return null;
  const diff = daysBetween(start, finish);
  return diff < 0 ? null : diff + 1;
}

/** Date de fin pour une durée donnée (jours calendaires, début inclus). */
export function finishDateFromDuration(startDate: string, durationDays: number): string {
  if (!startDate || !Number.isFinite(durationDays) || durationDays < 1) return '';
  return addDaysIso(startDate, Math.round(durationDays) - 1);
}

export function newTaskUid(): string {
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizePlanningTasks(
  raw: unknown
): { tasks: BtpPlanningTaskInput[] } | { error: string } {
  if (!Array.isArray(raw)) return { error: 'Format des tâches invalide.' };

  const tasks: BtpPlanningTaskInput[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const name = String(o.name ?? '').trim();
    const startDate = String(o.startDate ?? '').slice(0, 10);
    const finishDate = String(o.finishDate ?? '').slice(0, 10);

    if (!name && !startDate && !finishDate) continue;

    const label = name || `Tâche ${tasks.length + 1}`;
    if (!name) return { error: `${label} : indiquez le nom de la tâche.` };
    if (!parseIso(startDate)) return { error: `Tâche « ${name} » : date de début manquante.` };
    if (!parseIso(finishDate)) return { error: `Tâche « ${name} » : date de fin manquante.` };
    if (taskDurationDays(startDate, finishDate) == null) {
      return { error: `Tâche « ${name} » : la date de fin doit être après la date de début.` };
    }

    let uid = String(o.uid ?? '').trim();
    if (!uid || seen.has(uid)) uid = newTaskUid();
    seen.add(uid);

    tasks.push({ uid, name, startDate, finishDate });
  }

  return { tasks };
}

/** Poids = durée de la tâche (jours calendaires). */
export function planningTasksToSchedule(tasks: BtpPlanningTaskInput[]): BtpScheduleTask[] {
  return tasks.map((t, i) => {
    const durationDays = taskDurationDays(t.startDate, t.finishDate) ?? 1;
    return {
      uid: t.uid,
      name: t.name,
      startDate: t.startDate,
      finishDate: t.finishDate,
      durationDays,
      weight: durationDays,
      isMilestone: false,
      outlineLevel: 1,
      sortOrder: i,
    };
  });
}

export function scheduleToPlanningTasks(tasks: BtpScheduleTask[]): BtpPlanningTaskInput[] {
  return tasks.map((t) => ({
    uid: t.uid,
    name: t.name,
    startDate: t.startDate.slice(0, 10),
    finishDate: t.finishDate.slice(0, 10),
  }));
}

function effectiveWeight(t: { weight: number }): number {
  return t.weight > 0 ? t.weight : 1;
}

/** Poids de chaque tâche en % du chantier. */
export function taskWeightPcts(tasks: Array<{ uid: string; weight: number }>): Record<string, number> {
  const total = tasks.reduce((s, t) => s + effectiveWeight(t), 0);
  const out: Record<string, number> = {};
  for (const t of tasks) {
    out[t.uid] = total > 0 ? round1((effectiveWeight(t) / total) * 100) : 0;
  }
  return out;
}

/** % prévu d'une tâche à une date (progression régulière entre début et fin). */
export function plannedTaskPctAt(
  task: Pick<BtpScheduleTask, 'startDate' | 'finishDate' | 'isMilestone'>,
  asOf: string
): number {
  const date = parseIso(asOf);
  const start = parseIso(task.startDate);
  const finish = parseIso(task.finishDate);
  if (!date || !start || !finish) return 0;
  if (date < start) return 0;
  if (date >= finish || task.isMilestone) return 100;
  const span = Math.max(1, daysBetween(start, finish));
  return round1(Math.min(1, Math.max(0, daysBetween(start, date) / span)) * 100);
}

/** Avancement global du chantier = Σ poids × % réalisé de la tâche. */
export function globalPctFromTasks(
  tasks: Array<{ uid: string; weight: number }>,
  pctByUid: Record<string, number>
): number {
  const total = tasks.reduce((s, t) => s + effectiveWeight(t), 0);
  if (total <= 0) return 0;
  const earned = tasks.reduce((s, t) => {
    const pct = Math.min(100, Math.max(0, Number(pctByUid[t.uid] ?? 0)));
    return s + effectiveWeight(t) * (pct / 100);
  }, 0);
  return round1((earned / total) * 100);
}

export function parseTaskProgress(raw: unknown): BtpTaskProgressEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: BtpTaskProgressEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const uid = String(o.uid ?? '').trim();
    const pct = Number(o.pct);
    if (!uid || !Number.isFinite(pct)) continue;
    out.push({
      uid,
      name: String(o.name ?? ''),
      pct: Math.min(100, Math.max(0, pct)),
      weight: o.weight != null && Number.isFinite(Number(o.weight)) ? Number(o.weight) : undefined,
    });
  }
  return out;
}

export function taskProgressStatus(
  plannedPct: number,
  actualPct: number | null,
  finishDate: string,
  asOf: string
): KpiTrafficStatus {
  if (actualPct == null) return 'neutral';
  if (actualPct >= 100) return 'green';
  if (asOf.slice(0, 10) > finishDate.slice(0, 10)) return 'red';
  const gap = actualPct - plannedPct;
  if (gap < -15) return 'red';
  if (gap < -5) return 'amber';
  return 'green';
}
