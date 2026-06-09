'use server';

import { createClient } from '@/lib/supabase/server';
import { requireOrgId } from '@/lib/actions/org';
import { getSessionEtablissementCapabilities } from '@/lib/school/session-capabilities';
import { personName } from '@/lib/school/person-utils';
import {
  parseStudentPaymentSettings,
  parseTuitionBalance,
  PAYMENT_KIND_LABELS,
  type StudentPaymentKind,
} from '@/lib/school/student-payments';
import {
  resolveDebtorInstallmentAlert,
  type TuitionDebtorRow,
} from '@/lib/school/tuition-debtors';

async function canViewTuitionFinance(): Promise<boolean> {
  const caps = await getSessionEtablissementCapabilities();
  return caps.viewPayments || caps.recordPayments || caps.viewFinanceStats || caps.isDirector;
}

export async function getTuitionDebtors(options?: {
  classId?: string | null;
}): Promise<{ debtors: TuitionDebtorRow[]; error?: string }> {
  if (!(await canViewTuitionFinance())) {
    return { debtors: [], error: 'Non autorisé' };
  }

  const orgId = await requireOrgId();
  const supabase = await createClient();

  const [{ data: students, error: studentsErr }, { data: settingsRaw }] = await Promise.all([
    supabase
      .from('school_students')
      .select(
        `id, matricule, class_id, core_persons(full_name), school_classes(id, name)`
      )
      .eq('organization_id', orgId)
      .eq('enrollment_status', 'enrolled'),
    supabase.rpc('school_student_payment_settings', { p_org_id: orgId }),
  ]);

  if (studentsErr) return { debtors: [], error: studentsErr.message };

  const settings = parseStudentPaymentSettings(settingsRaw);
  const installments = settings.tuition_installments;

  const studentIds = (students ?? []).map((s) => s.id as string);
  const guardianByStudent = new Map<string, string>();

  if (studentIds.length > 0) {
    const { data: enrollments } = await supabase
      .from('school_enrollments')
      .select('student_id, guardian_phone, created_at')
      .eq('organization_id', orgId)
      .in('student_id', studentIds)
      .in('status', ['pending', 'admitted', 'enrolled'])
      .order('created_at', { ascending: false });

    for (const e of enrollments ?? []) {
      const sid = e.student_id as string;
      if (!guardianByStudent.has(sid) && e.guardian_phone) {
        guardianByStudent.set(sid, e.guardian_phone as string);
      }
    }
  }

  const debtors: TuitionDebtorRow[] = [];

  await Promise.all(
    (students ?? []).map(async (s) => {
      const classId = (s.class_id as string) || null;
      if (options?.classId && classId !== options.classId) return;

      const { data: balRaw } = await supabase.rpc('school_tuition_balance', {
        p_student_id: s.id as string,
        p_enrollment_id: null,
        p_academic_year: null,
      });
      const balance = parseTuitionBalance(balRaw as Record<string, unknown>);
      if (!balance || balance.remaining_gnf <= 0) return;

      const cls = s.school_classes as { id?: string; name?: string } | null;
      const alert = resolveDebtorInstallmentAlert(installments, balance);

      debtors.push({
        studentId: s.id as string,
        studentName: personName(s as Record<string, unknown>),
        matricule: (s.matricule as string) || null,
        classId,
        className: cls?.name || 'Sans classe',
        guardianPhone: guardianByStudent.get(s.id as string) ?? null,
        totalDueGnf: balance.total_due_gnf,
        paidGnf: balance.paid_gnf,
        remainingGnf: balance.remaining_gnf,
        alertLabel: alert.alertLabel,
        alertStatus: alert.alertStatus,
        nextDueDate: alert.nextDueDate,
      });
    })
  );

  debtors.sort((a, b) => {
    const rank = (s: TuitionDebtorRow['alertStatus']) =>
      s === 'overdue' ? 0 : s === 'due_soon' ? 1 : 2;
    const d = rank(a.alertStatus) - rank(b.alertStatus);
    if (d !== 0) return d;
    return b.remainingGnf - a.remainingGnf;
  });

  return { debtors };
}

export interface PaymentExportRow {
  date: string;
  studentName: string;
  className: string;
  matricule: string;
  amountGnf: number;
  paymentKind: string;
  paymentMethod: string;
  status: string;
  receiptNumber: string;
}

export async function getPaymentsForExport(): Promise<{
  rows: PaymentExportRow[];
  error?: string;
}> {
  if (!(await canViewTuitionFinance())) {
    return { rows: [], error: 'Non autorisé' };
  }

  const orgId = await requireOrgId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('school_payments')
    .select(
      `amount, status, paid_at, created_at, payment_kind, payment_method, receipt_number,
       school_students(matricule, core_persons(full_name), school_classes(name))`
    )
    .eq('organization_id', orgId)
    .order('paid_at', { ascending: false, nullsFirst: false });

  if (error) return { rows: [], error: error.message };

  const methodLabels: Record<string, string> = {
    orange_money: 'Orange Money',
    mtn_momo: 'MTN MoMo',
    bank_transfer: 'Virement',
    cash: 'Espèces',
    other: 'Autre',
  };

  const statusLabels: Record<string, string> = {
    pending: 'En attente',
    paid: 'Payé',
    partial: 'Partiel',
    overdue: 'Impayé',
  };

  const rows: PaymentExportRow[] = (data ?? []).map((p) => {
    const st = p.school_students as Record<string, unknown> | null;
    const cls = st?.school_classes as { name?: string } | null;
    const kind = (p.payment_kind as StudentPaymentKind) || 'tuition';
    const paidAt = p.paid_at as string | null;
    return {
      date: paidAt
        ? new Date(paidAt).toLocaleDateString('fr-FR')
        : new Date(p.created_at as string).toLocaleDateString('fr-FR'),
      studentName: personName(st ?? {}),
      className: cls?.name || 'Sans classe',
      matricule: (st?.matricule as string) || '',
      amountGnf: Number(p.amount ?? 0),
      paymentKind: PAYMENT_KIND_LABELS[kind] ?? kind,
      paymentMethod: methodLabels[p.payment_method as string] || String(p.payment_method || ''),
      status: statusLabels[p.status as string] || String(p.status),
      receiptNumber: (p.receipt_number as string) || '',
    };
  });

  return { rows };
}

export async function exportTuitionDebtorsCsv(): Promise<{
  base64?: string;
  fileName?: string;
  count?: number;
  error?: string;
}> {
  const { debtors, error } = await getTuitionDebtors();
  if (error) return { error };
  if (!debtors.length) return { error: 'Aucun impayé à exporter.' };

  const header =
    'Matricule;Élève;Classe;Téléphone tuteur;Total dû;Payé;Reste;Alerte;Prochaine échéance';
  const lines = debtors.map((d) =>
    [
      d.matricule ?? '',
      d.studentName.replace(/;/g, ','),
      d.className.replace(/;/g, ','),
      d.guardianPhone ?? '',
      d.totalDueGnf.toFixed(0),
      d.paidGnf.toFixed(0),
      d.remainingGnf.toFixed(0),
      d.alertLabel.replace(/;/g, ','),
      d.nextDueDate
        ? new Date(d.nextDueDate).toLocaleDateString('fr-FR')
        : '',
    ].join(';')
  );

  const csv = [header, ...lines].join('\n');
  return {
    base64: Buffer.from(csv, 'utf-8').toString('base64'),
    fileName: `impayes_scolarite_${new Date().toISOString().slice(0, 10)}.csv`,
    count: debtors.length,
  };
}

export async function exportPaymentsCsv(): Promise<{
  base64?: string;
  fileName?: string;
  count?: number;
  error?: string;
}> {
  const { rows, error } = await getPaymentsForExport();
  if (error) return { error };
  if (!rows.length) return { error: 'Aucun paiement à exporter.' };

  const header =
    'Date;Matricule;Élève;Classe;Montant GNF;Type;Mode;Statut;N° reçu';
  const lines = rows.map((r) =>
    [
      r.date,
      r.matricule,
      r.studentName.replace(/;/g, ','),
      r.className.replace(/;/g, ','),
      r.amountGnf.toFixed(0),
      r.paymentKind,
      r.paymentMethod,
      r.status,
      r.receiptNumber,
    ].join(';')
  );

  const csv = [header, ...lines].join('\n');
  return {
    base64: Buffer.from(csv, 'utf-8').toString('base64'),
    fileName: `encaissements_scolarite_${new Date().toISOString().slice(0, 10)}.csv`,
    count: rows.length,
  };
}
