'use server';

import { requireOrgId } from '@/lib/actions/org';
import { buildWeeklyReportPptxBuffer } from '@/lib/btp/build-weekly-report-pptx';
import type { WeeklyReportExportPayload } from '@/lib/btp/weekly-report-export-types';
import { slugifyReportFilename } from '@/lib/btp/weekly-report-export-types';

export async function exportWeeklyReportPptxAction(
  payload: WeeklyReportExportPayload
): Promise<{ base64: string; fileName: string } | { error: string }> {
  try {
    await requireOrgId();
    const buffer = await buildWeeklyReportPptxBuffer(payload);
    const fileName = `${slugifyReportFilename(payload.title)}-${payload.isoWeek}.pptx`;
    return { base64: buffer.toString('base64'), fileName };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Export PowerPoint impossible.' };
  }
}
