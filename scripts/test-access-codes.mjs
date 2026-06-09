#!/usr/bin/env node
/**
 * Diagnostic codes d'accès — director@isc.gn
 * Usage: node scripts/test-access-codes.mjs
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
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.VALIDATE_ISC_EMAIL || 'director@isc.gn';
const password = process.env.VALIDATE_DEMO_PASSWORD || 'Demo@Kona2026';

if (!url || !anonKey) {
  console.error('❌ .env.local incomplet');
  process.exit(1);
}

const client = createClient(url, anonKey);

console.log('\n🔑 Test codes d\'accès —', email, '\n');

const { data: auth, error: authErr } = await client.auth.signInWithPassword({ email, password });
if (authErr) {
  console.error('❌ Connexion:', authErr.message);
  process.exit(1);
}
console.log('✅ Connexion OK — user', auth.user.id);

const { data: profile, error: profErr } = await client
  .from('profiles')
  .select('role, organization_id, is_active, organizations(id, name, type)')
  .eq('id', auth.user.id)
  .single();

if (profErr) {
  console.error('❌ Profil:', profErr.message);
} else {
  console.log('📋 Profil:', JSON.stringify(profile, null, 2));
}

const { data: canIssue, error: canErr } = await client.rpc('can_issue_access_codes');
console.log('\nRPC can_issue_access_codes:');
if (canErr) console.error('  ❌', canErr.code, canErr.message);
else console.log('  →', canIssue);

const { data: codes, error: listErr } = await client
  .from('organization_access_codes')
  .select('id, code, role, is_active')
  .limit(5);
console.log('\nSELECT organization_access_codes:');
if (listErr) console.error('  ❌', listErr.code, listErr.message);
else console.log('  →', codes?.length ?? 0, 'ligne(s)', codes);

const { data: genCode, error: genErr } = await client.rpc('generate_access_code', {
  p_role: 'teacher',
  p_label: 'diag-test',
  p_max_uses: 1,
  p_expires_days: 1,
});
console.log('\nRPC generate_access_code(teacher):');
if (genErr) console.error('  ❌', genErr.code, genErr.message);
else {
  console.log('  ✅ Code:', genCode);
  const { data: row } = await client
    .from('organization_access_codes')
    .select('id')
    .eq('code', genCode)
    .single();
  if (row?.id) {
    await client.rpc('revoke_access_code', { p_code_id: row.id });
    console.log('  (code révoqué après test)');
  }
}

await client.auth.signOut();
console.log('\n');
