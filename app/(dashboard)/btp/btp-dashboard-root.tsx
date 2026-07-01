'use client';

import { Suspense, lazy, useMemo } from 'react';
import { BtpDashboardClient } from './dashboard-client';
import { BtpDashboardSkeleton, BtpDashboardChartsSkeleton } from '@/components/btp/btp-dashboard-skeleton';
import { useBtpOrgDashboard, useBtpPersonalDashboard } from '@/lib/btp/use-btp-dashboard';
import { buildBtpRecommendations } from '@/lib/ai/recommendations';
import { Button } from '@/components/ui/button';

const BtpDashboardCharts = lazy(() =>
  import('./btp-dashboard-charts').then((m) => ({ default: m.BtpDashboardCharts }))
);

interface Props {
  orgId: string;
  orgName: string;
  title: string;
  viewMode: 'organization' | 'personal';
  showAiRecommendations: boolean;
}

export function BtpDashboardRoot({ orgId, orgName, title, viewMode, showAiRecommendations }: Props) {
  const isOrgView = viewMode === 'organization';
  const orgQuery = useBtpOrgDashboard(orgId, isOrgView);
  const personalQuery = useBtpPersonalDashboard(orgId, !isOrgView);

  const recommendations = useMemo(() => {
    const dashboard = orgQuery.data;
    if (!isOrgView || !dashboard || !showAiRecommendations) return [];
    return buildBtpRecommendations({
      sites: dashboard.kpis.chantiers,
      activeSites: dashboard.kpis.chantiersActifs,
      avgProgress: dashboard.kpis.tauxAvancement,
      fuelAnomalies: dashboard.alertesCarburant.length,
      stockAlerts: dashboard.kpis.alertesStock,
      delayedSites: dashboard.chantiersActifs.filter((c) => c.retard > 0).length,
    });
  }, [orgQuery.data, showAiRecommendations, isOrgView]);

  if (!isOrgView) {
    if (personalQuery.isPending && !personalQuery.data) {
      return <BtpDashboardSkeleton />;
    }
    return (
      <BtpDashboardClient
        orgName={orgName}
        title={title}
        viewMode="personal"
        personal={personalQuery.data ?? null}
        dashboard={null}
        recommendations={[]}
        showAiRecommendations={false}
        isRefreshing={personalQuery.isFetching && Boolean(personalQuery.data)}
        errorMessage={personalQuery.error ? 'Impossible de charger votre tableau de bord.' : null}
        onRetry={() => personalQuery.refetch()}
      />
    );
  }

  if (orgQuery.isPending && !orgQuery.data) {
    return <BtpDashboardSkeleton />;
  }

  if (orgQuery.isError && !orgQuery.data) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{orgName}</p>
        <div className="rounded-xl border border-dashed p-12 text-center space-y-4">
          <h2 className="text-lg font-semibold">Données BTP indisponibles</h2>
          <p className="text-muted-foreground text-sm">
            Les indicateurs ne peuvent pas être chargés. Vérifiez votre connexion ou réessayez.
          </p>
          <Button variant="outline" onClick={() => orgQuery.refetch()}>
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  const dashboard = orgQuery.data ?? null;

  return (
    <BtpDashboardClient
      orgName={orgName}
      title={title}
      viewMode="organization"
      personal={null}
      dashboard={dashboard}
      recommendations={recommendations}
      showAiRecommendations={showAiRecommendations}
      isRefreshing={orgQuery.isFetching && Boolean(dashboard)}
      errorMessage={null}
      onRetry={() => orgQuery.refetch()}
      chartsSlot={
        dashboard ? (
          <Suspense fallback={<BtpDashboardChartsSkeleton />}>
            <BtpDashboardCharts dashboard={dashboard} />
          </Suspense>
        ) : null
      }
    />
  );
}
