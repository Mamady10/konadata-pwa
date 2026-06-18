import type { ReportSection } from '@/lib/ai/reports/render-report';

export interface WeeklyReportExportStats {
  dailyEntries: number;
  fuelLogs: number;
  deliveryNotes: number;
  hseMentions: number;
}

/** Données structurées pour export PDF / PPTX du rapport hebdo chantier. */
export interface WeeklyReportExportPayload {
  title: string;
  subtitle: string;
  isoWeek: string;
  scopeLabel: string;
  orgName?: string | null;
  sections: ReportSection[];
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
