'use client';

import { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  addDaysIso,
  finishDateFromDuration,
  newTaskUid,
  taskDurationDays,
  taskWeightPcts,
  type BtpPlanningTaskInput,
} from '@/lib/btp/planning-tasks';

interface Props {
  tasks: BtpPlanningTaskInput[];
  onChange: (tasks: BtpPlanningTaskInput[]) => void;
  /** Dates du chantier, pour signaler les tâches hors période. */
  siteStartDate?: string;
  siteEndDate?: string;
}

export function emptyPlanningTask(startDate = ''): BtpPlanningTaskInput {
  return { uid: newTaskUid(), name: '', startDate, finishDate: '' };
}

export function defaultPlanningTasks(): BtpPlanningTaskInput[] {
  return [
    { ...emptyPlanningTask(), name: 'Installation de chantier' },
    { ...emptyPlanningTask(), name: 'Fondations' },
    { ...emptyPlanningTask(), name: 'Gros oeuvre' },
    { ...emptyPlanningTask(), name: 'Finitions' },
  ];
}

/** Tâches complètes (nom + dates valides), prêtes à être envoyées au serveur. */
export function filledPlanningTasks(tasks: BtpPlanningTaskInput[]): BtpPlanningTaskInput[] {
  return tasks.filter((t) => t.name.trim() || t.startDate || t.finishDate);
}

export function BtpTaskPlanningEditor({ tasks, onChange, siteStartDate, siteEndDate }: Props) {
  const weights = useMemo(() => {
    const valid = tasks
      .map((t) => ({ uid: t.uid, weight: taskDurationDays(t.startDate, t.finishDate) ?? 0 }))
      .filter((t) => t.weight > 0);
    return taskWeightPcts(valid);
  }, [tasks]);

  const totalDays = tasks.reduce((s, t) => s + (taskDurationDays(t.startDate, t.finishDate) ?? 0), 0);

  function update(index: number, patch: Partial<BtpPlanningTaskInput>) {
    const next = [...tasks];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  }

  function setDuration(index: number, raw: string) {
    const task = tasks[index];
    const days = Number(raw);
    if (!task.startDate || !Number.isFinite(days) || days < 1) return;
    update(index, { finishDate: finishDateFromDuration(task.startDate, days) });
  }

  function addTask() {
    const last = tasks[tasks.length - 1];
    const start = last?.finishDate ? addDaysIso(last.finishDate, 1) : last?.startDate || siteStartDate || '';
    onChange([...tasks, emptyPlanningTask(start)]);
  }

  return (
    <div className="space-y-2">
      <div className="hidden sm:grid gap-2 sm:grid-cols-[1fr_140px_140px_90px_70px_auto] text-[11px] font-medium text-muted-foreground px-1">
        <span>Tâche</span>
        <span>Début</span>
        <span>Fin</span>
        <span>Durée (j)</span>
        <span>Poids</span>
        <span className="w-9" />
      </div>

      {tasks.map((t, i) => {
        const duration = taskDurationDays(t.startDate, t.finishDate);
        const invalidRange = Boolean(t.startDate && t.finishDate && duration == null);
        const outOfSite =
          (siteStartDate && t.startDate && t.startDate < siteStartDate) ||
          (siteEndDate && t.finishDate && t.finishDate > siteEndDate);
        return (
          <div key={t.uid} className="space-y-1">
            <div className="grid gap-2 sm:grid-cols-[1fr_140px_140px_90px_70px_auto] items-center">
              <Input
                placeholder="Tâche (ex. Fondations)"
                value={t.name}
                onChange={(e) => update(i, { name: e.target.value })}
              />
              <Input
                type="date"
                aria-label="Date de début"
                value={t.startDate}
                onChange={(e) => {
                  const startDate = e.target.value;
                  const keep = duration != null && startDate ? finishDateFromDuration(startDate, duration) : t.finishDate;
                  update(i, { startDate, finishDate: keep });
                }}
              />
              <Input
                type="date"
                aria-label="Date de fin"
                value={t.finishDate}
                min={t.startDate || undefined}
                onChange={(e) => update(i, { finishDate: e.target.value })}
              />
              <Input
                type="number"
                min={1}
                aria-label="Durée en jours"
                placeholder="j"
                disabled={!t.startDate}
                title={t.startDate ? undefined : 'Indiquez d’abord la date de début'}
                value={duration ?? ''}
                onChange={(e) => setDuration(i, e.target.value)}
              />
              <span className="text-sm tabular-nums text-muted-foreground px-1">
                {weights[t.uid] != null ? `${weights[t.uid]} %` : '—'}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground"
                onClick={() => onChange(tasks.filter((_, j) => j !== i))}
                disabled={tasks.length <= 1}
                aria-label="Supprimer la tâche"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            {invalidRange && (
              <p className="text-[11px] text-destructive px-1">La date de fin doit être après la date de début.</p>
            )}
            {!invalidRange && outOfSite && (
              <p className="text-[11px] text-amber-700 px-1">Cette tâche dépasse les dates du chantier.</p>
            )}
          </div>
        );
      })}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={addTask}>
          <Plus className="h-3.5 w-3.5" /> Tâche
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Durée en jours calendaires (début et fin inclus). Poids calculé automatiquement = durée de la
          tâche / durée totale{totalDays > 0 ? ` (${totalDays} j)` : ''}.
        </p>
      </div>
    </div>
  );
}
