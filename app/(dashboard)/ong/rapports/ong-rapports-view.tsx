'use client';

import { SectorPage } from '@/components/dashboard/sector-page';
import { SectorAiReportPanel } from '@/components/ai/sector-ai-report-panel';
import { generateNgoAiReport } from '@/lib/actions/ai-reports';
import { NGO_AI_REPORT_TYPES, type NgoAiReportType } from '@/lib/ai/sector-report-types';
import { AiReportHistory } from '@/components/ai/ai-report-history';
import type { AiGeneratedReportRow } from '@/lib/actions/ai-report-archive';
import { FileText } from 'lucide-react';

interface ProjectOption {
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
  projects: ProjectOption[];
  items: ReportItem[];
  description: string;
  reportHistory: AiGeneratedReportRow[];
}

export function OngRapportsView({ isDirector, projects, items, description, reportHistory }: Props) {
  return (
    <div className="space-y-6">
      {isDirector && (
        <SectorAiReportPanel
          sectorLabel="ONG"
          scopeLabel="Projet"
          scopeOptions={projects.map((p) => ({ id: p.id, label: p.name }))}
          reportTypes={NGO_AI_REPORT_TYPES}
          onGenerate={(scopeId, reportType) =>
            generateNgoAiReport(scopeId, reportType as NgoAiReportType)
          }
        />
      )}
      {isDirector && <AiReportHistory history={reportHistory} sectorLabel="ONG" />}
      <SectorPage
        title="Rapports ONG"
        description={description}
        icon={FileText}
        items={items}
        connected
        emptyMessage={
          isDirector
            ? 'Aucun rapport disponible.'
            : 'Aucun rapport sur vos projets. Uploadez des documents depuis la page Documents.'
        }
      />
    </div>
  );
}
