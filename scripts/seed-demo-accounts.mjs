#!/usr/bin/env node
/**
 * Crée / met à jour les comptes démo (1 par type d'organisation) pour la vidéo.
 * Usage: node scripts/seed-demo-accounts.mjs
 * Requiert SUPABASE_SERVICE_ROLE_KEY dans .env.local
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  DEMO_ACCOUNTS,
  DEMO_PASSWORD,
  DEMO_ORG_IDS,
} from './demo-accounts.config.mjs';
import { loadEnvLocal } from './demo-env.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dir, '../docs/demo-video');
const outJson = resolve(outDir, 'demo-accounts.json');

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis dans .env.local');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserIdByEmail(email) {
  let page = 1;
  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit.id;
    if (data.users.length < 200) break;
    page += 1;
  }
  return null;
}

async function ensureAuthUser(email, fullName) {
  let userId = await findUserIdByEmail(email);
  if (userId) {
    await admin.auth.admin.updateUserById(userId, {
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: fullName, account_intent: 'org_admin' },
    });
    console.log('  ↻ utilisateur existant mis à jour:', email);
    return userId;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName, account_intent: 'org_admin' },
  });
  if (error) throw error;
  console.log('  ✓ utilisateur créé:', email);
  return data.user.id;
}

async function ensureOrgActive(orgId, orgType) {
  const until = '2027-12-31';
  const { data: org } = await admin.from('organizations').select('settings').eq('id', orgId).single();

  const settings = {
    ...(org?.settings ?? {}),
    platform_subscription_valid_until: until,
    platform_billing_period: orgType === 'school' ? 'annual' : 'monthly',
    demo_video: true,
  };

  const { error } = await admin
    .from('organizations')
    .update({
      is_active: true,
      billing_status: 'active',
      settings,
    })
    .eq('id', orgId);

  if (error) throw error;

  if (orgType !== 'school') {
    const sector = orgType === 'business' ? 'business' : orgType;
    const { data: plan } = await admin
      .from('platform_billing_plans')
      .select('id')
      .eq('sector', sector)
      .eq('is_active', true)
      .order('monthly_price_gnf')
      .limit(1)
      .maybeSingle();

    if (plan?.id) {
      const end = new Date();
      end.setFullYear(end.getFullYear() + 1);
      await admin.from('organization_subscriptions').upsert(
        {
          organization_id: orgId,
          plan_id: plan.id,
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: end.toISOString(),
        },
        { onConflict: 'organization_id' }
      );
    }
  }

  await admin
    .from('organization_billing_offers')
    .update({ status: 'paid' })
    .eq('organization_id', orgId)
    .in('status', ['draft', 'awaiting_payment']);
}

async function clearExistingOrgAdmin(orgId, keepUserId, orgType) {
  const fallbackRole =
    orgType === 'school'
      ? 'registrar'
      : orgType === 'btp'
        ? 'btp_staff'
        : orgType === 'business'
          ? 'pme_staff'
          : 'ngo_staff';

  const { data: existing } = await admin
    .from('profiles')
    .select('id, role')
    .eq('organization_id', orgId)
    .eq('role', 'org_admin')
    .neq('id', keepUserId);

  for (const row of existing ?? []) {
    const { error } = await admin
      .from('profiles')
      .update({ role: fallbackRole })
      .eq('id', row.id);
    if (error) throw error;
  }
}

async function linkProfile(userId, account) {
  const role = account.role ?? 'org_admin';
  if (role === 'org_admin') {
    await clearExistingOrgAdmin(account.orgId, userId, account.orgType);
  }

  const { error } = await admin
    .from('profiles')
    .update({
      organization_id: account.orgId,
      role,
      full_name: account.fullName,
      email: account.email,
    })
    .eq('id', userId);

  if (error) throw error;
}

async function fetchNgoSurveyExtras() {
  const { data } = await admin
    .from('ngo_surveys')
    .select('id, title')
    .eq('organization_id', DEMO_ORG_IDS.ngo)
    .order('created_at', { ascending: false })
    .limit(1);

  if (!data?.[0]?.id) return [];

  const surveyId = data[0].id;
  return [
    {
      id: '25-ngo-analytiques',
      url: `/ong/sondages/${surveyId}/analytiques`,
      wait: 3000,
    },
    {
      id: '26-ngo-collecte-qr',
      url: `/ong/sondages/${surveyId}/collecter`,
      wait: 2500,
    },
  ];
}

async function main() {
  console.log('🎬 Seed comptes démo KonaData\n');

  for (const account of DEMO_ACCOUNTS) {
    console.log(`▶ ${account.key} (${account.email})`);
    const { data: org } = await admin
      .from('organizations')
      .select('id, name')
      .eq('id', account.orgId)
      .maybeSingle();

    if (!org) {
      console.warn(`  ⚠ Organisation ${account.orgId} absente — exécutez les migrations seed 010/011/037`);
      continue;
    }

    const userId = await ensureAuthUser(account.email, account.fullName);
    await linkProfile(userId, account);
    await ensureOrgActive(account.orgId, account.orgType);
    console.log(`  ✓ rattaché à ${org.name}`);
  }

  const ngoExtras = await fetchNgoSurveyExtras();
  const accountsOut = DEMO_ACCOUNTS.map((a) => ({
    key: a.key,
    email: a.email,
    password: DEMO_PASSWORD,
    fullName: a.fullName,
    orgId: a.orgId,
    orgType: a.orgType,
    captures:
      a.key === 'ngo' ? [...a.captures, ...ngoExtras] : a.captures,
  }));

  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    outJson,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        password: DEMO_PASSWORD,
        accounts: accountsOut,
      },
      null,
      2
    ),
    'utf8'
  );

  console.log('\n✅ Comptes prêts. Identifiants →', outJson);
  console.log('\nConnexion (tous les comptes) : mot de passe =', DEMO_PASSWORD);
  for (const a of accountsOut) {
    console.log(`  • ${a.key}: ${a.email}`);
  }
}

main().catch((e) => {
  console.error('❌', e.message || e);
  process.exit(1);
});
