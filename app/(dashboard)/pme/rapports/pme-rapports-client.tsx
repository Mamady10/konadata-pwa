'use client';

import { ReportItemsList, type ReportListItem } from '@/components/reports/report-items-list';
import { FileText } from 'lucide-react';
import { PmeFinancialReport } from '@/components/pme/pme-financial-report';
import { PmeBoutiqueComparisonPanel } from '@/components/pme/pme-boutique-comparison';

interface Props {
  items: ReportListItem[];
  boutiques: { id: string; name: string }[];
}

export function PmeRapportsClient({ items, boutiques }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Rapports</h1>
        <p className="text-muted-foreground">
          Analyse financière détaillée et indicateurs commerciaux, exportables en PDF.
        </p>
      </div>

      <PmeFinancialReport boutiques={boutiques} />

      {boutiques.length > 0 && <PmeBoutiqueComparisonPanel />}

      <ReportItemsList
        title="Indicateurs synthèse"
        description="Chaque indicateur exportable en PDF"
        icon={FileText}
        items={items}
        connected
        emptyMessage="Aucune donnée pour générer les rapports."
      />
    </div>
  );
}
