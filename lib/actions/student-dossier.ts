'use server';

import { createClient } from '@/lib/supabase/server';
import { requireOrgId } from '@/lib/actions/org';
import { getSession } from '@/lib/actions/auth';
import { getSessionEtablissementCapabilities } from '@/lib/school/session-capabilities';
import { personName, personEmail } from '@/lib/school/person-utils';
import {
  parseStudentPaymentSettings,
  parseTuitionBalance,
  type TuitionInstallment,
} from '@/lib/school/student-payments';

const STUDENT_SELECT = `
  id, matricule, enrollment_status, enrollment_date, class_id,
  school_classes(name, level, academic_year),
  core_persons(full_name, email, phone)
`;

export async function getStudentDossier(studentId: string) {
  const caps = await getSessionEtablissementCapabilities();
  if (!caps.manageStudents && !caps.viewStudentsReadOnly && !caps.isDirector) {
    return { error: 'Non autorisé' };
  }

  const orgId = await requireOrgId();
  const supabase = await createClient();

  const { data: student, error } = await supabase
    .from('school_students')
    .select(STUDENT_SELECT)
    .eq('id', studentId)
    .eq('organization_id', orgId)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!student) return { error: 'Élève introuvable' };

  const [{ data: enrollments }, { data: payments }, { data: bulletins }] = await Promise.all([
    supabase
      .from('school_enrollments')
      .select(
        'id, status, academic_year, created_at, applicant_name, guardian_name, guardian_phone, school_classes(name)'
      )
      .eq('student_id', studentId)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false }),
    supabase
      .from('school_payments')
      .select('id, amount, status, paid_at, payment_kind, payment_method')
      .eq('student_id', studentId)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('school_report_cards')
      .select('id, semester, academic_year, average_score, rank, publication_status, generated_at')
      .eq('student_id', studentId)
      .eq('organization_id', orgId)
      .order('generated_at', { ascending: false })
      .limit(10),
  ]);

  const activeEnrollment = (enrollments ?? []).find((e) =>
    ['pending', 'admitted', 'enrolled'].includes(e.status as string)
  );

  let balance = null;
  if (student.enrollment_status === 'enrolled') {
    const { data: bal } = await supabase.rpc('school_tuition_balance', {
      p_student_id: studentId,
      p_enrollment_id: activeEnrollment?.id ?? null,
      p_academic_year: null,
    });
    balance = parseTuitionBalance(bal as Record<string, unknown>);
  }

  const { data: paymentSettingsRaw } = await supabase.rpc('school_student_payment_settings', {
    p_org_id: orgId,
  });
  const tuitionInstallments: TuitionInstallment[] = parseStudentPaymentSettings(
    paymentSettingsRaw
  ).tuition_installments;

  return {
    student: {
      id: student.id as string,
      name: personName(student as Record<string, unknown>),
      email: personEmail(student as Record<string, unknown>),
      matricule: (student.matricule as string) || null,
      status: student.enrollment_status as string,
      className: ((student.school_classes as { name?: string })?.name) || null,
      classId: (student.class_id as string) || null,
    },
    enrollments: (enrollments ?? []).map((e) => ({
      id: e.id as string,
      status: e.status as string,
      academicYear: e.academic_year as string,
      date: new Date(e.created_at as string).toLocaleDateString('fr-FR'),
      className: ((e.school_classes as { name?: string })?.name) || '—',
      guardianName: (e.guardian_name as string) || null,
      guardianPhone: (e.guardian_phone as string) || null,
    })),
    payments: (payments ?? []).map((p) => ({
      id: p.id as string,
      amount: Number(p.amount),
      status: p.status as string,
      kind: p.payment_kind as string,
      method: (p.payment_method as string) || '—',
      date: p.paid_at
        ? new Date(p.paid_at as string).toLocaleDateString('fr-FR')
        : '—',
    })),
    bulletins: (bulletins ?? []).map((b) => ({
      id: b.id as string,
      semester: b.semester as string,
      academicYear: b.academic_year as string,
      average: b.average_score != null ? Number(b.average_score) : null,
      rank: b.rank != null ? Number(b.rank) : null,
      status: (b.publication_status as string) || 'draft',
      date: new Date(b.generated_at as string).toLocaleDateString('fr-FR'),
    })),
    balance,
    tuitionInstallments,
    canRecordPayments: caps.recordPayments,
  };
}

export async function getGuardianReportCardPdf(params: {
  challengeId: string;
  cardId: string;
}) {
  const supabase = await createClient();
  const { data: gate, error: gateErr } = await supabase.rpc('assert_guardian_portal_challenge', {
    p_challenge_id: params.challengeId,
    p_student_id: null,
    p_report_card_id: params.cardId,
  });

  if (gateErr) return { error: gateErr.message };
  const check = gate as { ok?: boolean; error?: string; organization_id?: string } | null;
  if (!check?.ok) return { error: check?.error ?? 'Accès refusé' };

  const { generateReportCardPdfForCard } = await import('@/lib/actions/report-cards');
  return generateReportCardPdfForCard(
    params.cardId,
    check.organization_id as string,
    true
  );
}

/** Lecture dossier tuteur après vérification SMS (challenge OTP validé). */
export async function lookupGuardianPortalWithChallenge(challengeId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('lookup_guardian_school_portal_by_challenge', {
    p_challenge_id: challengeId.trim(),
  });

  if (error) return { error: error.message };
  const result = data as Record<string, unknown> | null;
  if (result?.error) return { error: String(result.error) };
  return { data: result };
}
