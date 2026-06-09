import {
  PAYMENT_KIND_LABELS,
  parseTuitionBalance,
  type PaymentConfirmationSource,
  type StudentPaymentKind,
} from '@/lib/school/student-payments';

export interface PaymentReceipt {
  payment_id: string;
  payment_token: string;
  receipt_number: string | null;
  receipt_issued_at: string | null;
  receipt_verification_code: string | null;
  amount_gnf: number;
  currency: string;
  payment_kind: StudentPaymentKind;
  payment_method: string | null;
  confirmation_source: PaymentConfirmationSource | null;
  provider_payment_id: string | null;
  reference: string | null;
  paid_at: string | null;
  description: string | null;
  academic_year: string | null;
  organization_id: string;
  organization_name: string;
  organization_email: string | null;
  organization_city: string | null;
  organization_phone: string | null;
  student_id: string;
  student_name: string;
  student_matricule: string | null;
  class_name: string | null;
  balance: ReturnType<typeof parseTuitionBalance>;
  issued_by: string;
}

export function parsePaymentReceipt(raw: unknown): PaymentReceipt | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (!o.payment_token) return null;

  return {
    payment_id: String(o.payment_id ?? ''),
    payment_token: String(o.payment_token),
    receipt_number: o.receipt_number != null ? String(o.receipt_number) : null,
    receipt_issued_at: o.receipt_issued_at != null ? String(o.receipt_issued_at) : null,
    receipt_verification_code:
      o.receipt_verification_code != null ? String(o.receipt_verification_code) : null,
    amount_gnf: Number(o.amount_gnf ?? 0),
    currency: String(o.currency ?? 'GNF'),
    payment_kind: (o.payment_kind as StudentPaymentKind) ?? 'tuition',
    payment_method: o.payment_method != null ? String(o.payment_method) : null,
    confirmation_source:
      o.confirmation_source != null
        ? (o.confirmation_source as PaymentConfirmationSource)
        : null,
    provider_payment_id:
      o.provider_payment_id != null ? String(o.provider_payment_id) : null,
    reference: o.reference != null ? String(o.reference) : null,
    paid_at: o.paid_at != null ? String(o.paid_at) : null,
    description: o.description != null ? String(o.description) : null,
    academic_year: o.academic_year != null ? String(o.academic_year) : null,
    organization_id: String(o.organization_id ?? ''),
    organization_name: String(o.organization_name ?? 'Établissement'),
    organization_email: o.organization_email != null ? String(o.organization_email) : null,
    organization_city: o.organization_city != null ? String(o.organization_city) : null,
    organization_phone: o.organization_phone != null ? String(o.organization_phone) : null,
    student_id: String(o.student_id ?? ''),
    student_name: String(o.student_name ?? '—'),
    student_matricule: o.student_matricule != null ? String(o.student_matricule) : null,
    class_name: o.class_name != null ? String(o.class_name) : null,
    balance: parseTuitionBalance(o.balance),
    issued_by: String(o.issued_by ?? 'KonaData'),
  };
}

export function formatReceiptDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      dateStyle: 'long',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export function paymentKindLabel(kind: StudentPaymentKind): string {
  return PAYMENT_KIND_LABELS[kind] ?? kind;
}
