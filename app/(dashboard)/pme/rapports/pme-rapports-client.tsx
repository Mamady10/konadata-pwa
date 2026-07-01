'use client';

import { ReportItemsList, type ReportListItem } from '@/components/reports/report-items-list';
import { FileText } from 'lucide-react';

interface Props {
  items: ReportListItem[];
}

export function PmeRapportsClient({ items }: Props) {
  return (
    <ReportItemsList
      title="Rapports"
      description="Synthèse commerciale — chaque indicateur exportable en PDF"
      icon={FileText}
      items={items}
      connected
      emptyMessage="Aucune donnée pour générer les rapports."
    />
  );
}
