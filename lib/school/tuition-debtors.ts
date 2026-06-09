import {
  installmentStatus,
  resolveTuitionInstallments,
  type TuitionBalance,
  type TuitionInstallment,
} from '@/lib/school/student-payments';

export type TuitionDebtorAlertStatus = 'overdue' | 'due_soon' | 'unpaid';

export interface TuitionDebtorRow {
  studentId: string;
  studentName: string;
  matricule: string | null;
  classId: string | null;
  className: string;
  guardianPhone: string | null;
  totalDueGnf: number;
  paidGnf: number;
  remainingGnf: number;
  alertLabel: string;
  alertStatus: TuitionDebtorAlertStatus;
  nextDueDate: string | null;
}

export function resolveDebtorInstallmentAlert(
  installments: TuitionInstallment[],
  balance: TuitionBalance
): {
  alertLabel: string;
  alertStatus: TuitionDebtorAlertStatus;
  nextDueDate: string | null;
} {
  if (balance.fully_paid || balance.remaining_gnf <= 0) {
    return { alertLabel: '—', alertStatus: 'unpaid', nextDueDate: null };
  }

  if (!installments.length) {
    return {
      alertLabel: 'Solde impayé',
      alertStatus: 'overdue',
      nextDueDate: null,
    };
  }

  const resolved = resolveTuitionInstallments(installments, balance.total_due_gnf);
  let cumulative = 0;
  let dueSoonFallback: {
    alertLabel: string;
    alertStatus: TuitionDebtorAlertStatus;
    nextDueDate: string | null;
  } | null = null;

  for (const inst of resolved) {
    cumulative += inst.amount_gnf;
    const st = installmentStatus(inst.due_date, balance.paid_gnf, cumulative);
    if (st === 'overdue') {
      return {
        alertLabel: `${inst.label} — échéance passée`,
        alertStatus: 'overdue',
        nextDueDate: inst.due_date,
      };
    }
    if (st === 'due_soon' && !dueSoonFallback) {
      dueSoonFallback = {
        alertLabel: `${inst.label} — échéance proche`,
        alertStatus: 'due_soon',
        nextDueDate: inst.due_date,
      };
    }
  }

  if (dueSoonFallback) return dueSoonFallback;

  return {
    alertLabel: 'Solde impayé',
    alertStatus: 'unpaid',
    nextDueDate: resolved[resolved.length - 1]?.due_date ?? null,
  };
}
