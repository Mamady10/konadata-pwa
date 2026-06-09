'use client';

import Link from 'next/link';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { PersonalDashboard } from '@/components/dashboard/personal-dashboard';
import { ChartCard, KonaLineChart, KonaBarChart, KonaPieChart } from '@/components/dashboard/charts';
import { AIRecommendations } from '@/components/dashboard/ai-recommendations';
import { DataTable, StatusBadge } from '@/components/dashboard/data-table';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { GraduationCap, Users, CreditCard, Wallet, BookOpen } from 'lucide-react';
import { AssignMatriculesPanel } from '@/components/school/assign-matricules-panel';
import type { MatriculeAssignClassBreakdown } from '@/lib/actions/student-matricules';
import { motion } from 'framer-motion';
import { personName } from '@/lib/school/person-utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AIRecommendation } from '@/types/database';
import type { PersonalSchoolDashboard } from '@/lib/actions/school';
import type { SchoolOnboardingStatus } from '@/lib/actions/school-onboarding';
import { SchoolOnboardingChecklist } from '@/components/school/school-onboarding-checklist';
import { SchoolStarterPack } from '@/components/school/school-starter-pack';
import { TrialWatermarkBanner } from '@/components/school/trial-watermark-banner';

interface ChartPoint {
  mois: string;
  inscriptions?: number;
  montant?: number;
}

interface OrgDashboard {
  kpis: {
    candidats: number;
    etudiants: number;
    tauxPaiement: number;
    montantEncaisse: number;
    enseignants: number;
    classes: number;
    paiementsEnAttente: number;
    tauxReussite: number;
    elevesSansCode?: number;
    elevesSansClasse?: number;
    bulletinsIncomplets?: number;
  };
  charts?: {
    inscriptions: ChartPoint[];
    paiements: ChartPoint[];
    filieres: { name: string; value: number }[];
  };
  recentEnrollments: Array<Record<string, unknown>>;
  recentPayments: Array<Record<string, unknown>>;
  pendingStudents: Array<Record<string, unknown>>;
}

interface DashboardProps {
  orgName: string;
  title: string;
  viewMode: 'organization' | 'personal';
  dashboard: OrgDashboard | null;
  personal: PersonalSchoolDashboard | null;
  recommendations: AIRecommendation[];
  showAiRecommendations: boolean;
  matriculeSummary?: {
    total: number;
    assignable: number;
    byClass: MatriculeAssignClassBreakdown[];
  };
  canManageMatricules?: boolean;
  onboarding?: SchoolOnboardingStatus | null;
  trialMode?: boolean;
  trialEndsAt?: string | null;
  showStarterPack?: boolean;
  academicYear?: string;
}

const statusMap: Record<string, string> = {
  pending: 'En attente',
  admitted: 'Admis',
  enrolled: 'Inscrit',
  rejected: 'Refusé',
  paid: 'Payé',
  overdue: 'Impayé',
};

function PersonalDashboardView({
  orgName,
  title,
  personal,
}: {
  orgName: string;
  title: string;
  personal: PersonalSchoolDashboard;
}) {
  return (
    <div className="space-y-6">
      <PersonalDashboard
        orgName={orgName}
        title={title}
        userName={personal.userName}
        scopeNote="Aucune statistique globale de l'établissement n'est affichée sur cet espace."
        highlights={personal.highlights}
        links={personal.links}
        emptyAssignmentMessage={
          personal.role === 'teacher' && personal.assignedClassesCount === 0
            ? 'Votre compte enseignant n\'est pas encore rattaché à des classes. La direction doit vous assigner des classes dans Utilisateurs → Assignations.'
            : undefined
        }
      />
      {personal.enrollments.length > 0 && (
        <DataTable
          title="Mes demandes d'inscription"
          data={personal.enrollments.map((e) => ({
            id: e.id,
            classe: e.className,
            annee: e.academicYear,
            date: e.date,
            statut: e.status,
          }))}
          columns={[
            { key: 'classe', label: 'Classe visée' },
            { key: 'annee', label: 'Année' },
            { key: 'date', label: 'Date' },
            { key: 'statut', label: 'Statut', render: (item) => <StatusBadge status={item.statut as string} /> },
          ]}
        />
      )}
    </div>
  );
}

function OrganizationDashboardView({
  orgName,
  title,
  dashboard,
  recommendations,
  showAiRecommendations,
  matriculeSummary,
  canManageMatricules,
  onboarding,
  trialMode,
  trialEndsAt,
  showStarterPack,
  academicYear,
}: {
  orgName: string;
  title: string;
  dashboard: OrgDashboard | null;
  recommendations: AIRecommendation[];
  showAiRecommendations: boolean;
  matriculeSummary?: {
    total: number;
    assignable: number;
    byClass: MatriculeAssignClassBreakdown[];
  };
  canManageMatricules?: boolean;
  onboarding?: SchoolOnboardingStatus | null;
  trialMode?: boolean;
  trialEndsAt?: string | null;
  showStarterPack?: boolean;
  academicYear?: string;
}) {
  if (!dashboard) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{orgName}</p>
        <div className="rounded-xl border border-dashed p-12 text-center">
          <h2 className="text-lg font-semibold">Données indisponibles</h2>
          <p className="text-muted-foreground mt-2 text-sm max-w-md mx-auto">
            Les indicateurs de l&apos;établissement ne peuvent pas être chargés (connexion Supabase ou droits
            insuffisants). Aucune donnée de démonstration n&apos;est affichée.
          </p>
        </div>
      </div>
    );
  }

  const { kpis } = dashboard;
  const inscriptionsChart = dashboard.charts?.inscriptions ?? [];
  const paiementsChart = dashboard.charts?.paiements ?? [];
  const filieresChart = dashboard.charts?.filieres ?? [];
  const hasCharts =
    inscriptionsChart.length > 0 || paiementsChart.length > 0 || filieresChart.length > 0;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <Badge variant="success">Données établissement</Badge>
        </div>
        <p className="text-muted-foreground">
          {orgName}
          {academicYear ? ` — Année scolaire ${academicYear}` : ''}
        </p>
      </motion.div>

      {trialMode && <TrialWatermarkBanner trialEndsAt={trialEndsAt} />}

      {onboarding && onboarding.completedCount < onboarding.totalCount && (
        <SchoolOnboardingChecklist onboarding={onboarding} compact />
      )}

      {showStarterPack && dashboard && (
        <SchoolStarterPack
          hasClasses={dashboard.kpis.classes > 0}
          hasStudents={dashboard.kpis.etudiants > 0}
          compact={dashboard.kpis.etudiants > 0}
        />
      )}

      {canManageMatricules && matriculeSummary && matriculeSummary.total > 0 && (
        <AssignMatriculesPanel
          total={matriculeSummary.total}
          assignable={matriculeSummary.assignable}
          byClass={matriculeSummary.byClass}
          compact
        />
      )}

      {(kpis.bulletinsIncomplets ?? 0) > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-amber-950">
            <strong>{kpis.bulletinsIncomplets}</strong> bulletin
            {(kpis.bulletinsIncomplets ?? 0) > 1 ? 's' : ''} provisoire
            {(kpis.bulletinsIncomplets ?? 0) > 1 ? 's' : ''} avec notes manquantes — complétez les évaluations
            avant publication définitive.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/etablissement/bulletins">Voir les bulletins</Link>
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Candidats / En attente" value={kpis.candidats} icon={Users} color="bg-blue-500" index={0} />
        <KpiCard title="Élèves inscrits" value={kpis.etudiants} icon={GraduationCap} color="bg-emerald-500" index={1} />
        <KpiCard title="Taux de paiement" value={formatPercent(kpis.tauxPaiement)} icon={CreditCard} color="bg-amber-500" index={2} />
        <KpiCard title="Montant encaissé" value={formatCurrency(kpis.montantEncaisse)} icon={Wallet} color="bg-violet-500" index={3} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Enseignants" value={kpis.enseignants} icon={BookOpen} color="bg-indigo-500" index={0} />
        <KpiCard title="Classes actives" value={kpis.classes} icon={GraduationCap} color="bg-cyan-500" index={1} />
        <KpiCard title="Paiements en attente" value={kpis.paiementsEnAttente} icon={CreditCard} color="bg-orange-500" index={2} />
        <KpiCard
          title="Inscrits sans classe"
          value={kpis.elevesSansClasse ?? 0}
          icon={Users}
          color="bg-rose-500"
          index={3}
        />
      </div>

      {hasCharts && (
        <div className="grid gap-6 lg:grid-cols-2">
          {inscriptionsChart.length > 0 && (
            <ChartCard title="Évolution des inscriptions">
              <KonaLineChart
                data={inscriptionsChart as unknown as Record<string, unknown>[]}
                xKey="mois"
                lines={[{ key: 'inscriptions', color: '#2563EB', name: 'Inscriptions' }]}
              />
            </ChartCard>
          )}
          {paiementsChart.length > 0 && (
            <ChartCard title="Évolution des paiements">
              <KonaBarChart
                data={paiementsChart as unknown as Record<string, unknown>[]}
                xKey="mois"
                bars={[{ key: 'montant', color: '#10B981', name: 'Montant (GNF)' }]}
              />
            </ChartCard>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {filieresChart.length > 0 && (
          <ChartCard title="Répartition par classe" className="lg:col-span-1">
            <KonaPieChart data={filieresChart} />
          </ChartCard>
        )}
        {showAiRecommendations && (
          <div className={filieresChart.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'}>
            <AIRecommendations recommendations={recommendations} title="KonaAI — Établissement" />
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <DataTable
          title="Dernières inscriptions"
          data={dashboard.recentEnrollments.map((e, i) => ({
            id: i,
            nom: (e.applicant_name as string) || personName(e.school_students as Record<string, unknown>) || '—',
            filiere: ((e.school_classes as { name?: string })?.name) || '—',
            date: new Date(e.created_at as string).toLocaleDateString('fr-FR'),
            statut: statusMap[e.status as string] || String(e.status),
          }))}
          columns={[
            { key: 'nom', label: 'Nom' },
            { key: 'filiere', label: 'Classe' },
            { key: 'date', label: 'Date' },
            { key: 'statut', label: 'Statut', render: (item) => <StatusBadge status={item.statut as string} /> },
          ]}
        />
        <DataTable
          title="Paiements récents"
          data={dashboard.recentPayments.map((p, i) => ({
            id: i,
            etudiant: personName(p.school_students as Record<string, unknown>),
            montant: Number(p.amount),
            mode: String(p.payment_method ?? '—'),
          }))}
          columns={[
            { key: 'etudiant', label: 'Élève' },
            { key: 'montant', label: 'Montant', render: (item) => formatCurrency(item.montant as number) },
            { key: 'mode', label: 'Mode' },
          ]}
        />
        <DataTable
          title="Élèves en attente"
          data={dashboard.pendingStudents.map((s, i) => ({
            id: i,
            nom: personName(s),
            filiere: ((s.school_classes as { name?: string })?.name) || '—',
            statut: statusMap[s.enrollment_status as string] || 'En attente',
          }))}
          columns={[
            { key: 'nom', label: 'Nom' },
            { key: 'filiere', label: 'Classe' },
            { key: 'statut', label: 'Statut', render: (item) => <StatusBadge status={item.statut as string} /> },
          ]}
        />
      </div>
    </div>
  );
}

export function EtablissementDashboardClient({
  orgName,
  title,
  viewMode,
  dashboard,
  personal,
  recommendations,
  showAiRecommendations,
  matriculeSummary,
  canManageMatricules,
  onboarding,
  trialMode,
  trialEndsAt,
  showStarterPack,
  academicYear,
}: DashboardProps) {
  if (viewMode === 'personal' && personal) {
    return <PersonalDashboardView orgName={orgName} title={title} personal={personal} />;
  }

  return (
    <OrganizationDashboardView
      orgName={orgName}
      title={title}
      dashboard={dashboard}
      recommendations={recommendations}
      showAiRecommendations={showAiRecommendations}
      matriculeSummary={matriculeSummary}
      canManageMatricules={canManageMatricules}
      onboarding={onboarding}
      trialMode={trialMode}
      trialEndsAt={trialEndsAt}
      showStarterPack={showStarterPack}
      academicYear={academicYear}
    />
  );
}
