'use server';

import { createClient } from '@/lib/supabase/server';
import { requireOrgId } from '@/lib/actions/org';
import { canManageAssignments } from '@/lib/actions/assignments';
import {
  getSchoolFinanceByClass,
  getEnrollments,
  getGrades,
  getClasses,
  getOrgDefaultAcademicYear,
} from '@/lib/actions/school';
import {
  resolveSchoolPeriod,
  schoolAcademicYearLabel,
  type SchoolReportPeriod,
} from '@/lib/school/report-period';

export interface FinanceReportRow {
  className: string;
  enrolled: number;
  pending: number;
  expected: number;
  collected: number;
  gap: number;
}

export interface SchoolDirectorReportData {
  orgName: string;
  academicYear: string;
  generatedAt: string;
  period: SchoolReportPeriod;
  periodLabel: string;
  rangeLabel: string;
  kpis: {
    studentsEnrolled: number;
    classesActive: number;
    newEnrollmentsPeriod: number;
    collectedPeriod: number;
    gradesPeriod: number;
    bulletinsPeriod: number;
  };
  finance: {
    rows: FinanceReportRow[];
    totals: {
      enrolled: number;
      pending: number;
      expected: number;
      collected: number;
      gap: number;
    };
  };
  enrollmentStatus: { status: string; label: string; count: number }[];
  collectionTrend: { label: string; amount: number }[];
  resultsByClass: { className: string; average: number | null; graded: number }[];
}

const ENROLLMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  submitted: 'Soumis',
  under_review: 'En examen',
  admitted: 'Admis',
  enrolled: 'Inscrit',
  rejected: 'Refusé',
  waitlist: "Liste d'attente",
  cancelled: 'Annulé',
  unknown: 'Non renseigné',
};

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export type GetSchoolDirectorReportResult =
  | { error: string }
  | { data: SchoolDirectorReportData };

export async function getSchoolDirectorReport(
  period: SchoolReportPeriod
): Promise<GetSchoolDirectorReportResult> {
  const isDirector = await canManageAssignments();
  if (!isDirector) {
    return { error: "Cette fonction est réservée aux directeurs de l'organisation." };
  }

  try {
    const orgId = await requireOrgId();
    const supabase = await createClient();
    const win = resolveSchoolPeriod(period);
    const startIso = win.start.toISOString();
    const endIso = win.end.toISOString();

    const [
      { data: orgRow },
      finance,
      enrollments,
      grades,
      classes,
      defaultYear,
      { data: allPaidPayments },
      { count: studentsEnrolled },
      { count: newEnrollmentsPeriod },
      { data: periodPayments },
      { count: gradesPeriod },
      { count: bulletinsPeriod },
    ] = await Promise.all([
      supabase.from('organizations').select('name').eq('id', orgId).maybeSingle(),
      getSchoolFinanceByClass(orgId),
      getEnrollments(orgId),
      getGrades(orgId),
      getClasses(orgId),
      getOrgDefaultAcademicYear(orgId).catch(() => null),
      supabase
        .from('school_payments')
        .select('amount, academic_year, status')
        .eq('organization_id', orgId)
        .in('status', ['paid', 'partial']),
      supabase
        .from('school_students')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('enrollment_status', 'enrolled'),
      supabase
        .from('school_enrollments')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .gte('created_at', startIso)
        .lte('created_at', endIso),
      supabase
        .from('school_payments')
        .select('amount, paid_at')
        .eq('organization_id', orgId)
        .eq('status', 'paid')
        .gte('paid_at', startIso)
        .lte('paid_at', endIso),
      supabase
        .from('school_grades')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .gte('created_at', startIso)
        .lte('created_at', endIso),
      supabase
        .from('school_report_cards')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .gte('generated_at', startIso)
        .lte('generated_at', endIso),
    ]);

    const collectedPeriod = (periodPayments ?? []).reduce(
      (s, p) => s + Number(p.amount ?? 0),
      0
    );

    // Encaissé cumulé réel de l'année (tous paiements paid/partial, quel que soit
    // le rattachement de l'élève à une classe). Sert à réconcilier le tableau
    // pour ne jamais « perdre » un encaissement non affecté à une classe.
    const cumulativeCollected = (allPaidPayments ?? [])
      .filter((p) => !defaultYear || !p.academic_year || p.academic_year === defaultYear)
      .reduce((s, p) => s + Number(p.amount ?? 0), 0);

    const financeRows: FinanceReportRow[] = finance.rows.map((r) => ({
      className: r.className,
      enrolled: r.enrolledCount,
      pending: r.pendingCandidates,
      expected: r.expectedAmount,
      collected: r.collectedAmount,
      gap: r.gap,
    }));
    const attributedCollected = finance.totals.collected;
    const unassignedCollected = Math.max(0, cumulativeCollected - attributedCollected);
    if (unassignedCollected > 0) {
      financeRows.push({
        className: 'Autres (paiements non affectés à une classe)',
        enrolled: 0,
        pending: 0,
        expected: 0,
        collected: unassignedCollected,
        gap: unassignedCollected,
      });
    }
    const financeTotalsCollected = attributedCollected + unassignedCollected;

    // Répartition des candidatures/inscriptions par statut.
    const statusMap = new Map<string, number>();
    for (const e of enrollments) {
      const st = ((e.status as string) || 'unknown').toLowerCase();
      statusMap.set(st, (statusMap.get(st) ?? 0) + 1);
    }
    const enrollmentStatus = Array.from(statusMap.entries())
      .map(([status, count]) => ({
        status,
        label: ENROLLMENT_STATUS_LABELS[status] ?? status,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    // Encaissements par mois sur la fenêtre.
    const trendBuckets = new Map<string, number>();
    const cursor = new Date(win.start.getFullYear(), win.start.getMonth(), 1);
    while (cursor <= win.end) {
      trendBuckets.set(monthKey(cursor), 0);
      cursor.setMonth(cursor.getMonth() + 1);
    }
    for (const p of periodPayments ?? []) {
      if (!p.paid_at) continue;
      const k = monthKey(new Date(p.paid_at as string));
      if (trendBuckets.has(k)) {
        trendBuckets.set(k, (trendBuckets.get(k) ?? 0) + Number(p.amount ?? 0));
      }
    }
    const collectionTrend = Array.from(trendBuckets.entries()).map(([k, amount]) => {
      const [y, m] = k.split('-').map(Number);
      return {
        label: new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'short' }),
        amount,
      };
    });

    // Moyennes par classe (cumul).
    const classAgg = new Map<string, { sum: number; n: number }>();
    for (const g of grades) {
      const cl = (g.school_classes as { name?: string } | null)?.name ?? '—';
      const score = Number(g.score ?? 0);
      const max = Number(g.max_score ?? 20);
      if (max <= 0) continue;
      const norm = (score / max) * 20;
      const cur = classAgg.get(cl) ?? { sum: 0, n: 0 };
      cur.sum += norm;
      cur.n += 1;
      classAgg.set(cl, cur);
    }
    const resultsByClass = Array.from(classAgg.entries())
      .map(([className, { sum, n }]) => ({
        className,
        average: n > 0 ? Math.round((sum / n) * 100) / 100 : null,
        graded: n,
      }))
      .sort((a, b) => (b.average ?? -1) - (a.average ?? -1));

    return {
      data: {
        orgName: (orgRow?.name as string) ?? 'Établissement',
        academicYear: schoolAcademicYearLabel(),
        generatedAt: new Date().toISOString(),
        period,
        periodLabel: win.periodLabel,
        rangeLabel: win.rangeLabel,
        kpis: {
          studentsEnrolled: studentsEnrolled ?? 0,
          classesActive: classes.length,
          newEnrollmentsPeriod: newEnrollmentsPeriod ?? 0,
          collectedPeriod,
          gradesPeriod: gradesPeriod ?? 0,
          bulletinsPeriod: bulletinsPeriod ?? 0,
        },
        finance: {
          rows: financeRows,
          totals: {
            enrolled: finance.totals.enrolled,
            pending: finance.totals.pending,
            expected: finance.totals.expected,
            collected: financeTotalsCollected,
            gap: financeTotalsCollected - finance.totals.expected,
          },
        },
        enrollmentStatus,
        collectionTrend,
        resultsByClass,
      },
    };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : 'Impossible de générer le rapport.',
    };
  }
}
