'use server';

import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/actions/auth';
import { requireOrgId } from '@/lib/actions/org';
import { revalidatePath } from 'next/cache';
import {
  normalizeInstallmentsForSave,
  parseStudentPaymentSettings,
  parseTuitionBalance,
  sumInstallmentPercents,
  type StudentPaymentKind,
  type StudentPaymentSettings,
  type TuitionBalance,
} from '@/lib/school/student-payments';
import { parsePaymentReceipt, type PaymentReceipt } from '@/lib/school/payment-receipt';
import { getSessionEtablissementCapabilities } from '@/lib/school/session-capabilities';
import { getLinkedSchoolStudentIds } from '@/lib/actions/school';

async function canConfigureStudentPayments(role: string | undefined): Promise<boolean> {
  if (role === 'platform_admin') return true;
  const caps = await getSessionEtablissementCapabilities();
  return caps.isDirector || role === 'registrar' || role === 'accountant';
}

async function canGeneratePaymentLinks(role: string | undefined): Promise<boolean> {
  if (role === 'platform_admin') return true;
  const caps = await getSessionEtablissementCapabilities();
  return caps.recordPayments || caps.isDirector;
}

export async function getStudentPaymentSettingsForOrgs(
  orgIds: string[]
): Promise<Record<string, StudentPaymentSettings>> {
  const unique = [...new Set(orgIds.filter(Boolean))];
  if (!unique.length) return {};

  const supabase = await createClient();
  const out: Record<string, StudentPaymentSettings> = {};
  await Promise.all(
    unique.map(async (orgId) => {
      const { data, error } = await supabase.rpc('school_student_payment_settings', {
        p_org_id: orgId,
      });
      if (!error) {
        out[orgId] = parseStudentPaymentSettings(data);
      }
    })
  );
  return out;
}

export async function getOrgDefaultTuitionFees(
  orgIds: string[]
): Promise<Record<string, number>> {
  const unique = [...new Set(orgIds.filter(Boolean))];
  if (!unique.length) return {};

  const supabase = await createClient();
  const { data } = await supabase
    .from('organizations')
    .select('id, settings')
    .in('id', unique);

  const out: Record<string, number> = {};
  for (const row of data ?? []) {
    const settings = (row.settings ?? {}) as { tuition_fee_gnf?: number };
    out[row.id as string] = Number(settings.tuition_fee_gnf ?? 1_500_000);
  }
  return out;
}

export async function getStudentPaymentSettings(): Promise<{
  settings: StudentPaymentSettings;
  error?: string;
}> {
  const session = await getSession();
  const orgId = session?.profile?.organization_id;
  if (!orgId) return { settings: parseStudentPaymentSettings(null), error: 'Aucune organisation' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('school_student_payment_settings', {
    p_org_id: orgId,
  });
  if (error) return { settings: parseStudentPaymentSettings(null), error: error.message };
  return { settings: parseStudentPaymentSettings(data) };
}

export type StudentPaymentOperationalPatch = Pick<
  StudentPaymentSettings,
  | 'enabled'
  | 'allow_enrollment_payment'
  | 'allow_reenrollment_payment'
  | 'allow_tuition_payment'
  | 'orange_money_enabled'
  | 'orange_money_merchant_phone'
  | 'orange_money_merchant_label'
  | 'tuition_whatsapp_reminder_enabled'
>;

/** Tarifs et tranches : uniquement via Paramètres → Année scolaire. */
export async function updateStudentPaymentOperationalSettings(
  patch: StudentPaymentOperationalPatch
) {
  const session = await getSession();
  if (!(await canConfigureStudentPayments(session?.profile?.role))) {
    return { error: 'Non autorisé' };
  }

  const orgId = await requireOrgId();
  const supabase = await createClient();
  const { data: currentRaw, error: loadErr } = await supabase.rpc(
    'school_student_payment_settings',
    { p_org_id: orgId }
  );
  if (loadErr) return { error: loadErr.message };

  const current = parseStudentPaymentSettings(currentRaw);
  const next: StudentPaymentSettings = {
    ...current,
    ...patch,
  };

  const { error } = await supabase.rpc('update_school_student_payment_settings', {
    p_org_id: orgId,
    p_settings: next,
  });
  if (error) return { error: error.message };
  revalidatePath('/parametres/paiements-eleves');
  revalidatePath('/parametres/annee-scolaire');
  revalidatePath('/etablissement/candidatures');
  return { success: true };
}

export async function updateStudentPaymentSettings(settings: StudentPaymentSettings) {
  const session = await getSession();
  if (!(await canConfigureStudentPayments(session?.profile?.role))) {
    return { error: 'Non autorisé' };
  }

  const normalized: StudentPaymentSettings = {
    ...settings,
    tuition_installments: normalizeInstallmentsForSave(settings.tuition_installments),
  };
  if (normalized.tuition_installments.length > 0) {
    const pctSum = sumInstallmentPercents(normalized.tuition_installments);
    if (Math.abs(pctSum - 100) > 0.01) {
      return {
        error: `Les pourcentages des tranches doivent totaliser 100 % (actuellement ${pctSum.toFixed(0)} %).`,
      };
    }
  }

  const orgId = await requireOrgId();
  const supabase = await createClient();
  const { error } = await supabase.rpc('update_school_student_payment_settings', {
    p_org_id: orgId,
    p_settings: normalized,
  });
  if (error) return { error: error.message };
  revalidatePath('/parametres/paiements-eleves');
  revalidatePath('/parametres/annee-scolaire');
  revalidatePath('/parametres/facturation');
  revalidatePath('/etablissement/candidatures');
  return { success: true };
}

export async function getTuitionBalance(
  studentId: string,
  enrollmentId?: string | null
): Promise<{ balance: TuitionBalance | null; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('school_tuition_balance', {
    p_student_id: studentId,
    p_enrollment_id: enrollmentId ?? null,
    p_academic_year: null,
  });
  if (error) return { balance: null, error: error.message };
  return { balance: parseTuitionBalance(data) };
}

export async function getTuitionBalancesForEnrollments(
  items: Array<{ studentId: string; enrollmentId: string }>
): Promise<Record<string, TuitionBalance | null>> {
  const out: Record<string, TuitionBalance | null> = {};
  await Promise.all(
    items.map(async ({ studentId, enrollmentId }) => {
      const { balance } = await getTuitionBalance(studentId, enrollmentId);
      out[enrollmentId] = balance;
    })
  );
  return out;
}

export async function createStudentPaymentLink(
  studentId: string,
  kind: StudentPaymentKind,
  enrollmentId?: string | null,
  amountGnf?: number | null
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_school_student_payment_link', {
    p_student_id: studentId,
    p_kind: kind,
    p_enrollment_id: enrollmentId ?? null,
    p_amount: kind === 'tuition' ? (amountGnf ?? null) : null,
  });
  if (error) return { error: error.message };
  return { data: data as Record<string, unknown> };
}

/** Lien de paiement généré par la comptabilité (élève importé, sans compte). */
export async function createStaffStudentPaymentLink(
  studentId: string,
  kind: StudentPaymentKind,
  enrollmentId?: string | null,
  amountGnf?: number | null
) {
  const session = await getSession();
  if (!(await canGeneratePaymentLinks(session?.profile?.role))) {
    return { error: 'Non autorisé' };
  }
  return createStudentPaymentLink(studentId, kind, enrollmentId, amountGnf);
}

export async function getStudentPaymentByToken(token: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_school_student_payment_by_token', {
    p_token: token,
  });
  if (error) return { error: error.message, payment: null };
  if (!data) return { error: 'Lien invalide', payment: null };
  return { payment: data as Record<string, unknown> };
}

export async function recordStudentPaymentByToken(token: string, reference?: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('record_school_student_payment_by_token', {
    p_token: token,
    p_reference: reference ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath('/etablissement/candidatures');
  revalidatePath('/etablissement/paiements');
  revalidatePath(`/recu-scolarite/${token}`);
  const row = data as Record<string, unknown> | null;
  const receiptUrl =
    (row?.receipt_url as string) ?? (row?.success || row?.already_paid ? `/recu-scolarite/${token}` : null);
  return { success: true, data: row, receiptUrl };
}

export async function prepareOrangeMoneyPayment(token: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('prepare_school_payment_orange_money', {
    p_token: token,
  });
  if (error) return { error: error.message };
  return { data: data as Record<string, unknown> };
}

export async function getPaymentReceiptByToken(
  token: string
): Promise<{ receipt: PaymentReceipt | null; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_school_payment_receipt_by_token', {
    p_token: token,
  });
  if (error) return { receipt: null, error: error.message };
  if (!data) return { receipt: null, error: 'Reçu introuvable ou paiement non confirmé' };
  return { receipt: parsePaymentReceipt(data) };
}

export async function getStudentPaymentOptionsForLearner(enrollmentId?: string) {
  const session = await getSession();
  const profileOrgId = session?.profile?.organization_id as string | undefined;
  const supabase = await createClient();

  let orgId = profileOrgId;
  let studentId: string | null = null;

  if (enrollmentId) {
    const { data: enrRow } = await supabase
      .from('school_enrollments')
      .select('organization_id, student_id, status, request_type')
      .eq('id', enrollmentId)
      .maybeSingle();
    if (enrRow?.organization_id) orgId = enrRow.organization_id as string;
    if (enrRow?.student_id) studentId = enrRow.student_id as string;
  }

  if (!orgId) {
    const studentIds = await getLinkedSchoolStudentIds();
    if (studentIds.length) {
      const { data: st } = await supabase
        .from('school_students')
        .select('id, organization_id, enrollment_status')
        .eq('id', studentIds[0])
        .maybeSingle();
      if (st?.organization_id) orgId = st.organization_id as string;
      if (st?.id) studentId = st.id as string;
    }
  }

  if (!orgId) return { settings: null, studentId: null, kinds: [] as StudentPaymentKind[] };

  const { data: settingsData } = await supabase.rpc('school_student_payment_settings', {
    p_org_id: orgId,
  });
  const settings = parseStudentPaymentSettings(settingsData);

  if (!settings.enabled) {
    return { settings, studentId: null, kinds: [] as StudentPaymentKind[] };
  }

  if (!studentId) {
    const studentIds = await getLinkedSchoolStudentIds();
    if (!studentIds.length) return { settings, studentId: null, kinds: [] };
    const { data: student } = await supabase
      .from('school_students')
      .select('id, enrollment_status')
      .eq('organization_id', orgId)
      .in('id', studentIds)
      .maybeSingle();
    if (!student?.id) {
      const { data: anyStudent } = await supabase
        .from('school_students')
        .select('id, enrollment_status')
        .in('id', studentIds)
        .limit(1)
        .maybeSingle();
      if (!anyStudent?.id) return { settings, studentId: null, kinds: [] };
      studentId = anyStudent.id as string;
    } else {
      studentId = student.id as string;
    }
  }

  const { data: student } = await supabase
    .from('school_students')
    .select('id, enrollment_status')
    .eq('id', studentId)
    .maybeSingle();

  if (!student?.id) return { settings, studentId: null, kinds: [] };

  const kinds: StudentPaymentKind[] = [];
  if (settings.allow_tuition_payment && student.enrollment_status === 'enrolled') {
    kinds.push('tuition');
  }

  if (enrollmentId && settings.allow_enrollment_payment) {
    const { data: enr } = await supabase
      .from('school_enrollments')
      .select('request_type, status')
      .eq('id', enrollmentId)
      .eq('student_id', student.id)
      .maybeSingle();
    if (enr && ['pending', 'admitted', 'enrolled'].includes(enr.status as string)) {
      if (enr.request_type === 'reenrollment' && settings.allow_reenrollment_payment) {
        kinds.push('reenrollment');
      }
      if ((enr.request_type === 'new' || !enr.request_type) && settings.allow_enrollment_payment) {
        kinds.push('enrollment');
      }
    }
  }

  return {
    settings,
    studentId: student.id as string,
    kinds,
  };
}
