/** Paiement par le directeur : uniquement après validation CEO. */

export function canOrganizationDirectorPay(offerStatus: string | null | undefined): boolean {
  return offerStatus === 'awaiting_payment';
}

export function isOfferAwaitingCeoValidation(offerStatus: string | null | undefined): boolean {
  return offerStatus === 'draft' || offerStatus == null;
}
