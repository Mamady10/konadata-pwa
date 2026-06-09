export type StudentPaymentKind = 'tuition' | 'enrollment' | 'reenrollment';

export interface TuitionInstallment {
  label: string;
  /** Part de la scolarité annuelle (toutes classes) — ex. 40 = 40 %. */
  percent: number;
  due_date: string;
  /** Ancien format montant fixe — conservé pour lecture seule si percent absent. */
  amount_gnf?: number;
}

export interface ResolvedTuitionInstallment extends TuitionInstallment {
  amount_gnf: number;
}

export type PaymentConfirmationSource = 'manual' | 'orange_money' | 'staff';

export interface StudentPaymentSettings {
  enabled: boolean;
  allow_enrollment_payment: boolean;
  allow_reenrollment_payment: boolean;
  allow_tuition_payment: boolean;
  enrollment_new_fee_gnf: number;
  enrollment_reenrollment_fee_gnf: number;
  min_payment_gnf: number;
  tuition_installments: TuitionInstallment[];
  orange_money_enabled: boolean;
  orange_money_merchant_phone: string | null;
  orange_money_merchant_label: string | null;
}

export interface TuitionBalance {
  total_due_gnf: number;
  paid_gnf: number;
  remaining_gnf: number;
  academic_year: string;
  fully_paid: boolean;
  error?: string;
}

export const DEFAULT_STUDENT_PAYMENT_SETTINGS: StudentPaymentSettings = {
  enabled: false,
  allow_enrollment_payment: true,
  allow_reenrollment_payment: true,
  allow_tuition_payment: true,
  enrollment_new_fee_gnf: 0,
  enrollment_reenrollment_fee_gnf: 0,
  min_payment_gnf: 100_000,
  tuition_installments: [],
  orange_money_enabled: true,
  orange_money_merchant_phone: null,
  orange_money_merchant_label: null,
};

function parseInstallments(raw: unknown): TuitionInstallment[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, i) => {
      const o = (item ?? {}) as Record<string, unknown>;
      const due = String(o.due_date ?? '').trim();
      if (!due) return null;
      const percentRaw = o.percent ?? o.percentage ?? o.pct;
      const percent =
        percentRaw != null && String(percentRaw).trim() !== ''
          ? Math.min(100, Math.max(0, Number(percentRaw)))
          : 0;
      const legacyAmount = Math.max(0, Number(o.amount_gnf ?? 0));
      return {
        label: String(o.label ?? `Tranche ${i + 1}`).trim(),
        percent,
        due_date: due,
        ...(legacyAmount > 0 && percent <= 0 ? { amount_gnf: legacyAmount } : {}),
      };
    })
    .filter((x): x is TuitionInstallment => x !== null);
}

export function sumInstallmentPercents(installments: TuitionInstallment[]): number {
  return installments.reduce((sum, i) => sum + (i.percent || 0), 0);
}

/** Montants GNF par tranche selon la scolarité annuelle de la classe. */
export function resolveTuitionInstallments(
  installments: TuitionInstallment[],
  totalDueGnf: number
): ResolvedTuitionInstallment[] {
  if (!installments.length) return [];

  const usesPercent = installments.some((i) => i.percent > 0);
  if (!usesPercent || totalDueGnf <= 0) {
    return installments.map((inst) => ({
      ...inst,
      amount_gnf: Math.max(0, inst.amount_gnf ?? 0),
    }));
  }

  let allocated = 0;
  return installments.map((inst, idx) => {
    const isLast = idx === installments.length - 1;
    let amount = 0;
    if (inst.percent > 0) {
      if (isLast) {
        amount = Math.max(0, Math.round(totalDueGnf - allocated));
      } else {
        amount = Math.round((totalDueGnf * inst.percent) / 100);
        allocated += amount;
      }
    } else {
      amount = Math.max(0, inst.amount_gnf ?? 0);
    }
    return { ...inst, amount_gnf: amount };
  });
}

/** Données enregistrées : pourcentages + dates uniquement. */
export function normalizeInstallmentsForSave(
  installments: TuitionInstallment[]
): TuitionInstallment[] {
  return installments
    .filter((i) => i.due_date?.trim())
    .map((inst, i) => ({
      label: inst.label?.trim() || `Tranche ${i + 1}`,
      percent: Math.min(100, Math.max(0, Number(inst.percent) || 0)),
      due_date: inst.due_date.trim(),
    }));
}

export function parseStudentPaymentSettings(raw: unknown): StudentPaymentSettings {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    enabled: Boolean(o.enabled),
    allow_enrollment_payment: o.allow_enrollment_payment !== false,
    allow_reenrollment_payment: o.allow_reenrollment_payment !== false,
    allow_tuition_payment: o.allow_tuition_payment !== false,
    enrollment_new_fee_gnf: Number(o.enrollment_new_fee_gnf ?? 0),
    enrollment_reenrollment_fee_gnf: Number(o.enrollment_reenrollment_fee_gnf ?? 0),
    min_payment_gnf: Math.max(10_000, Number(o.min_payment_gnf ?? 100_000)),
    tuition_installments: parseInstallments(o.tuition_installments),
    orange_money_enabled: o.orange_money_enabled !== false,
    orange_money_merchant_phone:
      o.orange_money_merchant_phone != null ? String(o.orange_money_merchant_phone) : null,
    orange_money_merchant_label:
      o.orange_money_merchant_label != null ? String(o.orange_money_merchant_label) : null,
  };
}

export const CONFIRMATION_SOURCE_LABELS: Record<PaymentConfirmationSource, string> = {
  orange_money: 'Confirmé Orange Money',
  manual: 'Confirmé (déclaration famille)',
  staff: 'Validé par la comptabilité',
};

export function parseTuitionBalance(raw: unknown): TuitionBalance | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.error === 'string') return { ...emptyBalance(), error: o.error };
  return {
    total_due_gnf: Number(o.total_due_gnf ?? 0),
    paid_gnf: Number(o.paid_gnf ?? 0),
    remaining_gnf: Number(o.remaining_gnf ?? 0),
    academic_year: String(o.academic_year ?? ''),
    fully_paid: Boolean(o.fully_paid),
  };
}

function emptyBalance(): TuitionBalance {
  return {
    total_due_gnf: 0,
    paid_gnf: 0,
    remaining_gnf: 0,
    academic_year: '',
    fully_paid: false,
  };
}

export const PAYMENT_KIND_LABELS: Record<StudentPaymentKind, string> = {
  tuition: 'Frais de scolarité',
  enrollment: "Frais d'inscription",
  reenrollment: 'Frais de réinscription',
};

const ENROLLMENT_PAYABLE_STATUSES = ['pending', 'admitted', 'enrolled'] as const;

export function paymentKindForEnrollmentRequest(
  requestType: string,
  status: string,
  settings: Pick<
    StudentPaymentSettings,
    'allow_enrollment_payment' | 'allow_reenrollment_payment'
  > | null
  | undefined
): StudentPaymentKind | null {
  if (!settings) return null;
  const rt = requestType || 'new';
  if (!ENROLLMENT_PAYABLE_STATUSES.includes(status as (typeof ENROLLMENT_PAYABLE_STATUSES)[number])) {
    return null;
  }
  if (rt === 'reenrollment' && settings.allow_reenrollment_payment) return 'reenrollment';
  if (rt === 'new' && settings.allow_enrollment_payment) return 'enrollment';
  return null;
}

export function suggestedStaffPaymentAmount(
  kind: StudentPaymentKind,
  settings: StudentPaymentSettings
): number {
  if (kind === 'enrollment') return Math.max(0, settings.enrollment_new_fee_gnf);
  if (kind === 'reenrollment') return Math.max(0, settings.enrollment_reenrollment_fee_gnf);
  return 0;
}

export function defaultStaffPaymentDescription(kind: StudentPaymentKind): string {
  return PAYMENT_KIND_LABELS[kind];
}

export interface StaffPaymentEnrollmentOption {
  id: string;
  studentId: string;
  requestType: string;
  status: string;
  academicYear: string | null;
  className: string | null;
}

export function formatStaffPaymentEnrollmentLabel(option: StaffPaymentEnrollmentOption): string {
  const typeLabel =
    option.requestType === 'reenrollment' ? 'Réinscription' : 'Inscription';
  const year = option.academicYear ? ` · ${option.academicYear}` : '';
  const cls = option.className ? ` · ${option.className}` : '';
  return `${typeLabel}${year}${cls}`;
}

export function installmentStatus(
  dueDate: string,
  paidGnf: number,
  suggestedAmount: number
): 'paid' | 'due_soon' | 'overdue' | 'upcoming' {
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  if (paidGnf >= suggestedAmount && suggestedAmount > 0) return 'paid';
  if (due < today) return 'overdue';
  const diff = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  if (diff <= 7) return 'due_soon';
  return 'upcoming';
}
