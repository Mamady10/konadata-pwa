'use client';

import { ChartCard, KonaBarChart, KonaLineChart } from '@/components/dashboard/charts';
import type { BtpDashboardData } from '@/lib/btp/dashboard-types';

interface Props {
  dashboard: Pick<BtpDashboardData, 'planifieRealise' | 'consommationCarburant'>;
}

export function BtpDashboardCharts({ dashboard }: Props) {
  const hasPlanifie = dashboard.planifieRealise.length > 0;
  const hasFuel = dashboard.consommationCarburant.length > 0;

  if (!hasPlanifie && !hasFuel) {
    return null;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {hasPlanifie && (
        <ChartCard title="Planifié vs Réalisé (%)">
          <KonaBarChart
            data={dashboard.planifieRealise}
            xKey="semaine"
            bars={[
              { key: 'planifie', color: '#2563EB', name: 'Planifié' },
              { key: 'realise', color: '#10B981', name: 'Réalisé' },
            ]}
          />
        </ChartCard>
      )}
      {hasFuel && (
        <ChartCard title="Consommation carburant (litres)">
          <KonaLineChart
            data={dashboard.consommationCarburant}
            xKey="mois"
            lines={[{ key: 'litres', color: '#F59E0B', name: 'Litres' }]}
          />
        </ChartCard>
      )}
    </div>
  );
}
