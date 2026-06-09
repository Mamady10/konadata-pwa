'use client';

import { useEffect, useState } from 'react';
import { getTuitionBalance } from '@/lib/actions/student-payments';
import { TuitionInstallmentsCard } from '@/components/school/tuition-installments-card';
import {
  DEFAULT_STUDENT_PAYMENT_SETTINGS,
  type StudentPaymentSettings,
  type TuitionBalance,
} from '@/lib/school/student-payments';
import { formatCurrency } from '@/lib/utils';

interface Props {
  studentId: string;
  paymentSettings?: StudentPaymentSettings | null;
}

export function StaffStudentTuitionPanel({ studentId, paymentSettings = null }: Props) {
  const settings = paymentSettings ?? DEFAULT_STUDENT_PAYMENT_SETTINGS;
  const [balance, setBalance] = useState<TuitionBalance | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!studentId) {
      setBalance(null);
      return;
    }
    setLoading(true);
    void getTuitionBalance(studentId).then((r) => {
      setBalance(r.balance);
      setLoading(false);
    });
  }, [studentId]);

  if (!studentId) return null;

  if (loading) {
    return <p className="text-xs text-muted-foreground">Chargement du solde…</p>;
  }

  if (!balance) return null;

  return (
    <div className="space-y-2 sm:col-span-2">
      {settings.tuition_installments.length > 0 ? (
        <TuitionInstallmentsCard installments={settings.tuition_installments} balance={balance} />
      ) : (
        <div className="rounded-lg border p-3 text-sm space-y-1">
          <p className="font-medium">Solde scolarité</p>
          <p>Total : {formatCurrency(balance.total_due_gnf)}</p>
          <p className="text-emerald-700">Payé : {formatCurrency(balance.paid_gnf)}</p>
          <p className="font-semibold">Reste : {formatCurrency(balance.remaining_gnf)}</p>
        </div>
      )}
    </div>
  );
}
