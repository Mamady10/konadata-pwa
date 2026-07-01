'use client';

import { KpiCard } from '@/components/dashboard/kpi-card';
import { ChartCard, KonaBarChart } from '@/components/dashboard/charts';
import { AIRecommendations } from '@/components/dashboard/ai-recommendations';
import { DataTable, StatusBadge } from '@/components/dashboard/data-table';
import { PersonalDashboard } from '@/components/dashboard/personal-dashboard';
import { formatNumber, formatPercent } from '@/lib/utils';
import { HardHat, Fuel, Clock, TrendingUp, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AIRecommendation } from '@/types/database';
import type { BtpDashboardData, PersonalBtpDashboard } from '@/lib/actions/btp';

interface Props {
  orgName: string;
  title: string;
  viewMode: 'organization' | 'personal';
  dashboard: BtpDashboardData | null;
  personal: PersonalBtpDashboard | null;
  recommendations: AIRecommendation[];
  showAiRecommendations: boolean;
  isRefreshing?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
  chartsSlot?: React.ReactNode;
}

export function BtpDashboardClient({
  orgName,
  title,
  viewMode,
  dashboard,
  personal,
  recommendations,
  showAiRecommendations,
  isRefreshing = false,
  errorMessage = null,
  onRetry,
  chartsSlot,
}: Props) {
  if (viewMode === 'personal' && personal) {
    return (
      <PersonalDashboard
        orgName={orgName}
        title={title}
        userName={personal.userName}
        highlights={personal.highlights}
        links={personal.links}
        resources={personal.sites.map((s) => ({
          id: s.id,
          name: s.name,
          meta: s.meta,
          status: s.status,
        }))}
        resourcesTitle="Mes chantiers assignés"
        emptyAssignmentMessage={
          personal.sites.length === 0
            ? 'Aucun chantier ne vous est assigné. Demandez à la direction de vous rattacher dans Utilisateurs → Assignations.'
            : undefined
        }
      />
    );
  }

  if (!dashboard) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{orgName}</p>
        <div className="rounded-xl border border-dashed p-12 text-center space-y-4">
          <h2 className="text-lg font-semibold">Données BTP indisponibles</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            {errorMessage ??
              "Les indicateurs ne peuvent pas être chargés. Aucune donnée de démonstration n'est affichée."}
          </p>
          {onRetry && (
            <Button variant="outline" onClick={onRetry}>
              Réessayer
            </Button>
          )}
        </div>
      </div>
    );
  }

  const { kpis } = dashboard;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-200">
            Données organisation
          </Badge>
          {isRefreshing && (
            <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Mise à jour…
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground">{orgName} — Suivi des chantiers et ressources</p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Chantiers" value={kpis.chantiers} icon={HardHat} color="bg-blue-500" index={0} />
        <KpiCard
          title="Consommation carburant"
          value={`${formatNumber(kpis.consommationCarburant)} L`}
          icon={Fuel}
          color="bg-amber-500"
          index={1}
        />
        <KpiCard title="Personnel actif" value={formatNumber(kpis.personnel)} icon={Clock} color="bg-emerald-500" index={2} />
        <KpiCard title="Taux avancement" value={formatPercent(kpis.tauxAvancement)} icon={TrendingUp} color="bg-violet-500" index={3} />
      </div>

      {chartsSlot}

      <div className="grid gap-6 lg:grid-cols-3">
        {dashboard.effectifsChantier.length > 0 && (
          <ChartCard title="Effectifs par chantier" className="lg:col-span-1">
            <KonaBarChart
              data={dashboard.effectifsChantier}
              xKey="chantier"
              bars={[{ key: 'effectif', color: '#8B5CF6', name: 'Effectif' }]}
            />
          </ChartCard>
        )}
        {showAiRecommendations && (
          <div className={dashboard.effectifsChantier.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'}>
            <AIRecommendations recommendations={recommendations} title="KonaAI — BTP" />
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <DataTable
          title="Chantiers actifs"
          data={dashboard.chantiersActifs}
          columns={[
            { key: 'nom', label: 'Chantier' },
            { key: 'avancement', label: 'Avancement', render: (item) => `${item.avancement}%` },
            { key: 'retard', label: 'Retard', render: (item) => ((item.retard as number) > 0 ? `${item.retard}j` : '—') },
          ]}
        />
        <DataTable
          title="Derniers bons"
          data={dashboard.derniersBons}
          columns={[
            { key: 'type', label: 'Type' },
            { key: 'fournisseur', label: 'Fournisseur' },
            { key: 'date', label: 'Date' },
          ]}
        />
        <DataTable
          title="Alertes carburant"
          data={dashboard.alertesCarburant}
          columns={[
            { key: 'chantier', label: 'Chantier' },
            { key: 'consommation', label: 'Consommation' },
            { key: 'seuil', label: 'Seuil', render: (item) => <StatusBadge status={item.seuil as string} /> },
          ]}
        />
      </div>
    </div>
  );
}
