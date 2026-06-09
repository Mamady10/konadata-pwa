'use client';

import { KpiCard } from '@/components/dashboard/kpi-card';
import { ChartCard, KonaBarChart, KonaLineChart } from '@/components/dashboard/charts';
import { AIRecommendations } from '@/components/dashboard/ai-recommendations';
import { DataTable, StatusBadge } from '@/components/dashboard/data-table';
import { PersonalDashboard } from '@/components/dashboard/personal-dashboard';
import { formatNumber, formatPercent } from '@/lib/utils';
import { HardHat, Fuel, Clock, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import type { AIRecommendation } from '@/types/database';
import type { PersonalBtpDashboard } from '@/lib/actions/btp';

interface OrgDashboard {
  kpis: {
    chantiers: number;
    chantiersActifs: number;
    consommationCarburant: number;
    heuresMachines: number;
    tauxAvancement: number;
    personnel: number;
    alertesStock: number;
  };
  chantiersActifs: Array<{ id: string; nom: string; avancement: number; retard: number; statut: string }>;
  derniersBons: Array<{ id: string; type: string; fournisseur: string; date: string }>;
  planifieRealise: Array<{ semaine: string; planifie: number; realise: number }>;
  consommationCarburant: Array<{ mois: string; litres: number }>;
  effectifsChantier: Array<{ chantier: string; effectif: number }>;
  alertesCarburant: Array<{ chantier: string; consommation: string; seuil: string }>;
}

interface Props {
  orgName: string;
  title: string;
  viewMode: 'organization' | 'personal';
  dashboard: OrgDashboard | null;
  personal: PersonalBtpDashboard | null;
  recommendations: AIRecommendation[];
  showAiRecommendations: boolean;
}

export function BtpDashboardClient({
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
        <div className="rounded-xl border border-dashed p-12 text-center">
          <h2 className="text-lg font-semibold">Données BTP indisponibles</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            Les indicateurs ne peuvent pas être chargés. Aucune donnée de démonstration n&apos;est affichée.
          </p>
        </div>
      </div>
    );
  }

  const { kpis } = dashboard;
  const hasCharts =
    dashboard.planifieRealise.length > 0 ||
    dashboard.consommationCarburant.length > 0 ||
    dashboard.effectifsChantier.length > 0;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-200">
            Données organisation
          </Badge>
        </div>
        <p className="text-muted-foreground">{orgName} — Suivi des chantiers et ressources</p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Chantiers" value={kpis.chantiers} icon={HardHat} color="bg-blue-500" index={0} />
        <KpiCard title="Consommation carburant" value={`${formatNumber(kpis.consommationCarburant)} L`} icon={Fuel} color="bg-amber-500" index={1} />
        <KpiCard title="Personnel actif" value={formatNumber(kpis.personnel)} icon={Clock} color="bg-emerald-500" index={2} />
        <KpiCard title="Taux avancement" value={formatPercent(kpis.tauxAvancement)} icon={TrendingUp} color="bg-violet-500" index={3} />
      </div>

      {hasCharts && (
        <div className="grid gap-6 lg:grid-cols-2">
          {dashboard.planifieRealise.length > 0 && (
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
          {dashboard.consommationCarburant.length > 0 && (
            <ChartCard title="Consommation carburant (litres)">
              <KonaLineChart
                data={dashboard.consommationCarburant}
                xKey="mois"
                lines={[{ key: 'litres', color: '#F59E0B', name: 'Litres' }]}
              />
            </ChartCard>
          )}
        </div>
      )}

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
            { key: 'retard', label: 'Retard', render: (item) => (item.retard as number) > 0 ? `${item.retard}j` : '—' },
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
