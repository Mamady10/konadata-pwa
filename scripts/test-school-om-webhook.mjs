#!/usr/bin/env node
/**
 * Simule un webhook Orange Money pour un paiement scolarité (dev / staging).
 *
 * Usage:
 *   node scripts/test-school-om-webhook.mjs <payment_token> [amount_gnf]
 *
 * Env: SCHOOL_ORANGE_MONEY_WEBHOOK_SECRET ou BILLING_WEBHOOK_SECRET
 *      APP_URL (défaut http://localhost:3000)
 */
import { createHmac } from 'crypto';

const token = process.argv[2];
const amount = Number(process.argv[3] ?? 0) || 100000;
const base = process.env.APP_URL?.trim() || 'http://localhost:3000';
const secret =
  process.env.SCHOOL_ORANGE_MONEY_WEBHOOK_SECRET?.trim() ||
  process.env.ORANGE_MONEY_WEBHOOK_SECRET?.trim() ||
  process.env.BILLING_WEBHOOK_SECRET?.trim();

if (!token) {
  console.error('Usage: node scripts/test-school-om-webhook.mjs <payment_token> [amount_gnf]');
  process.exit(1);
}
if (!secret) {
  console.error('Définissez SCHOOL_ORANGE_MONEY_WEBHOOK_SECRET dans .env.local');
  process.exit(1);
}

const externalId = `test-om-${Date.now()}`;
const body = JSON.stringify({
  event_id: externalId,
  transaction_id: externalId,
  status: 'success',
  amount_gnf: amount,
  payment_token: token,
  reference: `OM-TEST-${externalId.slice(-6)}`,
});

const signature = createHmac('sha256', secret).update(body, 'utf8').digest('hex');
const url = `${base.replace(/\/$/, '')}/api/school-payment/webhook/orange-money`;

const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-webhook-signature': signature,
  },
  body,
});

const text = await res.text();
console.log(res.status, text);
