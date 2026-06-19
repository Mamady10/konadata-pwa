import type { BtpScheduleTask } from '@/lib/btp/site-baseline-types';

export interface MsProjectParseResult {
  projectTitle: string;
  startDate: string | null;
  endDate: string | null;
  tasks: BtpScheduleTask[];
  warnings: string[];
}

function readTag(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const m = block.match(re);
  if (!m) return null;
  const raw = m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1').trim();
  return raw || null;
}

function parseIsoDate(value: string | null): string | null {
  if (!value) return null;
  const d = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

/** Durée MS Project PT80H0M0S → jours (8 h/jour). */
function parseDurationDays(duration: string | null, start: string | null, finish: string | null): number {
  if (duration) {
    const dayMatch = duration.match(/P(\d+(?:\.\d+)?)D/i);
    if (dayMatch) return Math.max(0, Number(dayMatch[1]));
    const hourMatch = duration.match(/PT(\d+(?:\.\d+)?)H/i);
    if (hourMatch) return Math.max(0, Number(hourMatch[1]) / 8);
  }
  if (start && finish) {
    const a = new Date(`${start.slice(0, 10)}T12:00:00Z`).getTime();
    const b = new Date(`${finish.slice(0, 10)}T12:00:00Z`).getTime();
    if (!Number.isNaN(a) && !Number.isNaN(b) && b >= a) {
      return Math.max(0, Math.round((b - a) / 86_400_000));
    }
  }
  return 0;
}

function isTruthyFlag(value: string | null): boolean {
  return value === '1' || value?.toLowerCase() === 'true';
}

/**
 * Parse un export XML MS Project (Fichier → Exporter → Fichier XML).
 * Conserve les tâches feuilles (non récapitulatives) pour le % planifié pondéré.
 */
export function parseMsProjectXml(xml: string): MsProjectParseResult {
  const warnings: string[] = [];
  const normalized = xml.replace(/^\uFEFF/, '').trim();
  if (!normalized.includes('<Project') && !normalized.includes('<Task')) {
    throw new Error('Fichier XML MS Project non reconnu.');
  }

  const projectTitle =
    readTag(normalized, 'Title') ||
    readTag(normalized, 'Name') ||
    'Projet MS Project';

  const taskBlocks = [...normalized.matchAll(/<Task>([\s\S]*?)<\/Task>/gi)].map((m) => m[1]);
  if (taskBlocks.length === 0) {
    throw new Error('Aucune tâche trouvée dans le fichier XML.');
  }

  const rawTasks: Array<{
    uid: string;
    name: string;
    start: string | null;
    finish: string | null;
    durationDays: number;
    isSummary: boolean;
    isMilestone: boolean;
    outlineLevel: number;
    isNull: boolean;
  }> = [];

  for (const block of taskBlocks) {
    const uid = readTag(block, 'UID') ?? readTag(block, 'ID') ?? '';
    const name = (readTag(block, 'Name') ?? '').trim();
    const isNull = isTruthyFlag(readTag(block, 'IsNull'));
    if (!name || isNull) continue;

    const start =
      parseIsoDate(readTag(block, 'Start')) ||
      parseIsoDate(readTag(block, 'ManualStart')) ||
      parseIsoDate(readTag(block, 'BaselineStart'));
    const finish =
      parseIsoDate(readTag(block, 'Finish')) ||
      parseIsoDate(readTag(block, 'ManualFinish')) ||
      parseIsoDate(readTag(block, 'BaselineFinish'));

    if (!start || !finish) continue;

    const isSummary = isTruthyFlag(readTag(block, 'Summary'));
    const isMilestone = isTruthyFlag(readTag(block, 'Milestone'));
    const durationDays = parseDurationDays(readTag(block, 'Duration'), start, finish);
    const outlineLevel = Number(readTag(block, 'OutlineLevel') ?? 1) || 1;

    rawTasks.push({
      uid: uid || String(rawTasks.length + 1),
      name,
      start,
      finish,
      durationDays: isMilestone ? 0 : Math.max(1, durationDays),
      isSummary,
      isMilestone,
      outlineLevel,
      isNull,
    });
  }

  const summaryUids = new Set(
    rawTasks.filter((t) => t.isSummary).map((t) => t.uid)
  );

  let leafTasks = rawTasks.filter((t) => !t.isSummary && t.name);
  if (leafTasks.length === 0) {
    warnings.push('Aucune tâche feuille — utilisation de toutes les tâches non vides.');
    leafTasks = rawTasks.filter((t) => t.name && !summaryUids.has(t.uid));
  }
  if (leafTasks.length === 0) {
    throw new Error('Impossible d\'extraire des tâches exploitables (vérifiez l\'export XML).');
  }

  const tasks: BtpScheduleTask[] = leafTasks.map((t, i) => ({
    uid: t.uid,
    name: t.name,
    startDate: t.start!,
    finishDate: t.finish!,
    durationDays: t.durationDays,
    weight: t.isMilestone ? 1 : Math.max(1, t.durationDays),
    isMilestone: t.isMilestone,
    outlineLevel: t.outlineLevel,
    sortOrder: i,
  }));

  const starts = tasks.map((t) => t.startDate).sort();
  const finishes = tasks.map((t) => t.finishDate).sort();

  return {
    projectTitle,
    startDate: starts[0] ?? null,
    endDate: finishes[finishes.length - 1] ?? null,
    tasks,
    warnings,
  };
}

export function summarizeScheduleImport(result: MsProjectParseResult): {
  taskCount: number;
  startDate: string | null;
  endDate: string | null;
  milestoneCount: number;
  topTasks: Array<{ name: string; startDate: string; finishDate: string; durationDays: number }>;
} {
  return {
    taskCount: result.tasks.length,
    startDate: result.startDate,
    endDate: result.endDate,
    milestoneCount: result.tasks.filter((t) => t.isMilestone).length,
    topTasks: result.tasks.slice(0, 8).map((t) => ({
      name: t.name,
      startDate: t.startDate,
      finishDate: t.finishDate,
      durationDays: t.durationDays,
    })),
  };
}
