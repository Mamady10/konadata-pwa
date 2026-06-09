#!/usr/bin/env node
/**
 * Validation backend KonaData — RLS, rôles, données multi-secteurs
 * Usage: npm run validate:backend
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
const PASSWORD = process.env.VALIDATE_DEMO_PASSWORD || 'Demo@Kona2026';

const ORGS = {
  isc: '11111111-1111-1111-1111-111111111101',
  fdg: '11111111-1111-1111-1111-111111111102',
  btp: '11111111-1111-1111-1111-111111111103',
};

const DEMO_ACCOUNTS = [
  {
    label: 'ISC (École)',
    email: process.env.VALIDATE_ISC_EMAIL || 'director@isc.gn',
    orgId: ORGS.isc,
    orgType: 'school',
    dataChecks: [
      ['school_students', {}, 2, 'élèves'],
      ['school_classes', {}, 2, 'classes'],
      ['ngo_projects', {}, 0, 'projets ONG (isolation)'],
      ['btp_sites', {}, 0, 'chantiers BTP (isolation)'],
    ],
  },
  {
    label: 'FDG (ONG)',
    email: process.env.VALIDATE_NGO_EMAIL || 'director@fdg.gn',
    orgId: ORGS.fdg,
    orgType: 'ngo',
    dataChecks: [
      ['ngo_projects', {}, 4, 'projets ONG'],
      ['ngo_beneficiaries', {}, 3, 'bénéficiaires'],
      ['ngo_surveys', {}, 3, 'sondages'],
      ['school_students', {}, 0, 'élèves ISC (isolation)'],
      ['btp_sites', {}, 0, 'chantiers BTP (isolation)'],
    ],
  },
  {
    label: 'Guinée BTP',
    email: process.env.VALIDATE_BTP_EMAIL || 'director@guineebtp.gn',
    orgId: ORGS.btp,
    orgType: 'btp',
    dataChecks: [
      ['btp_sites', {}, 4, 'chantiers'],
      ['btp_stock', {}, 3, 'articles stock'],
      ['btp_delivery_notes', {}, 2, 'bons de livraison'],
      ['ngo_projects', {}, 0, 'projets ONG (isolation)'],
      ['school_students', {}, 0, 'élèves ISC (isolation)'],
    ],
  },
];

if (!url || !anonKey) {
  console.error('❌ Variables Supabase manquantes dans .env.local');
  process.exit(1);
}

const results = [];
function pass(label, detail = '') {
  results.push({ ok: true, label, detail });
  console.log(`✅ ${label}${detail ? ` — ${detail}` : ''}`);
}
function fail(label, detail = '') {
  results.push({ ok: false, label, detail });
  console.log(`❌ ${label}${detail ? ` — ${detail}` : ''}`);
}

console.log('\n🔍 Validation backend KonaData\n');
console.log(`Projet: ${url}\n`);

// ─── 1. Schéma ─────────────────────────────────────────────────
console.log('── 1. Schéma ──');
const anon = createClient(url, anonKey);

const schemaTables = [
  'organizations', 'profiles', 'core_persons', 'documents',
  'school_students', 'school_classes', 'school_subjects', 'school_teachers',
  'school_enrollments', 'school_payments', 'ngo_projects', 'ngo_beneficiaries',
  'ngo_surveys', 'btp_sites', 'btp_stock', 'btp_fuel_logs',
];

for (const table of schemaTables) {
  const { error } = await anon.from(table).select('id').limit(1);
  if (error?.code === 'PGRST116' || error?.message?.includes('does not exist')) {
    fail(`Table ${table}`, 'absente');
  } else if (error?.message?.includes('permission denied') || error?.code === '42501') {
    pass(`Table ${table}`, 'existe (RLS bloque anon ✓)');
  } else if (!error) {
    const { count } = await anon.from(table).select('*', { count: 'exact', head: true });
    if (count > 0) fail(`Table ${table}`, `RLS trop permissif — anon voit ${count} ligne(s)`);
    else pass(`Table ${table}`, 'existe (0 lignes pour anon ✓)');
  } else {
    pass(`Table ${table}`, `existe (${error.message.slice(0, 40)})`);
  }
}

// ─── 2. RLS anon ───────────────────────────────────────────────
console.log('\n── 2. RLS (accès anonyme) ──');
const { data: anonOrgs, error: anonOrgErr } = await anon.from('organizations').select('name');
if (anonOrgErr || !anonOrgs?.length) {
  pass('Anon ne lit pas organizations', anonOrgErr?.message || '0 lignes');
} else {
  fail('Anon ne lit pas organizations', `a lu ${anonOrgs.length} org(s)`);
}

// ─── 3–5. Validation par compte démo ────────────────────────────
async function countTable(client, table, filter = {}) {
  let q = client.from(table).select('*', { count: 'exact', head: true });
  for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
  const { count, error } = await q;
  return { count: count ?? 0, error };
}

for (const account of DEMO_ACCOUNTS) {
  console.log(`\n── Compte ${account.label} (${account.email}) ──`);

  const client = createClient(url, anonKey);
  const { data: authData, error: authErr } = await client.auth.signInWithPassword({
    email: account.email,
    password: PASSWORD,
  });

  if (authErr) {
    fail(`${account.label} — connexion`, authErr.message);
    console.log('   → Créez l\'utilisateur dans Auth puis exécutez supabase/demo-users.sql');
    continue;
  }
  pass(`${account.label} — connexion`, account.email);

  const { data: profile, error: profErr } = await client
    .from('profiles')
    .select('full_name, email, role, organization_id, organizations(name, type)')
    .eq('id', authData.user.id)
    .single();

  if (profErr || !profile) {
    fail(`${account.label} — profil`, profErr?.message || 'introuvable');
  } else {
    pass(`${account.label} — profil`, `${profile.full_name} / ${profile.role}`);
    if (profile.organization_id === account.orgId) {
      pass(`${account.label} — organisation`, profile.organizations?.name || account.orgId);
    } else {
      fail(`${account.label} — organisation`, `org_id=${profile.organization_id}`);
    }
    if (profile.organizations?.type === account.orgType) {
      pass(`${account.label} — type org`, account.orgType);
    } else {
      fail(`${account.label} — type org`, `type=${profile.organizations?.type}`);
    }
  }

  for (const [table, filter, expected, label] of account.dataChecks) {
    const { count, error } = await countTable(client, table, filter);
    if (error) {
      fail(`${account.label} — ${label}`, error.message);
    } else if (label.includes('isolation')) {
      if (count === expected) pass(`${account.label} — ${label}`, `${count} visible(s)`);
      else fail(`${account.label} — ${label}`, `attendu ${expected}, trouvé ${count}`);
    } else if (count >= expected) {
      pass(`${account.label} — ${label}`, `${count} enregistrement(s)`);
    } else {
      fail(`${account.label} — ${label}`, `attendu ≥${expected}, trouvé ${count} (migration 011 ?)`);
    }
  }

  await client.auth.signOut();
}

// ─── Résumé ──────────────────────────────────────────────────────
const ok = results.filter((r) => r.ok).length;
const ko = results.filter((r) => !r.ok).length;
console.log('\n' + '═'.repeat(50));
console.log(`Résultat: ${ok} OK / ${ko} échec(s)`);
if (ko === 0) {
  console.log('\n🎉 Backend validé — ISC, ONG et BTP prêts');
} else {
  console.log('\n⚠️  Corrigez les échecs (Auth, demo-users.sql, migration 011).');
}
console.log('═'.repeat(50) + '\n');
process.exit(ko > 0 ? 1 : 0);
