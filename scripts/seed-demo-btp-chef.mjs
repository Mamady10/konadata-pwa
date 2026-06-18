#!/usr/bin/env node
/**
 * Compte démo chef de chantier BTP (btp_staff) + assignations + fiches journalières semaine en cours.
 * Usage: node scripts/seed-demo-btp-chef.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { DEMO_ORG_IDS, DEMO_PASSWORD } from './demo-accounts.config.mjs';
import { loadEnvLocal } from './demo-env.mjs';

loadEnvLocal();

function getIsoWeekParts(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

function mondayOfIsoWeek(year, week) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const monday = new Date(week1Monday);
  monday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  return monday;
}

function isoWeekDateRange(year, week) {
  const monday = mondayOfIsoWeek(year, week);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { from: monday.toISOString().slice(0, 10), to: sunday.toISOString().slice(0, 10) };
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CHEF = {
  email: 'demo.chef.btp@konadata.demo',
  fullName: 'Mamadou DIALLO — Chef de chantier',
  password: DEMO_PASSWORD,
  orgId: DEMO_ORG_IDS.btp,
};

if (!url || !serviceKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis (.env.local)');
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

async function ensureChefUser() {
  let userId = await findUserIdByEmail(CHEF.email);
  if (userId) {
    await admin.auth.admin.updateUserById(userId, {
      password: CHEF.password,
      email_confirm: true,
      user_metadata: { full_name: CHEF.fullName, account_intent: 'staff' },
    });
    console.log('  ↻ utilisateur mis à jour:', CHEF.email);
    return userId;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email: CHEF.email,
    password: CHEF.password,
    email_confirm: true,
    user_metadata: { full_name: CHEF.fullName, account_intent: 'staff' },
  });
  if (error) throw error;
  console.log('  ✓ utilisateur créé:', CHEF.email);
  return data.user.id;
}

async function main() {
  console.log('👷 Seed chef de chantier BTP démo\n');

  const { data: org } = await admin
    .from('organizations')
    .select('id, name')
    .eq('id', CHEF.orgId)
    .maybeSingle();

  if (!org) {
    console.error('❌ Organisation BTP démo absente — exécutez migrations seed 011');
    process.exit(1);
  }

  const userId = await ensureChefUser();

  const { error: profileErr } = await admin
    .from('profiles')
    .update({
      organization_id: CHEF.orgId,
      role: 'btp_staff',
      full_name: CHEF.fullName,
      email: CHEF.email,
      is_active: true,
    })
    .eq('id', userId);

  if (profileErr) throw profileErr;
  console.log('  ✓ profil btp_staff →', org.name);

  const { data: sites, error: siteErr } = await admin
    .from('btp_sites')
    .select('id, name')
    .eq('organization_id', CHEF.orgId)
    .eq('status', 'active')
    .order('name');

  if (siteErr) throw siteErr;
  if (!sites?.length) {
    console.error('❌ Aucun chantier actif dans l\'org BTP démo');
    process.exit(1);
  }

  const primary =
    sites.find((s) => s.name === 'Pont Kaloum') ??
    sites.find((s) => s.name === 'Route RN1 - Labé') ??
    sites[0];
  const secondary = sites.find((s) => s.id !== primary.id) ?? null;
  const assignSiteIds = [primary.id, ...(secondary ? [secondary.id] : [])];

  await admin
    .from('collaborator_assignments')
    .delete()
    .eq('organization_id', CHEF.orgId)
    .eq('profile_id', userId)
    .eq('resource_type', 'btp_site');

  const assignmentRows = assignSiteIds.map((siteId) => ({
    organization_id: CHEF.orgId,
    profile_id: userId,
    resource_type: 'btp_site',
    resource_id: siteId,
    can_import: false,
    can_upload: true,
    can_edit: true,
    assigned_by: userId,
  }));

  const { error: assignErr } = await admin.from('collaborator_assignments').insert(assignmentRows);
  if (assignErr) throw assignErr;

  const siteNames = sites
    .filter((s) => assignSiteIds.includes(s.id))
    .map((s) => s.name)
    .join(', ');
  console.log('  ✓ assigné aux chantiers:', siteNames);

  const { year, week } = getIsoWeekParts(new Date());
  const { from, to } = isoWeekDateRange(year, week);

  await admin
    .from('btp_daily_progress')
    .delete()
    .eq('organization_id', CHEF.orgId)
    .eq('site_id', primary.id)
    .gte('progress_date', from)
    .lte('progress_date', to);

  const samples = [
    {
      offset: 0,
      physical_pct: 44,
      workers_count: 16,
      weather: 'Ensoleillé',
      notes: 'Travaux : coffrage poteaux P4–P5. Difficultés : aucune.',
    },
    {
      offset: 1,
      physical_pct: 44.5,
      workers_count: 18,
      weather: 'Nuageux',
      notes: 'Travaux : coulage dalle bloc B. Livraison ciment reçue.',
    },
    {
      offset: 2,
      physical_pct: 45,
      workers_count: 17,
      weather: 'Ensoleillé',
      notes: 'Travaux : décoffrage et ferraillage P6. HSE : briefing OK.',
    },
  ];

  const monday = new Date(`${from}T12:00:00Z`);
  for (const sample of samples) {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + sample.offset);
    const progressDate = d.toISOString().slice(0, 10);
    if (progressDate > to) continue;

    await admin.from('btp_daily_progress').insert({
      organization_id: CHEF.orgId,
      site_id: primary.id,
      progress_date: progressDate,
      physical_pct: sample.physical_pct,
      workers_count: sample.workers_count,
      weather: sample.weather,
      notes: sample.notes,
      created_by: userId,
    });
  }
  console.log(`  ✓ ${samples.length} fiche(s) journalière(s) semaine ${year}-W${String(week).padStart(2, '0')} (${primary.name})`);

  console.log('\n✅ Compte prêt pour test\n');
  console.log('  Email    :', CHEF.email);
  console.log('  Mot de passe :', CHEF.password);
  console.log('  Connexion : https://www.konadatagn.com/login');
  console.log('  Puis      : /btp/avancement · /btp/rapports (compiler hebdo)');
  console.log('  Chantier principal :', primary.name);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
