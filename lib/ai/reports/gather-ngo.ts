import { getNgoProjects, getNgoBeneficiaries, getNgoPrograms } from '@/lib/actions/ngo';
import { getNgoDocuments } from '@/lib/actions/storage';
import type { NgoAiReportType } from '@/lib/ai/sector-report-types';
import { SCOPE_ALL } from '@/lib/ai/sector-report-types';
import type { ReportSection } from '@/lib/ai/reports/render-report';
import { formatCurrencyGnf, formatPercent } from '@/lib/ai/reports/render-report';
import { projectStatusLabel } from '@/lib/sector/status-labels';

export async function gatherNgoReport(
  orgId: string,
  projectId: string,
  reportType: NgoAiReportType
): Promise<{
  title: string;
  subtitle: string;
  scopeLabel: string;
  contextText: string;
  sections: ReportSection[];
}> {
  const projects = await getNgoProjects(orgId);
  const allProjects = projectId === SCOPE_ALL;

  const project = allProjects ? null : projects.find((p) => p.id === projectId);
  if (!allProjects && !project) {
    throw new Error('Projet introuvable ou non autorisé.');
  }

  const projectName = allProjects ? 'Tous les projets' : (project!.name as string);
  const title = `Rapport ONG — ${NGO_REPORT_LABELS[reportType]} — ${projectName}`;
  const subtitle = allProjects
    ? 'Synthèse organisation'
    : `${project!.region ?? '—'} — ${project!.locality ?? '—'}`;

  const sections: ReportSection[] = [];
  const contextLines: string[] = [title, subtitle, ''];

  const targetProjects = allProjects ? projects : [project!];

  if (reportType === 'general' || reportType === 'budget') {
    const lines: string[] = [];
    let totalBudget = 0;
    let totalSpent = 0;
    for (const p of targetProjects) {
      const budget = Number(p.budget ?? 0);
      const spent = Number(p.spent ?? 0);
      totalBudget += budget;
      totalSpent += spent;
      const pct = Number(p.progress_pct ?? 0);
      const ben = Number(p.beneficiaries ?? 0);
      lines.push(
        `• ${p.name} (${projectStatusLabel(p.status as string)}) — ${p.region ?? '—'}`,
        `  Budget: ${formatCurrencyGnf(budget)}, dépensé: ${formatCurrencyGnf(spent)}, exécution: ${budget > 0 ? formatPercent((spent / budget) * 100) : '—'}`,
        `  Avancement: ${formatPercent(pct)}, bénéficiaires déclarés: ${ben.toLocaleString('fr-FR')}`
      );
    }
    if (allProjects) {
      lines.unshift(
        `Totaux: budget ${formatCurrencyGnf(totalBudget)}, dépensé ${formatCurrencyGnf(totalSpent)}, taux global ${totalBudget > 0 ? formatPercent((totalSpent / totalBudget) * 100) : '—'}`
      );
    }
    sections.push({
      heading: reportType === 'budget' ? 'Budget & exécution' : 'Synthèse projets',
      lines,
    });
    contextLines.push('=== Projets ===', ...lines, '');
  }

  if (reportType === 'beneficiaries' || reportType === 'general') {
    const beneficiaries = await getNgoBeneficiaries(orgId);
    const regions = new Set(
      targetProjects.map((p) => (p.region as string) || '').filter(Boolean)
    );
    const filtered = allProjects
      ? beneficiaries
      : beneficiaries.filter((b) => regions.has((b.region as string) || ''));
    const benLines =
      filtered.length === 0
        ? ['Aucun bénéficiaire enregistré pour cette zone.']
        : [
            `${filtered.length} bénéficiaire(s) (zone projet)`,
            ...filtered.slice(0, 20).map((b) => {
              const name = (b.core_persons as { full_name?: string } | null)?.full_name ?? '—';
              return `• ${name} — ${b.locality ?? b.region ?? '—'} — ${b.category ?? '—'}`;
            }),
          ];
    if (reportType === 'beneficiaries') {
      sections.push({ heading: 'Bénéficiaires', lines: benLines });
    } else if (filtered.length > 0) {
      sections.push({ heading: 'Bénéficiaires (aperçu)', lines: benLines.slice(0, 6) });
    }
    contextLines.push('=== Bénéficiaires ===', ...benLines, '');
  }

  if (reportType === 'documents' || reportType === 'general') {
    const docs = (await getNgoDocuments(orgId)).filter((d) =>
      allProjects ? true : d.project_id === projectId
    );
    const docLines =
      docs.length === 0
        ? ['Aucun document lié à ce périmètre.']
        : [
            `${docs.length} document(s)`,
            ...docs.slice(0, 20).map(
              (d) =>
                `• ${d.file_name} — ${d.doc_type_label}${d.project_name ? ` (${d.project_name})` : ''}`
            ),
          ];
    if (reportType === 'documents') {
      sections.push({ heading: 'Documents', lines: docLines });
    } else if (docs.length > 0) {
      sections.push({ heading: 'Documents (aperçu)', lines: docLines.slice(0, 6) });
    }
    contextLines.push('=== Documents ===', ...docLines, '');
  }

  if (reportType === 'general') {
    const programs = await getNgoPrograms(orgId);
    const progLines =
      programs.length === 0
        ? ['Aucun programme enregistré.']
        : programs.slice(0, 8).map(
            (p) =>
              `• ${p.name} — ${formatCurrencyGnf(Number(p.budget ?? 0))} — ${p.is_active ? 'actif' : 'inactif'}`
          );
    sections.push({ heading: 'Programmes', lines: progLines });
    contextLines.push('=== Programmes ===', ...progLines);
  }

  if (sections.length === 0) {
    sections.push({ heading: 'Données', lines: ['Aucune donnée disponible.'] });
  }

  return {
    title,
    subtitle,
    scopeLabel: projectName,
    contextText: contextLines.join('\n'),
    sections,
  };
}

const NGO_REPORT_LABELS: Record<NgoAiReportType, string> = {
  general: 'Général',
  budget: 'Budget',
  beneficiaries: 'Bénéficiaires',
  documents: 'Documents',
  survey: 'Sondage',
};
