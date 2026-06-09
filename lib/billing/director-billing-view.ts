import type { OrganizationBillingStatus } from '@/lib/billing/types';
import { canOrganizationDirectorPay } from '@/lib/billing/offer-payment';

/** Masque la grille tarifaire plateforme (forfait / élève) pour les directeurs. */
export function sanitizeBillingStatusForDirector(
  status: OrganizationBillingStatus
): OrganizationBillingStatus {
  const offerStatus = status.offer?.status;
  const showValidatedTotal = canOrganizationDirectorPay(offerStatus);

  return {
    ...status,
    upfront_annual_due_gnf: undefined,
    platform_monthly_base_gnf: undefined,
    platform_annual_base_gnf: undefined,
    platform_per_student_gnf: undefined,
    offer: status.offer
      ? {
          status: status.offer.status,
          payment_token: status.offer.payment_token,
          ceo_notes: status.offer.ceo_notes,
          access_mode: status.offer.access_mode,
          activation_amount_gnf: showValidatedTotal
            ? status.offer.activation_amount_gnf
            : undefined,
        }
      : undefined,
    current_invoice: status.current_invoice
      ? {
          ...status.current_invoice,
          student_count: 0,
          line_items: [],
        }
      : status.current_invoice,
  };
}

/** Masque le détail tarifaire sur la page de paiement organisation (directeur). */
export function sanitizeBillingOfferForDirector(
  offer: Record<string, unknown>
): Record<string, unknown> {
  const offerStatus = offer.offer_status as string | undefined;
  const showValidatedTotal = canOrganizationDirectorPay(offerStatus);

  return {
    ...offer,
    per_enrolled_student_gnf: undefined,
    annual_base_gnf: undefined,
    monthly_base_gnf: undefined,
    declared_expected_students: undefined,
    activation_amount_gnf: showValidatedTotal ? offer.activation_amount_gnf : 0,
  };
}
