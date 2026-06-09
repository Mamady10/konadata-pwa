import { getNgoDashboard } from '@/lib/actions/ngo';
import { getNgoDocuments } from '@/lib/actions/storage';
import { canManageAssignments } from '@/lib/actions/assignments';
import { listAiGeneratedReports } from '@/lib/actions/ai-report-archive';
import type { AiGeneratedReportRow } from '@/lib/actions/ai-report-archive';
import { getNgoProjects } from '@/lib/actions/ngo';
import { OngRapportsView } from './ong-rapports-view';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { requireOngPage } from '@/lib/ong/require-ong-page';

export default async function Page() {
  const session = await requireOngPage('rapports');
  if (!session.profile?.organization_id) {
    return <p className="text-muted-foreground">Organisation non configurée.</p>;
  }
  const orgId = session.profile.organization_id;

  const isDirector = await canManageAssignments();
  const items: { id: string; title: string; subtitle: string; status: string; date?: string }[] = [];
  let projects: { id: string; name: string }[] = [];
  let reportHistory: AiGeneratedReportRow[] = [];
  if (isDirector) {
    const hist = await listAiGeneratedReports('ngo');
    reportHistory = 'error' in hist ? [] : hist;
  }

  try {
    const docs = await getNgoDocuments(orgId).catch(() => []);
    projects = (await getNgoProjects(orgId)).map((p) => ({
      id: p.id as string,
      name: p.name as string,
    }));

    if (isDirector) {
      const dashboard = await getNgoDashboard(orgId);

      items.push({
        id: 'synthese-kpis',
        title: 'Synthèse activité ONG',
        subtitle: `${dashboard.kpis.projets} projets — ${dashboard.kpis.beneficiaires.toLocaleString('fr-FR')} bénéficiaires`,
        status: 'Généré',
        date: formatPercent(dashboard.kpis.tauxExecution),
      });

      items.push({
        id: 'synthese-budget',
        title: 'Exécution budgétaire',
        subtitle: `${formatCurrency(dashboard.kpis.budgetDepense)} / ${formatCurrency(dashboard.kpis.budgetTotal)}`,
        status: 'Généré',
        date: new Date().toLocaleDateString('fr-FR'),
      });
    }

    for (const doc of docs.slice(0, 12)) {
      items.push({
        id: doc.id,
        title: doc.file_name,
        subtitle: `${doc.doc_type_label}${doc.project_name ? ` — ${doc.project_name}` : ''}`,
        status: 'Archivé',
        date: new Date(doc.created_at).toLocaleDateString('fr-FR'),
      });
    }
  } catch {
    // empty items
  }

  return (
    <OngRapportsView
      isDirector={isDirector}
      projects={projects}
      items={items}
      description={
        isDirector
          ? 'Synthèses IA par projet et archives'
          : 'Rapports de vos projets assignés'
      }
      reportHistory={reportHistory}
    />
  );
}
