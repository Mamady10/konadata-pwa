#!/usr/bin/env node
/**
 * Vérifie migration 049 (webhook, essai 30j, rappels).
 * Usage: node scripts/verify-migration-049.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '../.env.local');

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.replace(/\r$/, '');
    const m = trimmed.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis dans .env.local');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let ok = 0;
let fail = 0;

function pass(msg) {
  console.log('✅', msg);
  ok += 1;
}
function failMsg(msg) {
  console.log('❌', msg);
  fail += 1;
}

console.log('🔗', url);
console.log('--- Vérification migration 049 ---\n');

const { error: t1 } = await supabase.from('platform_billing_webhook_events').select('id').limit(1);
if (t1?.message?.includes('does not exist')) failMsg('Table platform_billing_webhook_events absente');
else if (t1) failMsg(`platform_billing_webhook_events: ${t1.message}`);
else pass('Table platform_billing_webhook_events');

const { error: t2 } = await supabase.from('platform_billing_renewal_reminders').select('id').limit(1);
if (t2?.message?.includes('does not exist')) failMsg('Table platform_billing_renewal_reminders absente');
else if (t2) failMsg(`platform_billing_renewal_reminders: ${t2.message}`);
else pass('Table platform_billing_renewal_reminders');

const { data: offerCols, error: colErr } = await supabase
  .from('organization_billing_offers')
  .select('access_mode, payment_token, status, organization_id')
  .limit(1);

if (colErr?.message?.includes('access_mode')) {
  failMsg('Colonne organization_billing_offers.access_mode absente → exécutez migration 049');
} else if (colErr) {
  failMsg(`organization_billing_offers: ${colErr.message}`);
} else {
  pass('Colonne access_mode sur organization_billing_offers');
}

const { error: rpcErr } = await supabase.rpc('list_billing_renewal_reminder_targets', {
  p_days_before: 30,
});
if (rpcErr?.message?.includes('Could not find')) {
  failMsg('Fonction list_billing_renewal_reminder_targets absente');
} else if (rpcErr) {
  failMsg(`list_billing_renewal_reminder_targets: ${rpcErr.message}`);
} else {
  pass('Fonction list_billing_renewal_reminder_targets');
}

const { error: whErr } = await supabase.rpc('process_billing_payment_webhook', {
  p_provider: 'orange_money',
  p_external_id: '__verify_ping__',
  p_payment_token: '__invalid__',
  p_amount_gnf: 0,
  p_status: 'failed',
  p_reference: null,
});
if (whErr?.message?.includes('Could not find')) {
  failMsg('Fonction process_billing_payment_webhook absente');
} else if (whErr?.message?.includes('introuvable') || whErr?.message?.includes('not_successful')) {
  pass('Fonction process_billing_payment_webhook (répond comme attendu)');
} else if (whErr) {
  pass(`Fonction process_billing_payment_webhook présente (${whErr.message.slice(0, 60)}…)`);
} else {
  pass('Fonction process_billing_payment_webhook');
}

console.log('\n--- Organisation de test (offre awaiting_payment) ---\n');

const { data: offers, error: offErr } = await supabase
  .from('organization_billing_offers')
  .select(
    'payment_token, status, activation_amount_gnf, access_mode, organization_id, organizations(name, billing_status)'
  )
  .eq('status', 'awaiting_payment')
  .limit(3);

if (offErr) {
  failMsg(offErr.message);
} else if (!offers?.length) {
  console.log('⚠️  Aucune offre en awaiting_payment.');
  console.log('   → CEO : /organisations → « Fixer le tarif » sur une école en attente.');
  const { data: draft } = await supabase
    .from('organization_billing_offers')
    .select('payment_token, status, organization_id, organizations(name)')
    .eq('status', 'draft')
    .limit(2);
  if (draft?.length) {
    console.log('\n   Offres en draft (tarif pas encore validé) :');
    for (const d of draft) {
      const org = d.organizations;
      console.log(`   - ${org?.name ?? d.organization_id} (draft)`);
    }
  }
} else {
  for (const o of offers) {
    const org = o.organizations;
    console.log(`📌 ${org?.name ?? '?'}`);
    console.log(`   payment_token: ${o.payment_token}`);
    console.log(`   montant GNF: ${o.activation_amount_gnf}`);
    console.log(`   access_mode: ${o.access_mode ?? 'annual'}`);
    console.log(`   billing_status org: ${org?.billing_status ?? '?'}`);
    console.log('');
  }
}

console.log('--- Environnement webhook local ---');
const secret = process.env.ORANGE_MONEY_WEBHOOK_SECRET || process.env.BILLING_WEBHOOK_SECRET;
if (secret) pass('ORANGE_MONEY_WEBHOOK_SECRET défini dans .env.local');
else {
  console.log('⚠️  ORANGE_MONEY_WEBHOOK_SECRET non défini — ajoutez-le pour tester curl');
}

console.log(`\nRésultat: ${ok} OK, ${fail} échec(s)`);
process.exit(fail > 0 ? 1 : 0);
