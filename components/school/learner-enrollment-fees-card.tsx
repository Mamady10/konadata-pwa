'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StudentPaymentButton } from '@/components/school/student-payment-button';
import { TuitionInstallmentsCard } from '@/components/school/tuition-installments-card';
import {
  buildEnrollmentFeeBreakdown,
  canPayTuitionForEnrollment,
} from '@/lib/school/enrollment-fees';
import type { StudentPaymentSettings } from '@/lib/school/student-payments';
import { formatCurrency } from '@/lib/utils';
import { GraduationCap } from 'lucide-react';

const statusLabels: Record<string, string> = {
  pending: 'En attente',
  admitted: 'Admis',
  enrolled: 'Inscrit',
  rejected: 'Refusé',
};

interface Props {
  enrollment: Record<string, unknown>;
  settings: StudentPaymentSettings | null | undefined;
  orgDefaultTuitionGnf: number;
  studentId: string;
}

export function LearnerEnrollmentFeesCard({
  enrollment,
  settings,
  orgDefaultTuitionGnf,
  studentId,
}: Props) {
  const fees = buildEnrollmentFeeBreakdown(
    enrollment,
    settings,
    orgDefaultTuitionGnf,
    (enrollment.tuition_balance as import('@/lib/school/student-payments').TuitionBalance | null) ?? null
  );
  const status = fees.status;
  const enrollmentId = enrollment.id as string;
  const rt = (enrollment.request_type as string) || 'new';
  const payEnrollment =
    settings?.enabled &&
    ['pending', 'admitted', 'enrolled'].includes(status) &&
    (rt === 'reenrollment'
      ? settings.allow_reenrollment_payment
      : settings.allow_enrollment_payment);
  const payTuition = canPayTuitionForEnrollment(
    status,
    fees.className,
    settings,
    fees.balance
  );
  const enrollmentKind = rt === 'reenrollment' ? 'reenrollment' : 'enrollment';

  if (!['admitted', 'enrolled', 'pending'].includes(status)) return null;

  return (
    <Card className="border-emerald-500/30 bg-emerald-500/[0.03]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
          <GraduationCap className="h-4 w-4 text-emerald-600" />
          Frais et paiements
          <Badge variant="secondary" className="text-xs">
            {statusLabels[status] ?? status}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {fees.className ? (
          <p>
            <span className="text-muted-foreground">Classe acceptée :</span>{' '}
            <strong>{fees.className}</strong>
            {fees.academicYear && (
              <span className="text-muted-foreground"> · {fees.academicYear}</span>
            )}
          </p>
        ) : status === 'admitted' ? (
          <p className="text-muted-foreground">
            Vous êtes admis(e). La classe sera confirmée par la scolarité.
          </p>
        ) : null}

        {settings?.tuition_installments?.length ? (
          <TuitionInstallmentsCard
            installments={settings.tuition_installments}
            balance={fees.balance}
          />
        ) : fees.balance ? (
          <div className="rounded-lg border p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Scolarité annuelle</span>
              <span>{formatCurrency(fees.balance.total_due_gnf)}</span>
            </div>
            <div className="flex justify-between text-emerald-700">
              <span>Payé</span>
              <span>{formatCurrency(fees.balance.paid_gnf)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Reste</span>
              <span>{formatCurrency(fees.balance.remaining_gnf)}</span>
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          {payEnrollment && fees.enrollmentFeeGnf > 0 && (
            <div className="rounded-lg border p-3 space-y-2">
              <p className="font-medium">
                {rt === 'reenrollment' ? 'Frais de réinscription' : "Frais d'inscription"}
              </p>
              <p className="text-lg font-bold">{formatCurrency(fees.enrollmentFeeGnf)}</p>
              <StudentPaymentButton
                studentId={studentId}
                enrollmentId={enrollmentId}
                kind={enrollmentKind}
                settings={settings!}
                amountGnf={fees.enrollmentFeeGnf}
                label={
                  rt === 'reenrollment'
                    ? `Payer réinscription ${formatCurrency(fees.enrollmentFeeGnf)}`
                    : `Payer inscription ${formatCurrency(fees.enrollmentFeeGnf)}`
                }
              />
            </div>
          )}

          {payTuition && (
            <div className="rounded-lg border p-3 space-y-2">
              <p className="font-medium">Frais de scolarité</p>
              <p className="text-lg font-bold">
                {formatCurrency(fees.balance?.remaining_gnf ?? fees.tuitionFeeGnf)}
              </p>
              <p className="text-xs text-muted-foreground">
                Versement libre (min. {formatCurrency(settings?.min_payment_gnf ?? 100_000)})
              </p>
              {fees.className && (
                <p className="text-xs text-muted-foreground">Tarif classe {fees.className}</p>
              )}
              <StudentPaymentButton
                studentId={studentId}
                enrollmentId={enrollmentId}
                kind="tuition"
                settings={settings!}
                amountGnf={fees.balance?.remaining_gnf ?? fees.tuitionFeeGnf}
                maxAmountGnf={fees.balance?.remaining_gnf}
                allowCustomAmount
                label="Choisir le montant à payer"
              />
            </div>
          )}
        </div>

        {settings?.enabled && status === 'admitted' && !fees.className && (
          <p className="text-xs text-muted-foreground">
            Le paiement de la scolarité sera proposé dès qu&apos;une classe vous sera assignée.
          </p>
        )}

        {fees.balance?.fully_paid && (
          <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
            Scolarité entièrement réglée pour {fees.balance.academic_year}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
