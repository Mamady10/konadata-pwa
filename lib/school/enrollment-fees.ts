import type { StudentPaymentSettings, TuitionBalance } from '@/lib/school/student-payments';

export interface EnrollmentFeeBreakdown {
  className: string | null;
  enrollmentFeeGnf: number;
  tuitionFeeGnf: number;
  academicYear: string | null;
  status: string;
  balance: TuitionBalance | null;
}

export function classFromEnrollment(
  enrollment: Record<string, unknown>
): { name: string | null; tuitionFeeGnf: number | null } {
  const cls = enrollment.school_classes as
    | { name?: string; tuition_fee_gnf?: number | string | null }
    | null
    | undefined;
  if (!cls) return { name: null, tuitionFeeGnf: null };
  const fee = cls.tuition_fee_gnf;
  return {
    name: cls.name ?? null,
    tuitionFeeGnf: fee != null && Number(fee) > 0 ? Number(fee) : null,
  };
}

export function buildEnrollmentFeeBreakdown(
  enrollment: Record<string, unknown>,
  settings: StudentPaymentSettings | null | undefined,
  orgDefaultTuitionGnf: number,
  balance?: TuitionBalance | null
): EnrollmentFeeBreakdown {
  const { name, tuitionFeeGnf } = classFromEnrollment(enrollment);
  const rt = (enrollment.request_type as string) || 'new';
  const enrollmentFee =
    rt === 'reenrollment'
      ? Number(settings?.enrollment_reenrollment_fee_gnf ?? 0)
      : Number(settings?.enrollment_new_fee_gnf ?? 0);

  const tuitionTotal = tuitionFeeGnf ?? orgDefaultTuitionGnf;

  return {
    className: name,
    enrollmentFeeGnf: enrollmentFee,
    tuitionFeeGnf: balance?.total_due_gnf ?? tuitionTotal,
    academicYear: (enrollment.academic_year as string) ?? null,
    status: (enrollment.status as string) || 'pending',
    balance: balance ?? null,
  };
}

export function canPayTuitionForEnrollment(
  status: string,
  className: string | null,
  settings: StudentPaymentSettings | null | undefined,
  balance?: TuitionBalance | null
): boolean {
  const remaining = balance?.remaining_gnf;
  const hasBalance = remaining == null ? true : remaining > 0;
  return Boolean(
    settings?.enabled &&
      settings.allow_tuition_payment &&
      className &&
      ['admitted', 'enrolled'].includes(status) &&
      hasBalance &&
      !balance?.fully_paid
  );
}
