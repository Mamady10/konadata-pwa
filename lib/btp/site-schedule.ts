import type { BtpScheduleTask, BtpSiteSchedule } from '@/lib/btp/site-baseline-types';

export function mapScheduleRow(row: Record<string, unknown>): BtpSiteSchedule {
  const tasksRaw = row.tasks;
  const tasks: BtpScheduleTask[] = Array.isArray(tasksRaw)
    ? (tasksRaw as BtpScheduleTask[])
    : [];

  return {
    id: row.id as string,
    siteId: row.site_id as string,
    sourceFilename: (row.source_filename as string) ?? null,
    projectTitle: (row.project_title as string) ?? null,
    startDate: (row.start_date as string)?.slice(0, 10) ?? null,
    endDate: (row.end_date as string)?.slice(0, 10) ?? null,
    taskCount: Number(row.task_count ?? tasks.length),
    tasks,
    importedAt: row.imported_at as string,
  };
}

export function scheduleTasksFromRow(row: Record<string, unknown> | null): BtpScheduleTask[] {
  if (!row) return [];
  return mapScheduleRow(row).tasks;
}
