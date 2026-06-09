import { createHmac, timingSafeEqual } from 'crypto';

/** Vérifie X-Webhook-Signature ou X-Orange-Signature (HMAC-SHA256 hex du corps brut). */
export function verifyBillingWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string | undefined
): boolean {
  if (!secret?.trim()) return false;
  if (!signatureHeader?.trim()) return false;

  const expected = createHmac('sha256', secret.trim()).update(rawBody, 'utf8').digest('hex');
  const provided = signatureHeader.trim().replace(/^sha256=/i, '');

  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(provided, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(provided, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
}

export interface OrangeMoneyWebhookPayload {
  event_id?: string;
  transaction_id?: string;
  status?: string;
  amount?: number;
  amount_gnf?: number;
  currency?: string;
  payment_token?: string;
  reference?: string;
  metadata?: {
    payment_token?: string;
    organization_id?: string;
  };
}

export function parseOrangeMoneyWebhookPayload(body: unknown): {
  externalId: string;
  paymentToken: string;
  amountGnf: number | null;
  status: string;
  reference: string | null;
} | null {
  if (!body || typeof body !== 'object') return null;
  const p = body as OrangeMoneyWebhookPayload;

  const paymentToken =
    p.payment_token?.trim() ||
    p.metadata?.payment_token?.trim() ||
    null;
  if (!paymentToken) return null;

  const externalId =
    p.event_id?.trim() ||
    p.transaction_id?.trim() ||
    `${paymentToken}-${p.reference ?? 'no-ref'}`;
  if (!externalId) return null;

  const amountGnf =
    typeof p.amount_gnf === 'number'
      ? p.amount_gnf
      : typeof p.amount === 'number'
        ? p.amount
        : null;

  return {
    externalId,
    paymentToken,
    amountGnf,
    status: String(p.status ?? 'success'),
    reference: p.reference?.trim() ?? null,
  };
}
