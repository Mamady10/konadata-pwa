#!/usr/bin/env node
/**
 * Diagnostic PME/dashboard : détecte les RPC/tables qui manquent ou renvoient null
 * (cause possible d'un crash server-side global). Lecture seule.
 *
 * Usage : node scripts/diag-pme.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');
const envPath = resolve(root, '.env.local');

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.replace(/\r$/, '').match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim();
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants.');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  console.log('\n=== Organisations business (PME) ===');
  const { data: orgs, error: orgErr } = await sb
    .from('organizations')
    .select('id, name, type, billing_status')
    .eq('type', 'business');
  if (orgErr) console.log('  ⚠️ erreur organizations:', orgErr.message);
  console.log('  orgs:', JSON.stringify(orgs, null, 2));

  console.log('\n=== Table pme_debts ===');
  const { error: debtsErr } = await sb.from('pme_debts').select('id').limit(1);
  console.log(debtsErr ? `  ⚠️ ${debtsErr.message}` : '  ✅ pme_debts accessible');

  console.log('\n=== Table pme_debt_payments ===');
  const { error: payErr } = await sb.from('pme_debt_payments').select('id').limit(1);
  console.log(payErr ? `  ⚠️ ${payErr.message}` : '  ✅ pme_debt_payments accessible');

  const testOrgId = orgs?.[0]?.id;
  if (testOrgId) {
    console.log(`\n=== RPC get_organization_ai_quota_status (org ${testOrgId}) ===`);
    const { data: q, error: qErr } = await sb.rpc('get_organization_ai_quota_status', {
      p_org_id: testOrgId,
    });
    if (qErr) console.log('  ⚠️ error:', qErr.message);
    console.log('  data =', JSON.stringify(q));
    if (q == null && !qErr) {
      console.log('  ❗ RENVOIE NULL SANS ERREUR → row.tier déréférence null → CRASH layout');
    }

    console.log(`\n=== RPC organization_platform_access_ok (org ${testOrgId}) ===`);
    const { data: acc, error: accErr } = await sb.rpc('organization_platform_access_ok', {
      p_org_id: testOrgId,
    });
    console.log(accErr ? `  ⚠️ ${accErr.message}` : `  data = ${JSON.stringify(acc)}`);

    console.log(`\n=== RPC get_organization_privacy_settings (org ${testOrgId}) ===`);
    const { data: ps, error: psErr } = await sb.rpc('get_organization_privacy_settings', {
      p_org_id: testOrgId,
    });
    console.log(psErr ? `  ⚠️ ${psErr.message}` : `  data = ${JSON.stringify(ps)}`);
  }

  console.log('\n=== RPC learner_has_enrollment_history (sans contexte user) ===');
  const { data: lh, error: lhErr } = await sb.rpc('learner_has_enrollment_history');
  console.log(lhErr ? `  ⚠️ ${lhErr.message}` : `  data = ${JSON.stringify(lh)}`);

  console.log('\nDiagnostic terminé.');
}

main().catch((e) => {
  console.error('\n❌ Exception:', e.message);
  process.exit(1);
});
