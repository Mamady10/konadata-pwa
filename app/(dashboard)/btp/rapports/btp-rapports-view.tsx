'use client';

import { SectorPage } from '@/components/dashboard/sector-page';
import { SectorAiReportPanel } from '@/components/ai/sector-ai-report-panel';
import { generateBtpAiReport } from '@/lib/actions/ai-reports';
import { BTP_AI_REPORT_TYPES, type BtpAiReportType } from '@/lib/ai/sector-report-types';
import { AiReportHistory } from '@/components/ai/ai-report-history';
import type { AiGeneratedReportRow } from '@/lib/actions/ai-report-archive';
import { FileText } from 'lucide-react';

interface SiteOption {
  id: string;
  name: string;
}

interface ReportItem {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  date?: string;
}

interface Props {
  isDirector: boolean;
  sites: SiteOption[];
  items: ReportItem[];
  description: string;
  reportHistory: AiGeneratedReportRow[];
}

export function BtpRapportsView({ isDirector, sites, items, description, reportHistory }: Props) {
  return (
    <div className="space-y-6">
      {isDirector && (
        <SectorAiReportPanel
          sectorLabel="BTP"
          scopeLabel="Chantier"
          scopeOptions={sites.map((s) => ({ id: s.id, label: s.name }))}
          reportTypes={BTP_AI_REPORT_TYPES}
          onGenerate={(scopeId, reportType) =>
            generateBtpAiReport(scopeId, reportType as BtpAiReportType)
          }
        />
      )}
      {isDirector && <AiReportHistory history={reportHistory} sectorLabel="BTP" />}
      <SectorPage
        title="Rapports BTP"
        description={description}
        icon={FileText}
        items={items}
        connected
        emptyMessage="Aucun rapport disponible."
      />
    </div>
  );
}
