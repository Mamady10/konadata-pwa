import { headers } from 'next/headers';

/** URL canonique production si l'env n'est pas définie. */
export const APP_BASE_URL_FALLBACK = 'https://konadatagn.com';

/** URL depuis les variables d'environnement (emails, liens persistants). */
export function getAppBaseUrlFromEnv(): string {
  return (process.env.NEXT_PUBLIC_APP_URL?.trim() || APP_BASE_URL_FALLBACK).replace(/\/$/, '');
}

/**
 * URL de l'application pour la requête courante (QR, pages serveur).
 * Préfère l'hôte réel (Vercel) pour éviter les QR pointant vers localhost.
 */
export async function getAppBaseUrl(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get('x-forwarded-host') ?? h.get('host');
    const proto = (h.get('x-forwarded-proto') ?? 'https').split(',')[0]?.trim() || 'https';
    if (host && !host.startsWith('localhost') && !host.startsWith('127.0.0.1')) {
      return `${proto}://${host}`.replace(/\/$/, '');
    }
  } catch {
    /* hors requête */
  }
  return getAppBaseUrlFromEnv();
}

export function buildParticipationUrl(publicToken: string, baseUrl?: string): string {
  const base = (baseUrl ?? getAppBaseUrlFromEnv()).replace(/\/$/, '');
  return `${base}/participation-ong/${publicToken}`;
}

export function buildPaymentOfferUrl(paymentToken: string, baseUrl?: string): string {
  const base = (baseUrl ?? getAppBaseUrlFromEnv()).replace(/\/$/, '');
  return `${base}/paiement-organisation/${paymentToken}`;
}
