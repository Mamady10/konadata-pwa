'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/dashboard/data-table';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { ChartCard, KonaBarChart } from '@/components/dashboard/charts';
import {
  DATA_STORAGE_SECTIONS,
  DATA_STORAGE_FAQ_TITLE,
  PASSWORD_RECOVERY_GUIDE,
} from '@/lib/legal/data-storage';
import { formatCurrency, formatNumber } from '@/lib/utils';
import type { BillingPaymentRow, BillingSummary, OrgUsageRow } from '@/lib/actions/platform-ceo';
import {
  Building2,
  GraduationCap,
  Heart,
  HardHat,
  Wallet,
  Database,
  KeyRound,
  Shield,
} from 'lucide-react';

interface Props {
  usageRows: OrgUsageRow[];
  billing: BillingSummary | null;
  payments: BillingPaymentRow[];
  loadError?: string;
}

const TYPE_LABEL: Record<string, string> = {
  school: 'École',
  ngo: 'ONG',
  btp: 'BTP',
  business: 'PME',
};

export function CeoPlatformOverview({ usageRows, billing, payments, loadError }: Props) {
  const [tab, setTab] = useState('usage');

  const totalStudents = usageRows.reduce((s, r) => s + (r.student_count ?? 0), 0);
  const totalProjects = usageRows.reduce((s, r) => s + (r.project_count ?? 0), 0);
  const totalSites = usageRows.reduce((s, r) => s + (r.site_count ?? 0), 0);

  const usageTable = usageRows.map((r) => ({
    id: r.org_id,
    name: r.org_name,
    type: TYPE_LABEL[r.org_type] ?? r.org_type,
    users: r.user_count,
    students: r.student_count,
    projects: r.project_count,
    sites: r.site_count,
    paid: formatCurrency(Number(r.platform_payments_gnf) + Number(r.survey_payments_gnf)),
    compliance:
      r.cgu_accepted && r.dpa_accepted
        ? 'CGU + DPA'
        : r.cgu_accepted
          ? 'CGU'
          : r.dpa_accepted
            ? 'DPA'
            : '—',
    status: r.billing_status,
  }));

  const monthChart = (billing?.byMonth ?? []).map((m) => ({
    month: m.month.slice(5),
    amount: Number(m.amount_gnf),
  }));

  return (
    <div className="space-y-6">
      {loadError && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{loadError}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Revenus KonaData"
          value={billing ? formatCurrency(billing.totalRevenueGnf) : '—'}
          icon={Wallet}
          color="bg-emerald-600"
          index={0}
        />
        <KpiCard
          title="Élèves (toutes orgs)"
          value={formatNumber(totalStudents)}
          icon={GraduationCap}
          color="bg-amber-500"
          index={1}
        />
        <KpiCard
          title="Projets ONG"
          value={formatNumber(totalProjects)}
          icon={Heart}
          color="bg-rose-500"
          index={2}
        />
        <KpiCard
          title="Chantiers BTP"
          value={formatNumber(totalSites)}
          icon={HardHat}
          color="bg-slate-600"
          index={3}
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="usage">Usage par organisation</TabsTrigger>
          <TabsTrigger value="finances">Finances abonnements</TabsTrigger>
          <TabsTrigger value="donnees">Données & confidentialité</TabsTrigger>
          <TabsTrigger value="comptes">Comptes directeurs</TabsTrigger>
        </TabsList>

        <TabsContent value="usage" className="mt-4 space-y-4">
          <DataTable
            title="Organisations — effectifs et projets"
            data={usageTable}
            columns={[
              { key: 'name', label: 'Organisation' },
              { key: 'type', label: 'Secteur' },
              { key: 'users', label: 'Utilisateurs' },
              { key: 'students', label: 'Élèves' },
              { key: 'projects', label: 'Projets ONG' },
              { key: 'sites', label: 'Chantiers' },
              { key: 'paid', label: 'Payé' },
              { key: 'compliance', label: 'CGU/DPA' },
              { key: 'status', label: 'Facturation' },
            ]}
          />
        </TabsContent>

        <TabsContent value="finances" className="mt-4 space-y-4">
          {billing && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Abonnements / activations</p>
                  <p className="text-2xl font-bold">{formatCurrency(billing.platformPaymentsGnf)}</p>
                  <p className="text-xs text-muted-foreground">{billing.paymentCount} paiement(s)</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Sondages ONG</p>
                  <p className="text-2xl font-bold">{formatCurrency(billing.surveyPaymentsGnf)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Total encaissé</p>
                  <p className="text-2xl font-bold text-emerald-700">
                    {formatCurrency(billing.totalRevenueGnf)}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
          {monthChart.length > 0 && (
            <ChartCard title="Paiements abonnements par mois">
              <KonaBarChart
                data={monthChart}
                xKey="month"
                bars={[{ key: 'amount', color: '#059669', name: 'GNF' }]}
              />
            </ChartCard>
          )}
          <DataTable
            title="Derniers paiements abonnements"
            data={payments.map((p) => ({
              id: p.id,
              org: p.org_name,
              kind: p.kind,
              amount: formatCurrency(p.amount_gnf),
              date: new Date(p.paid_at).toLocaleDateString('fr-FR'),
              ref: p.reference ?? '—',
            }))}
            columns={[
              { key: 'date', label: 'Date' },
              { key: 'org', label: 'Organisation' },
              { key: 'kind', label: 'Type' },
              { key: 'amount', label: 'Montant' },
              { key: 'ref', label: 'Référence' },
            ]}
          />
        </TabsContent>

        <TabsContent value="donnees" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                {DATA_STORAGE_FAQ_TITLE}
              </CardTitle>
              <CardDescription>
                Réponse standard pour les organisateurs et audits — détail technique KonaData.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {DATA_STORAGE_SECTIONS.map((s) => (
                <div key={s.id} className="space-y-2">
                  <h3 className="font-semibold text-sm">{s.title}</h3>
                  {s.paragraphs?.map((p, i) => (
                    <p key={i} className="text-sm text-muted-foreground">
                      {p}
                    </p>
                  ))}
                  {s.bullets && (
                    <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                      {s.bullets.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Shield className="h-3.5 w-3.5" />
                DPA organisation : Paramètres → Confidentialité (chaque directeur).
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comptes" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                {PASSWORD_RECOVERY_GUIDE.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {PASSWORD_RECOVERY_GUIDE.steps.map((step) => (
                <div key={step.label} className="border-l-2 border-primary/30 pl-4">
                  <p className="font-medium text-sm">{step.label}</p>
                  <p className="text-sm text-muted-foreground mt-1">{step.detail}</p>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Sur chaque fiche organisation ci-dessous : bouton « Réinitialiser MDP directeur »
                (envoi email). Comptes téléphone : récupération OTP sur /forgot-password.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
