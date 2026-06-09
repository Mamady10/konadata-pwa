'use client';

import { KpiCard } from '@/components/dashboard/kpi-card';
import { AIRecommendations } from '@/components/dashboard/ai-recommendations';
import { DataTable } from '@/components/dashboard/data-table';
import { formatCurrency } from '@/lib/utils';
import { ShoppingCart, Wallet, TrendingUp, Package, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import type { AIRecommendation } from '@/types/database';

interface DashboardData {
  kpis: {
    revenue: number;
    totalExpenses: number;
    profit: number;
    receivables: number;
    totalProducts: number;
    lowStockItems: number;
    totalSales: number;
  };
  recentSales: Array<{
    id: string;
    reference: string;
    client: string;
    total: number;
    status: string;
    date: string;
  }>;
  recentExpenses: Array<{
    id: string;
    category: string;
    description: string;
    amount: number;
    date: string;
  }>;
  lowStock: Array<{ id: string; name: string; stock: number; min: number }>;
  receivables: Array<{ id: string; name: string; balance: number }>;
}

interface Props {
  orgName: string;
  title: string;
  dashboard: DashboardData | null;
  recommendations: AIRecommendation[];
  showAiRecommendations: boolean;
}

export function PmeDashboardClient({
  orgName,
  title,
  dashboard,
  recommendations,
  showAiRecommendations,
}: Props) {
  if (!dashboard) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{orgName}</p>
        <p className="text-muted-foreground">
          Impossible de charger les indicateurs. Vérifiez que les migrations PME (035–037) sont appliquées.
        </p>
      </div>
    );
  }

  const { kpis } = dashboard;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{orgName} — Gestion commerciale</p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Chiffre d'affaires"
          value={formatCurrency(kpis.revenue)}
          icon={ShoppingCart}
          color="bg-blue-500"
          index={0}
        />
        <KpiCard
          title="Dépenses"
          value={formatCurrency(kpis.totalExpenses)}
          icon={Wallet}
          color="bg-red-500"
          index={1}
        />
        <KpiCard
          title="Résultat"
          value={formatCurrency(kpis.profit)}
          icon={TrendingUp}
          color={kpis.profit >= 0 ? 'bg-emerald-500' : 'bg-amber-500'}
          index={2}
        />
        <KpiCard
          title="Articles"
          value={kpis.totalProducts}
          icon={Package}
          color="bg-violet-500"
          index={3}
        />
      </div>

      {showAiRecommendations && recommendations.length > 0 && (
        <AIRecommendations recommendations={recommendations} />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <DataTable
          title="Dernières ventes"
          columns={[
            { key: 'reference', label: 'Réf.' },
            { key: 'client', label: 'Client' },
            { key: 'total', label: 'Montant' },
            { key: 'status', label: 'Statut' },
          ]}
          data={dashboard.recentSales.map((s) => ({
            reference: s.reference,
            client: s.client,
            total: formatCurrency(s.total),
            status: s.status,
          }))}
        />
        <DataTable
          title="Dépenses récentes"
          columns={[
            { key: 'description', label: 'Libellé' },
            { key: 'amount', label: 'Montant' },
            { key: 'date', label: 'Date' },
          ]}
          data={dashboard.recentExpenses.map((e) => ({
            description: e.description,
            amount: formatCurrency(e.amount),
            date: e.date,
          }))}
        />
      </div>

      {(dashboard.lowStock.length > 0 || dashboard.receivables.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {dashboard.lowStock.length > 0 && (
            <div className="rounded-xl border p-4 space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Stock bas ({dashboard.lowStock.length})
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                {dashboard.lowStock.map((p) => (
                  <li key={p.id}>
                    {p.name} — {p.stock} / seuil {p.min}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {dashboard.receivables.length > 0 && (
            <div className="rounded-xl border p-4 space-y-2">
              <div className="font-semibold">Créances clients</div>
              <ul className="text-sm text-muted-foreground space-y-1">
                {dashboard.receivables.map((c) => (
                  <li key={c.id}>
                    {c.name} — {formatCurrency(c.balance)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
