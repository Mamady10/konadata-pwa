import {
  getBtpSites,
  getBtpFuelLogs,
  getBtpDeliveryNotes,
  getBtpStock,
  getBtpDailyProgress,
} from '@/lib/actions/btp';
import type { BtpAiReportType } from '@/lib/ai/sector-report-types';
import { SCOPE_ALL } from '@/lib/ai/sector-report-types';
import type { ReportSection } from '@/lib/ai/reports/render-report';
import { formatCurrencyGnf, formatPercent } from '@/lib/ai/reports/render-report';
import { siteStatusLabel } from '@/lib/sector/status-labels';

export async function gatherBtpReport(
  orgId: string,
  siteId: string,
  reportType: BtpAiReportType
): Promise<{
  title: string;
  subtitle: string;
  scopeLabel: string;
  contextText: string;
  sections: ReportSection[];
}> {
  const sites = await getBtpSites(orgId);
  const allSites = siteId === SCOPE_ALL;

  const site = allSites
    ? null
    : sites.find((s) => s.id === siteId);

  if (!allSites && !site) {
    throw new Error('Chantier introuvable ou non autorisé.');
  }

  const siteName = allSites ? 'Tous les chantiers' : (site!.name as string);
  const title = `Rapport BTP — ${BTP_REPORT_LABELS[reportType]} — ${siteName}`;
  const subtitle = allSites ? 'Synthèse organisation' : ((site!.location as string) || '');

  const sections: ReportSection[] = [];
  const contextLines: string[] = [`Rapport: ${title}`, subtitle, ''];

  if (reportType === 'general' || reportType === 'fuel' || reportType === 'delivery_notes' || reportType === 'progress') {
    const targetSites = allSites ? sites : [site!];

    if (reportType === 'general') {
      const lines: string[] = [];
      for (const s of targetSites) {
        const budget = Number(s.budget ?? 0);
        const spent = Number(s.spent ?? 0);
        const phys = Number(s.physical_progress ?? 0);
        const fin = Number(s.financial_progress ?? 0);
        const delay = Number(s.delay_days ?? 0);
        lines.push(
          `• ${s.name} (${siteStatusLabel(s.status as string)}) — ${s.location || '—'}`,
          `  Budget: ${formatCurrencyGnf(budget)}, dépensé: ${formatCurrencyGnf(spent)}, reste: ${formatCurrencyGnf(Math.max(0, budget - spent))}`,
          `  Avancement physique: ${formatPercent(phys)}, financier: ${formatPercent(fin)}, retard: ${delay} j`
        );
      }
      sections.push({ heading: 'Synthèse chantiers', lines });
      contextLines.push('=== Chantiers ===', ...lines, '');
    }

    if (reportType === 'fuel' || reportType === 'general') {
      const logs = (await getBtpFuelLogs(orgId)).filter((l) =>
        allSites ? true : l.site_id === siteId
      );
      const totalL = logs.reduce((s, l) => s + Number(l.liters ?? 0), 0);
      const totalCost = logs.reduce((s, l) => s + Number(l.cost ?? 0), 0);
      const anomalies = logs.filter((l) => l.is_anomaly).length;
      const fuelLines = [
        `Total: ${totalL.toLocaleString('fr-FR')} litres — ${formatCurrencyGnf(totalCost)}`,
        `Anomalies: ${anomalies} sur ${logs.length} relevé(s)`,
        ...logs.slice(0, 15).map((l) => {
          const sn = (l.btp_sites as { name?: string } | null)?.name ?? '—';
          const d = l.logged_at ? new Date(l.logged_at as string).toLocaleDateString('fr-FR') : '—';
          return `• ${d} — ${sn}: ${Number(l.liters ?? 0).toLocaleString('fr-FR')} L${l.is_anomaly ? ' ⚠ anomalie' : ''}`;
        }),
      ];
      if (reportType === 'fuel') {
        sections.push({ heading: 'Carburant', lines: fuelLines });
      } else if (logs.length > 0) {
        sections.push({ heading: 'Carburant (aperçu)', lines: fuelLines.slice(0, 5) });
      }
      contextLines.push('=== Carburant ===', ...fuelLines, '');
    }

    if (reportType === 'delivery_notes' || reportType === 'general') {
      const notes = (await getBtpDeliveryNotes(orgId)).filter((n) =>
        allSites ? true : n.site_id === siteId
      );
      const total = notes.reduce((s, n) => s + Number(n.total_amount ?? 0), 0);
      const noteLines = [
        `${notes.length} bon(s) — total ${formatCurrencyGnf(total)}`,
        ...notes.slice(0, 15).map((n) => {
          const d = n.delivery_date
            ? new Date(n.delivery_date as string).toLocaleDateString('fr-FR')
            : '—';
          return `• ${n.reference} — ${n.supplier ?? '—'} — ${formatCurrencyGnf(Number(n.total_amount ?? 0))} (${d})`;
        }),
      ];
      if (reportType === 'delivery_notes') {
        sections.push({ heading: 'Bons de livraison', lines: noteLines });
      } else if (notes.length > 0) {
        sections.push({ heading: 'Bons (aperçu)', lines: noteLines.slice(0, 5) });
      }
      contextLines.push('=== Bons ===', ...noteLines, '');
    }

    if (reportType === 'progress' || reportType === 'general') {
      const progress = (await getBtpDailyProgress(orgId, 30)).filter((p) =>
        allSites ? true : p.siteId === siteId
      );
      const progLines =
        progress.length === 0
          ? ['Aucune saisie d\'avancement enregistrée.']
          : progress.map((p) => {
              const d = new Date(p.progressDate).toLocaleDateString('fr-FR');
              const note = p.notes ? ` — ${p.notes}` : '';
              return `• ${d} — ${p.siteName}: ${p.physicalPct} % physique, ${p.workersCount ?? '—'} ouvriers${note}`;
            });
      if (reportType === 'progress') {
        sections.push({ heading: 'Avancement terrain', lines: progLines });
      } else if (progress.length > 0) {
        sections.push({ heading: 'Derniers avancements', lines: progLines.slice(0, 5) });
      }
      contextLines.push('=== Avancement ===', ...progLines, '');
    }
  }

  if (reportType === 'stock') {
    const stock = await getBtpStock(orgId);
    const notes = (await getBtpDeliveryNotes(orgId)).filter((n) =>
      allSites ? true : n.site_id === siteId
    );
    const stockLines =
      stock.length === 0
        ? ['Aucun article en stock enregistré.']
        : stock.map((s) => {
            const q = Number(s.quantity ?? 0);
            const min = Number(s.min_threshold ?? 0);
            const alert = q <= min ? ' ⚠ sous seuil' : '';
            return `• ${s.item_name}: ${q} ${s.unit ?? ''} (seuil min. ${min})${alert}`;
          });
    sections.push({ heading: 'Stock entrepôt (organisation)', lines: stockLines });
    if (!allSites && notes.length > 0) {
      sections.push({
        heading: `Livraisons vers ${siteName}`,
        lines: notes.slice(0, 10).map(
          (n) =>
            `• ${n.reference} — ${formatCurrencyGnf(Number(n.total_amount ?? 0))} — ${n.supplier ?? '—'}`
        ),
      });
    }
    contextLines.push('=== Stock ===', ...stockLines);
  }

  if (sections.length === 0) {
    sections.push({ heading: 'Données', lines: ['Aucune donnée disponible pour ce rapport.'] });
  }

  return {
    title,
    subtitle,
    scopeLabel: siteName,
    contextText: contextLines.join('\n'),
    sections,
  };
}

const BTP_REPORT_LABELS: Record<BtpAiReportType, string> = {
  general: 'Général',
  fuel: 'Carburant',
  delivery_notes: 'Bons de livraison',
  progress: 'Avancement',
  stock: 'Stocks',
};
