import type { BtpAiReportType, NgoAiReportType, SchoolAiReportType } from '@/lib/ai/sector-report-types';
import {
  BTP_AI_REPORT_TYPES,
  NGO_AI_REPORT_TYPES,
  SCHOOL_AI_REPORT_TYPES,
} from '@/lib/ai/sector-report-types';
import type { AiReportSector } from '@/lib/actions/ai-report-archive';

export function getAiReportTypeLabel(sector: AiReportSector, reportType: string): string {
  if (sector === 'btp') {
    return BTP_AI_REPORT_TYPES.find((t) => t.id === reportType)?.label ?? reportType;
  }
  if (sector === 'ngo') {
    return NGO_AI_REPORT_TYPES.find((t) => t.id === reportType)?.label ?? reportType;
  }
  return SCHOOL_AI_REPORT_TYPES.find((t) => t.id === reportType)?.label ?? reportType;
}

export type { BtpAiReportType, NgoAiReportType, SchoolAiReportType };
