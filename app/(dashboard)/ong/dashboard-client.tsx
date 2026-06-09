'use client';

import { KpiCard } from '@/components/dashboard/kpi-card';
import { ChartCard, KonaBarChart } from '@/components/dashboard/charts';
import { AIRecommendations } from '@/components/dashboard/ai-recommendations';
import { DataTable, StatusBadge } from '@/components/dashboard/data-table';
import { PersonalDashboard } from '@/components/dashboard/personal-dashboard';
import { formatCurrency, formatPercent, formatNumber } from '@/lib/utils';
import { FolderKanban, Heart, Wallet, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import type { AIRecommendation } from '@/types/database';
import type { PersonalNgoDashboard } from '@/lib/actions/ngo';

interface OrgDashboard {
  kpis: {
    projets: number;
    projetsActifs: number;
    beneficiaires: number;
    budgetTotal: number;
    budgetDepense: number;
    tauxExecution: number;
    reponsesEnquetes: number;
  };
  projetsActifs: Array<{ id: string; nom: string; region: string; avancement: number; statut: string }>;
  repartitionGeographique: Array<{ region: string; beneficiaires: number }>;
  budgetPrevuRealise: Array<{ trimestre: string; prevu: number; realise: number }>;
  localitesCouvertes: Array<{ localite: string; projets: number; beneficiaires: number }>;
}

interface Props {
  orgName: string;
  title: string;
  viewMode: 'organization' | 'personal';
  dashboard: OrgDashboard | null;
  personal: PersonalNgoDashboard | null;
  recommendations: AIRecommendation[];
  showAiRecommendations: boolean;
}

export function OngDashboardClient({
  orgName,
  title,
  viewMode,
  dashboard,
  personal,
  recommendations,
  showAiRecommendations,
}: Props) {
  if (viewMode === 'personal' && personal) {
    return (
      <PersonalDashboard
        orgName={orgName}
        title={title}
        userName={personal.userName}
        highlights={personal.highlights}
        links={personal.links}
        resources={personal.projects.map((p) => ({
          id: p.id,
          name: p.name,
          meta: p.meta,
          status: p.status,
        }))}
        resourcesTitle="Mes projets assignés"
        emptyAssignmentMessage={
          personal.projects.length === 0
            ? 'Aucun projet ne vous est assigné. Demandez à la direction de vous rattacher dans Utilisateurs → Assignations.'
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
        <div className="rounded-xl border border-dashed p-12 text-center">
          <h2 className="text-lg font-semibold">Données ONG indisponibles</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            Les indicateurs ne peuvent pas être chargés. Aucune donnée de démonstration n&apos;est affichée.
          </p>
        </div>
      </div>
    );
  }

  const { kpis } = dashboard;
  const hasCharts =
    dashboard.budgetPrevuRealise.length > 0 || dashboard.repartitionGeographique.length > 0;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <Badge variant="success">Données organisation</Badge>
        </div>
        <p className="text-muted-foreground">{orgName}</p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Projets" value={kpis.projets} icon={FolderKanban} color="bg-blue-500" index={0} />
        <KpiCard title="Bénéficiaires" value={formatNumber(kpis.beneficiaires)} icon={Heart} color="bg-emerald-500" index={1} />
        <KpiCard title="Budget total" value={formatCurrency(kpis.budgetTotal)} icon={Wallet} color="bg-amber-500" index={2} />
        <KpiCard title="Taux d'exécution" value={formatPercent(kpis.tauxExecution)} icon={TrendingUp} color="bg-violet-500" index={3} />
      </div>

      {hasCharts && (
        <div className="grid gap-6 lg:grid-cols-2">
          {dashboard.budgetPrevuRealise.length > 0 && (
            <ChartCard title="Budget prévu vs réalisé">
              <KonaBarChart
                data={dashboard.budgetPrevuRealise}
                xKey="trimestre"
                bars={[
                  { key: 'prevu', color: '#2563EB', name: 'Prévu' },
                  { key: 'realise', color: '#10B981', name: 'Réalisé' },
                ]}
              />
            </ChartCard>
          )}
          {dashboard.repartitionGeographique.length > 0 && (
            <ChartCard title="Répartition géographique">
              <KonaBarChart
                data={dashboard.repartitionGeographique}
                xKey="region"
                bars={[{ key: 'beneficiaires', color: '#8B5CF6', name: 'Bénéficiaires' }]}
              />
            </ChartCard>
          )}
        </div>
      )}

      {showAiRecommendations && (
        <AIRecommendations recommendations={recommendations} title="KonaAI — ONG" />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <DataTable
          title="Projets actifs"
          data={dashboard.projetsActifs}
          columns={[
            { key: 'nom', label: 'Projet' },
            { key: 'region', label: 'Région' },
            { key: 'avancement', label: 'Avancement', render: (item) => `${item.avancement}%` },
            { key: 'statut', label: 'Statut', render: (item) => <StatusBadge status={item.statut as string} /> },
          ]}
        />
        <DataTable
          title="Localités couvertes"
          data={dashboard.localitesCouvertes}
          columns={[
            { key: 'localite', label: 'Localité' },
            { key: 'projets', label: 'Projets' },
            { key: 'beneficiaires', label: 'Bénéficiaires' },
          ]}
        />
      </div>
    </div>
  );
}
