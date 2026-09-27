/**
 * Paiement en ligne KonaData (Orange Money, liens, confirmation par référence).
 * Désactivé tant que le prestataire n'est pas branché — évite les confirmations fictives.
 * Les encaissements au guichet (caisse établissement) restent possibles.
 */
export const PLATFORM_ONLINE_PAYMENTS_ENABLED = false;

export const PAYMENTS_UNAVAILABLE_MESSAGE =
  "Le paiement en ligne n'est pas encore disponible sur KonaData. Aucune transaction ne peut être enregistrée pour le moment. Utilisez l'offre de lancement gratuite, ou réglez hors plateforme en attendant l'activation du service.";

export function onlinePaymentsUnavailableError(): { error: string } | null {
  if (PLATFORM_ONLINE_PAYMENTS_ENABLED) return null;
  return { error: PAYMENTS_UNAVAILABLE_MESSAGE };
}
