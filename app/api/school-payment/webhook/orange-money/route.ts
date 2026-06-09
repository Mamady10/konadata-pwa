import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  parseOrangeMoneyWebhookPayload,
  verifyBillingWebhookSignature,
} from '@/lib/billing/webhook-verify';

export const runtime = 'nodejs';

/**
 * Webhook Orange Money — paiements scolarité élèves.
 * URL à configurer chez Orange : /api/school-payment/webhook/orange-money
 * Le payload doit inclure payment_token (lien KonaData) dans metadata.
 */
export async function POST(request: NextRequest) {
  const secret =
    process.env.SCHOOL_ORANGE_MONEY_WEBHOOK_SECRET?.trim() ||
    process.env.ORANGE_MONEY_WEBHOOK_SECRET?.trim() ||
    process.env.BILLING_WEBHOOK_SECRET?.trim();

  if (!secret) {
    return NextResponse.json(
      { success: false, error: 'Webhook non configuré (SCHOOL_ORANGE_MONEY_WEBHOOK_SECRET)' },
      { status: 503 }
    );
  }

  const rawBody = await request.text();
  const signature =
    request.headers.get('x-webhook-signature') ||
    request.headers.get('x-orange-signature') ||
    request.headers.get('x-orange-money-signature');

  if (!verifyBillingWebhookSignature(rawBody, signature, secret)) {
    return NextResponse.json({ success: false, error: 'Signature invalide' }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ success: false, error: 'JSON invalide' }, { status: 400 });
  }

  const parsed = parseOrangeMoneyWebhookPayload(json);
  if (!parsed) {
    return NextResponse.json(
      { success: false, error: 'payment_token manquant dans le payload' },
      { status: 400 }
    );
  }

  const supabase = await createServiceClient();
  const { data, error } = await supabase.rpc('process_school_payment_webhook', {
    p_provider: 'orange_money',
    p_external_id: parsed.externalId,
    p_payment_token: parsed.paymentToken,
    p_amount_gnf: parsed.amountGnf,
    p_status: parsed.status,
    p_reference: parsed.reference,
  });

  if (error) {
    console.error('[webhook/school-payment/orange-money]', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 422 });
  }

  return NextResponse.json({ success: true, ...(data as object) });
}
