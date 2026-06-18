import { requireBtpPage } from '@/lib/btp/require-btp-page';
import { getBtpDashboard, getBtpSites, getBtpFuelLogs, getBtpDeliveryNotes } from '@/lib/actions/btp';
import { getBtpDocuments } from '@/lib/actions/storage';
import { canManageAssignments } from '@/lib/actions/assignments';
import { listAiGeneratedReports } from '@/lib/actions/ai-report-archive';
import type { AiGeneratedReportRow } from '@/lib/actions/ai-report-archive';
import { BtpRapportsView } from './btp-rapports-view';
import { formatPercent } from '@/lib/utils';

export default async function Page() {
  const session = await requireBtpPage('rapports');
  if (!session.profile?.organization_id) {
    return <p className="text-muted-foreground">Organisation non configurée.</p>;
  }
  const orgId = session.profile.organization_id;

  const items: { id: string; title: string; subtitle: string; status: string; date?: string }[] = [];
  let sites: { id: string; name: string }[] = [];
  const isDirector = await canManageAssignments();
  let reportHistory: AiGeneratedReportRow[] = [];
  if (isDirector) {
    const hist = await listAiGeneratedReports('btp');
    reportHistory = 'error' in hist ? [] : hist;
  }

  try {
    const docs = await getBtpDocuments(orgId).catch(() => []);
    sites = (await getBtpSites(orgId)).map((s) => ({
      id: s.id as string,
      name: s.name as string,
    }));

    if (isDirector) {
      const dashboard = await getBtpDashboard(orgId);
      items.push({
        id: 'synthese-chantiers',
        title: 'Synthèse chantiers',
        subtitle: `${dashboard.kpis.chantiersActifs} actifs — avancement ${formatPercent(dashboard.kpis.tauxAvancement)}`,
        status: 'Généré',
        date: new Date().toLocaleDateString('fr-FR'),
      });
      items.push({
        id: 'synthese-carburant',
        title: 'Rapport carburant',
        subtitle: `${dashboard.kpis.consommationCarburant.toLocaleString('fr-FR')} litres consommés`,
        status: dashboard.alertesCarburant.length ? 'Alerte' : 'Normal',
        date: new Date().toLocaleDateString('fr-FR'),
      });
      for (const note of dashboard.derniersBons) {
        items.push({
          id: note.id,
          title: note.type,
          subtitle: note.fournisseur,
          status: 'Validé',
          date: note.date,
        });
      }
    } else {
      const [assignedSites, logs, notes] = await Promise.all([
        getBtpSites(orgId),
        getBtpFuelLogs(orgId),
        getBtpDeliveryNotes(orgId),
      ]);
      const active = assignedSites.filter((s) => s.status === 'active').length;
      const avgProgress = assignedSites.length
        ? assignedSites.reduce((s, site) => s + Number(site.physical_progress ?? 0), 0) /
          assignedSites.length
        : 0;
      const totalFuel = logs.reduce((s, l) => s + Number(l.liters ?? 0), 0);
      const anomalies = logs.filter((l) => l.is_anomaly).length;

      items.push({
        id: 'synthese-chantiers',
        title: 'Mes chantiers',
        subtitle: `${active} actif(s) sur ${assignedSites.length} — avancement ${formatPercent(avgProgress)}`,
        status: 'Périmètre assigné',
        date: new Date().toLocaleDateString('fr-FR'),
      });
      items.push({
        id: 'synthese-carburant',
        title: 'Carburant (mes chantiers)',
        subtitle: `${totalFuel.toLocaleString('fr-FR')} litres`,
        status: anomalies > 0 ? 'Alerte' : 'Normal',
        date: new Date().toLocaleDateString('fr-FR'),
      });
      for (const note of notes.slice(0, 5)) {
        items.push({
          id: note.id as string,
          title: note.reference as string,
          subtitle: (note.supplier as string) ?? '—',
          status: 'Validé',
          date: note.delivery_date
            ? new Date(note.delivery_date as string).toLocaleDateString('fr-FR')
            : new Date(note.created_at as string).toLocaleDateString('fr-FR'),
        });
      }
    }

    for (const doc of docs.slice(0, 5)) {
      items.push({
        id: doc.id as string,
        title: doc.file_name as string,
        subtitle: `${doc.doc_type_label}${doc.site_name ? ` — ${doc.site_name}` : ''}`,
        status: 'Archivé',
        date: new Date(doc.created_at as string).toLocaleDateString('fr-FR'),
      });
    }
  } catch {
    // empty
  }

  return (
    <BtpRapportsView
      isDirector={isDirector}
      sites={sites}
      items={items}
      description={
        isDirector
          ? 'Compilation hebdomadaire automatique, synthèses IA et archives'
          : 'Compilez le rapport hebdo à partir de vos saisies journalières'
      }
      reportHistory={reportHistory}
    />
  );
}
