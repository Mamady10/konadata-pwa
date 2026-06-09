import {
  getSchoolFinanceByClass,
  getEnrollments,
  getGrades,
  getClasses,
} from '@/lib/actions/school';
import { createClient } from '@/lib/supabase/server';
import type { SchoolAiReportType } from '@/lib/ai/sector-report-types';
import { SCOPE_ALL } from '@/lib/ai/sector-report-types';
import type { ReportSection } from '@/lib/ai/reports/render-report';
import { formatCurrencyGnf } from '@/lib/ai/reports/render-report';
import { personName } from '@/lib/school/person-utils';

function monthWindow(month?: number, year?: number) {
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth() + 1;
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0, 23, 59, 59, 999);
  const label = start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return { start, end, label };
}

export async function gatherSchoolReport(
  orgId: string,
  classId: string,
  reportType: SchoolAiReportType,
  options?: { month?: number; year?: number }
): Promise<{
  title: string;
  subtitle: string;
  scopeLabel: string;
  contextText: string;
  sections: ReportSection[];
}> {
  const classes = await getClasses(orgId);
  const allClasses = classId === SCOPE_ALL;
  const cls = allClasses ? null : classes.find((c) => c.id === classId);

  if (!allClasses && !cls) {
    throw new Error('Classe introuvable.');
  }

  const scopeName = allClasses ? 'Tout l\'établissement' : (cls!.name as string);
  const period = reportType === 'monthly' ? monthWindow(options?.month, options?.year) : null;
  const title =
    reportType === 'monthly'
      ? `Rapport mensuel direction — ${period!.label} — ${scopeName}`
      : `Rapport établissement — ${SCHOOL_REPORT_LABELS[reportType]} — ${scopeName}`;
  const subtitle =
    reportType === 'monthly'
      ? `Période : ${period!.label}`
      : allClasses
        ? 'Synthèse globale'
        : ((cls!.level as string) || '');

  const sections: ReportSection[] = [];
  const contextLines: string[] = [title, subtitle, ''];

  const supabase = await createClient();

  if (reportType === 'monthly') {
    const { start, end, label } = period!;

    const { count: newEnrollments } = await supabase
      .from('school_enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    const { data: monthPayments } = await supabase
      .from('school_payments')
      .select('amount, status, paid_at')
      .eq('organization_id', orgId)
      .eq('status', 'paid')
      .gte('paid_at', start.toISOString())
      .lte('paid_at', end.toISOString());

    const collected = (monthPayments ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0);

    const { count: gradesMonth } = await supabase
      .from('school_grades')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    const { count: bulletinsMonth } = await supabase
      .from('school_report_cards')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .gte('generated_at', start.toISOString())
      .lte('generated_at', end.toISOString());

    const monthlyLines = [
      `Période analysée : ${label}`,
      `Nouvelles demandes inscription : ${newEnrollments ?? 0}`,
      `Paiements encaissés ce mois : ${formatCurrencyGnf(collected)}`,
      `Notes saisies ce mois : ${gradesMonth ?? 0}`,
      `Bulletins générés ce mois : ${bulletinsMonth ?? 0}`,
    ];
    sections.push({ heading: 'Activité du mois', lines: monthlyLines });
    contextLines.push('=== Mois ===', ...monthlyLines, '');
  }

  if (reportType === 'monthly' || reportType === 'overview' || reportType === 'finance') {
    const finance = await getSchoolFinanceByClass(orgId);
    const rows = allClasses
      ? finance.rows
      : finance.rows.filter((r) => r.classId === classId);

    const finLines: string[] = [];
    if (rows.length === 0) {
      finLines.push('Aucune classe active.');
    } else {
      for (const r of rows) {
        finLines.push(
          `• ${r.className}: ${r.enrolledCount} inscrit(s), ${r.pendingCandidates} candidature(s) en attente`
        );
        finLines.push(
          `  Attendu: ${formatCurrencyGnf(r.expectedAmount)}, encaissé: ${formatCurrencyGnf(r.collectedAmount)}, écart: ${formatCurrencyGnf(r.gap)}`
        );
      }
    }

    if (allClasses) {
      finLines.unshift(
        `Totaux établissement: ${finance.totals.enrolled} inscrits, ${finance.totals.pending} candidatures en attente`,
        `Encaissé: ${formatCurrencyGnf(finance.totals.collected)}, attendu: ${formatCurrencyGnf(finance.totals.expected)}`
      );
    }

    sections.push({ heading: 'Finances par classe', lines: finLines });
    contextLines.push('=== Finances ===', ...finLines, '');
  }

  if (reportType === 'monthly' || reportType === 'overview' || reportType === 'enrollments') {
    const enrollments = await getEnrollments(orgId);
    const filtered = allClasses
      ? enrollments
      : enrollments.filter((e) => e.class_id === classId);

    const byStatus = new Map<string, number>();
    for (const e of filtered) {
      const st = (e.status as string) || 'unknown';
      byStatus.set(st, (byStatus.get(st) ?? 0) + 1);
    }

    const enrollLines = [
      `${filtered.length} dossier(s)`,
      ...Array.from(byStatus.entries()).map(([st, n]) => `• Statut ${st}: ${n}`),
      ...filtered.slice(0, 12).map((e) => {
        const name =
          (e.applicant_name as string) ||
          personName(e.school_students as Record<string, unknown>) ||
          '—';
        const cl = (e.school_classes as { name?: string } | null)?.name ?? '—';
        return `• ${name} — ${cl} — ${e.status} — ${e.academic_year}`;
      }),
    ];

    sections.push({ heading: 'Candidatures & inscriptions', lines: enrollLines });
    contextLines.push('=== Inscriptions ===', ...enrollLines, '');
  }

  if (reportType === 'monthly' || reportType === 'overview' || reportType === 'results') {
    const grades = await getGrades(orgId, allClasses ? undefined : classId);
    const averages: number[] = [];
    for (const g of grades) {
      const score = Number(g.score ?? 0);
      const max = Number(g.max_score ?? 20);
      if (max > 0) averages.push((score / max) * 20);
    }
    const avg =
      averages.length > 0
        ? averages.reduce((a, b) => a + b, 0) / averages.length
        : null;

    const gradeLines =
      grades.length === 0
        ? ['Aucune note enregistrée pour ce périmètre.']
        : [
            `${grades.length} note(s) enregistrée(s)`,
            avg != null ? `Moyenne approximative sur 20: ${avg.toFixed(2)}` : '',
            ...grades.slice(0, 15).map((g) => {
              const student = personName(g.school_students as Record<string, unknown>);
              const subject = (g.school_subjects as { name?: string } | null)?.name ?? '—';
              const cl = (g.school_classes as { name?: string } | null)?.name ?? '—';
              return `• ${student} — ${subject} (${cl}): ${g.score}/${g.max_score}`;
            }),
          ].filter(Boolean) as string[];

    sections.push({ heading: 'Résultats / notes', lines: gradeLines });
    contextLines.push('=== Notes ===', ...gradeLines, '');
  }

  if (reportType === 'monthly' || reportType === 'overview') {
    const { count } = await supabase
      .from('school_students')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('enrollment_status', 'enrolled');

    const { count: reportCards } = await supabase
      .from('school_report_cards')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId);

    const overviewLines = [
      `Élèves inscrits (établissement): ${count ?? 0}`,
      `Bulletins générés: ${reportCards ?? 0}`,
      `Classes actives: ${classes.length}`,
    ];
    sections.unshift({ heading: 'Indicateurs clés', lines: overviewLines });
    contextLines.unshift('=== KPI ===', ...overviewLines, '');
  }

  if (sections.length === 0) {
    sections.push({ heading: 'Données', lines: ['Aucune donnée disponible.'] });
  }

  return {
    title,
    subtitle,
    scopeLabel: scopeName,
    contextText: contextLines.join('\n'),
    sections,
  };
}

const SCHOOL_REPORT_LABELS: Record<SchoolAiReportType, string> = {
  monthly: 'Rapport mensuel',
  overview: 'Vue d\'ensemble',
  finance: 'Finances',
  enrollments: 'Candidatures',
  results: 'Résultats',
};
