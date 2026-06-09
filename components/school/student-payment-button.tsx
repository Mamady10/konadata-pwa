'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createStudentPaymentLink } from '@/lib/actions/student-payments';
import {
  PAYMENT_KIND_LABELS,
  type StudentPaymentKind,
  type StudentPaymentSettings,
} from '@/lib/school/student-payments';
import { CreditCard } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Props {
  studentId: string;
  enrollmentId?: string;
  kind: StudentPaymentKind;
  settings: StudentPaymentSettings;
  amountGnf?: number;
  maxAmountGnf?: number;
  compact?: boolean;
  label?: string;
  allowCustomAmount?: boolean;
}

export function StudentPaymentButton({
  studentId,
  enrollmentId,
  kind,
  settings,
  amountGnf,
  maxAmountGnf,
  compact,
  label,
  allowCustomAmount,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAmount, setShowAmount] = useState(false);
  const [customAmount, setCustomAmount] = useState('');

  if (!settings.enabled) return null;

  const minAmount = settings.min_payment_gnf ?? 100_000;
  const defaultAmount =
    kind === 'enrollment'
      ? settings.enrollment_new_fee_gnf
      : kind === 'reenrollment'
        ? settings.enrollment_reenrollment_fee_gnf
        : (amountGnf ?? maxAmountGnf ?? 0);

  const displayAmount = amountGnf ?? defaultAmount ?? 0;
  const buttonLabel =
    label ??
    (displayAmount > 0
      ? `Payer ${formatCurrency(displayAmount)}`
      : `Payer — ${PAYMENT_KIND_LABELS[kind]}`);

  async function openPayment(amount?: number) {
    setLoading(true);
    setError(null);
    const res = await createStudentPaymentLink(
      studentId,
      kind,
      enrollmentId,
      kind === 'tuition' ? amount : undefined
    );
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    const token = (res.data as { payment_token?: string })?.payment_token;
    if (!token) {
      setError('Lien de paiement indisponible. Réessayez ou contactez la scolarité.');
      return;
    }
    router.push(`/paiement-scolarite/${token}`);
  }

  function handleClick() {
    if (kind === 'tuition' && allowCustomAmount) {
      if (!showAmount) {
        setCustomAmount(String(Math.min(maxAmountGnf ?? displayAmount, displayAmount || maxAmountGnf || minAmount)));
        setShowAmount(true);
        return;
      }
      const parsed = Number(customAmount.replace(/\s/g, ''));
      if (!parsed || parsed < minAmount) {
        setError(`Montant minimum : ${formatCurrency(minAmount)}`);
        return;
      }
      if (maxAmountGnf && parsed > maxAmountGnf) {
        setError(`Maximum : ${formatCurrency(maxAmountGnf)}`);
        return;
      }
      void openPayment(parsed);
      return;
    }
    void openPayment(kind === 'tuition' ? displayAmount : undefined);
  }

  return (
    <div className="inline-flex flex-col items-stretch gap-2 w-full">
      {showAmount && allowCustomAmount && (
        <div className="space-y-1">
          <Label htmlFor={`amt-${studentId}`} className="text-xs">
            Montant (min. {formatCurrency(minAmount)})
          </Label>
          <Input
            id={`amt-${studentId}`}
            type="number"
            min={minAmount}
            max={maxAmountGnf}
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            className="h-8 text-sm"
          />
          {maxAmountGnf != null && (
            <p className="text-[10px] text-muted-foreground">
              Solde restant : {formatCurrency(maxAmountGnf)}
            </p>
          )}
        </div>
      )}
      <Button
        size={compact ? 'sm' : 'default'}
        variant="outline"
        className="h-7 text-xs border-[#2563EB]/40 text-[#2563EB] hover:bg-[#2563EB]/5"
        disabled={loading}
        onClick={handleClick}
      >
        <CreditCard className="h-3 w-3 mr-1" />
        {loading ? 'Ouverture…' : showAmount && allowCustomAmount ? 'Continuer vers le paiement' : buttonLabel}
      </Button>
      {error && (
        <span className="text-[10px] text-destructive max-w-[260px] leading-snug">{error}</span>
      )}
    </div>
  );
}
