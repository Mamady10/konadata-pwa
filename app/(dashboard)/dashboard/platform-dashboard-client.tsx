'use client';

import { KpiCard } from '@/components/dashboard/kpi-card';
import { ChartCard, KonaBarChart } from '@/components/dashboard/charts';
import { AIRecommendations } from '@/components/dashboard/ai-recommendations';
import { DataTable } from '@/components/dashboard/data-table';
import { formatNumber } from '@/lib/utils';
import { Building2, Users, FileStack, GraduationCap, Heart, HardHat } from 'lucide-react';
import { motion } from 'framer-motion';
import type { AIRecommendation } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Props {
  stats: {
    kpis: {
      organisations: number;
      utilisateurs: number;
      documents: number;
      etudiants: number;
      projetsOng: number;
      chantiersBtp: number;
    };
    orgsByType: { type: string; count: number }[];
    recentOrgs: Array<{ id: string; name: string; type: string; date: string }>;
  };
  recommendations: AIRecommendation[];
}

const ORG_TYPE_LABEL: Record<string, string> = {
  school: 'École',
  ngo: 'ONG',
  btp: 'BTP',
};

export function PlatformDashboardClient({ stats, recommendations }: Props) {
  const { kpis } = stats;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Tableau de Bord Plateforme</h1>
          <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-200">
            Supabase connecté
          </Badge>
        </div>
        <p className="text-muted-foreground">Vue globale multi-tenant KonaData</p>
        <Button asChild variant="outline" size="sm" className="mt-2">
          <a href="/organisations">Console CEO — finances &amp; organisations</a>
        </Button>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard title="Organisations" value={kpis.organisations} icon={Building2} color="bg-blue-500" index={0} />
        <KpiCard title="Utilisateurs" value={formatNumber(kpis.utilisateurs)} icon={Users} color="bg-emerald-500" index={1} />
        <KpiCard title="Documents" value={formatNumber(kpis.documents)} icon={FileStack} color="bg-violet-500" index={2} />
        <KpiCard title="Élèves" value={formatNumber(kpis.etudiants)} icon={GraduationCap} color="bg-amber-500" index={3} />
        <KpiCard title="Projets ONG" value={kpis.projetsOng} icon={Heart} color="bg-rose-500" index={4} />
        <KpiCard title="Chantiers BTP" value={kpis.chantiersBtp} icon={HardHat} color="bg-slate-500" index={5} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Organisations par secteur">
          <KonaBarChart
            data={stats.orgsByType}
            xKey="type"
            bars={[{ key: 'count', color: '#2563EB', name: 'Entités' }]}
          />
        </ChartCard>
        <AIRecommendations recommendations={recommendations} title="KonaAI — Plateforme" />
      </div>

      <DataTable
        title="Dernières organisations inscrites"
        data={stats.recentOrgs}
        columns={[
          { key: 'name', label: 'Nom' },
          { key: 'type', label: 'Type', render: (item) => ORG_TYPE_LABEL[item.type as string] ?? item.type },
          { key: 'date', label: 'Inscription' },
        ]}
      />
    </div>
  );
}
