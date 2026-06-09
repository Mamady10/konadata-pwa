#!/usr/bin/env node
/**
 * Promote un email en platform_admin (CEO).
 * Usage: node scripts/promote-platform-admin.mjs mamadyk@gmail.com
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const email = (process.argv[2] || '').trim().toLowerCase();
if (!email) {
  console.error('Usage: node scripts/promote-platform-admin.mjs <email>');
  process.exit(1);
}

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '../.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.replace(/\r$/, '').match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('❌ Remplissez SUPABASE_SERVICE_ROLE_KEY dans .env.local puis relancez.');
  console.error('   Ou exécutez supabase/sql-editor/PROMOTE-mamadyk-ceo.sql dans le SQL Editor.');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: users, error: listErr } = await supabase.auth.admin.listUsers();
if (listErr) {
  console.error('❌ Auth admin:', listErr.message);
  process.exit(1);
}

const user = users.users.find((u) => u.email?.toLowerCase() === email);
if (!user) {
  console.error(`❌ Aucun utilisateur Auth pour ${email}. Créez-le dans Authentication → Users.`);
  process.exit(1);
}

const { data: existing } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();

if (!existing) {
  const { error: insErr } = await supabase.from('profiles').insert({
    id: user.id,
    email: user.email,
    full_name: user.user_metadata?.full_name || 'CEO KonaData',
    role: 'platform_admin',
    organization_id: null,
    is_active: true,
  });
  if (insErr) {
    console.error('❌ Insert profil:', insErr.message);
    process.exit(1);
  }
} else {
  const { error: updErr } = await supabase
    .from('profiles')
    .update({
      role: 'platform_admin',
      organization_id: null,
      is_active: true,
      full_name: existing.full_name || user.user_metadata?.full_name || 'CEO KonaData',
    })
    .eq('id', user.id);
  if (updErr) {
    console.error('❌ Update profil:', updErr.message);
    process.exit(1);
  }
}

const { data: profile } = await supabase
  .from('profiles')
  .select('id, email, role, organization_id, full_name, is_active')
  .eq('id', user.id)
  .single();

console.log('✅ Compte CEO configuré :');
console.log(profile);
process.exit(0);
