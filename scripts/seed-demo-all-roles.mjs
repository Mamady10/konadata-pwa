#!/usr/bin/env node
/**
 * Crée / met à jour les comptes démo pour tous les rôles AppRole.
 * Usage: npm run seed:demo:all
 * Requiert SUPABASE_SERVICE_ROLE_KEY dans .env.local
 */
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { DEMO_ORG_IDS, DEMO_PASSWORD } from './demo-accounts.config.mjs';
import { loadEnvLocal } from './demo-env.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const outJson = resolve(__dir, '../docs/demo-video/demo-accounts-all.json');

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

/** @type {Array<{
 *   key: string;
 *   email: string;
 *   fullName: string;
 *   role: string;
 *   orgId: string | null;
 *   sector: string;
 *   loginUrl: string;
 *   notes?: string;
 * }>} */
const DEMO_ROLE_ACCOUNTS = [
  {
    key: 'platform_admin',
    email: 'demo.admin@konadata.demo',
    fullName: 'Admin Plateforme KonaData',
    role: 'platform_admin',
    orgId: null,
    sector: 'Plateforme',
    loginUrl: '/dashboard',
    notes: 'Accès CEO / organisations / sécurité',
  },
  {
    key: 'school_director',
    email: 'demo.ecole@konadata.demo',
    fullName: 'Directeur Démo ISC',
    role: 'org_admin',
    orgId: DEMO_ORG_IDS.school,
    sector: 'Établissement',
    loginUrl: '/etablissement',
  },
  {
    key: 'deputy_director',
    email: 'demo.adjoint@konadata.demo',
    fullName: 'Directeur Adjoint Démo',
    role: 'deputy_director',
    orgId: DEMO_ORG_IDS.school,
    sector: 'Établissement',
    loginUrl: '/etablissement',
  },
  {
    key: 'registrar',
    email: 'demo.scolarite@konadata.demo',
    fullName: 'Responsable Scolarité Démo',
    role: 'registrar',
    orgId: DEMO_ORG_IDS.school,
    sector: 'Établissement',
    loginUrl: '/etablissement/candidatures',
  },
  {
    key: 'accountant',
    email: 'demo.comptable@konadata.demo',
    fullName: 'Comptable Démo ISC',
    role: 'accountant',
    orgId: DEMO_ORG_IDS.school,
    sector: 'Établissement',
    loginUrl: '/etablissement/paiements',
  },
  {
    key: 'teacher',
    email: 'demo.prof@konadata.demo',
    fullName: 'Professeur Démo ISC',
    role: 'teacher',
    orgId: DEMO_ORG_IDS.school,
    sector: 'Établissement',
    loginUrl: '/etablissement/resultats',
    notes: 'Assigné L1 Info × Programmation',
  },
  {
    key: 'student',
    email: 'demo.eleve@konadata.demo',
    fullName: 'Élève Démo Ousmane',
    role: 'student',
    orgId: DEMO_ORG_IDS.school,
    sector: 'Établissement',
    loginUrl: '/mon-espace',
    notes: 'Élève inscrit L1 Informatique',
  },
  {
    key: 'candidate',
    email: 'demo.candidat@konadata.demo',
    fullName: 'Candidat Démo Fatou',
    role: 'candidate',
    orgId: DEMO_ORG_IDS.school,
    sector: 'Établissement',
    loginUrl: '/mon-espace',
    notes: 'Candidature en attente',
  },
  {
    key: 'ngo_director',
    email: 'demo.ong@konadata.demo',
    fullName: 'Directrice Démo FDG',
    role: 'org_admin',
    orgId: DEMO_ORG_IDS.ngo,
    sector: 'ONG',
    loginUrl: '/ong',
  },
  {
    key: 'ngo_staff',
    email: 'demo.staff.ong@konadata.demo',
    fullName: 'Chargé de Projet Démo ONG',
    role: 'ngo_staff',
    orgId: DEMO_ORG_IDS.ngo,
    sector: 'ONG',
    loginUrl: '/ong/projets',
    notes: 'Assigné au 1er projet ONG',
  },
  {
    key: 'btp_director',
    email: 'demo.btp@konadata.demo',
    fullName: 'Directeur Démo BTP',
    role: 'org_admin',
    orgId: DEMO_ORG_IDS.btp,
    sector: 'BTP',
    loginUrl: '/btp',
  },
  {
    key: 'btp_staff',
    email: 'demo.chef.btp@konadata.demo',
    fullName: 'Mamadou DIALLO — Chef de chantier',
    role: 'btp_staff',
    orgId: DEMO_ORG_IDS.btp,
    sector: 'BTP',
    loginUrl: '/btp/avancement',
    notes: 'Assigné Pont Kaloum + fiches journalières',
  },
  {
    key: 'pme_director',
    email: 'demo.pme@konadata.demo',
    fullName: 'Gérant Démo Mamou',
    role: 'org_admin',
    orgId: DEMO_ORG_IDS.pme,
    sector: 'PME',
    loginUrl: '/pme',
  },
  {
    key: 'pme_staff',
    email: 'demo.staff.pme@konadata.demo',
    fullName: 'Vendeur Démo PME',
    role: 'pme_staff',
    orgId: DEMO_ORG_IDS.pme,
    sector: 'PME',
    loginUrl: '/pme/ventes',
  },
];

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

async function ensureAuthUser(email, fullName, accountIntent) {
  let userId = await findUserIdByEmail(email);
  if (userId) {
    await admin.auth.admin.updateUserById(userId, {
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: fullName, account_intent: accountIntent },
    });
    return userId;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName, account_intent: accountIntent },
  });
  if (error) throw error;
  return data.user.id;
}

async function ensureOrgActive(orgId, orgType) {
  if (!orgId) return;
  const until = '2027-12-31';
  const { data: org } = await admin.from('organizations').select('settings').eq('id', orgId).single();
  const settings = {
    ...(org?.settings ?? {}),
    platform_subscription_valid_until: until,
    platform_billing_period: orgType === 'school' ? 'annual' : 'monthly',
    demo_video: true,
    accepts_student_applications: true,
  };
  await admin.from('organizations').update({ is_active: true, billing_status: 'active', settings }).eq('id', orgId);
}

async function linkProfile(userId, account) {
  const patch = {
    organization_id: account.orgId,
    role: account.role,
    full_name: account.fullName,
    email: account.email,
    is_active: true,
  };
  if (account.role === 'student' || account.role === 'candidate') {
    patch.onboarding_path = 'learner';
  }
  const { error } = await admin.from('profiles').update(patch).eq('id', userId);
  if (error) throw error;
}

async function getSchoolClassAndSubject(orgId) {
  const [clsRes, subRes] = await Promise.all([
    admin.from('school_classes').select('id, name').eq('organization_id', orgId).order('name').limit(1),
    admin.from('school_subjects').select('id, name').eq('organization_id', orgId).order('name').limit(1),
  ]);
  return {
    classRow: clsRes.data?.[0] ?? null,
    subjectRow: subRes.data?.[0] ?? null,
  };
}

async function setupTeacher(userId, orgId, email, fullName) {
  const { classRow, subjectRow } = await getSchoolClassAndSubject(orgId);
  if (!classRow || !subjectRow) {
    console.warn('    ⚠ Pas de classe/matière — assignation enseignant ignorée');
    return;
  }

  const { data: existingPerson } = await admin
    .from('core_persons')
    .select('id')
    .eq('profile_id', userId)
    .eq('organization_id', orgId)
    .maybeSingle();

  let personId = existingPerson?.id;
  if (personId) {
    await admin
      .from('core_persons')
      .update({ kind: 'teacher', full_name: fullName, email })
      .eq('id', personId);
  } else {
    const { data: created, error } = await admin
      .from('core_persons')
      .insert({
        organization_id: orgId,
        profile_id: userId,
        kind: 'teacher',
        full_name: fullName,
        email,
      })
      .select('id')
      .single();
    if (error) throw error;
    personId = created.id;
  }

  const { data: existingTeacher } = await admin
    .from('school_teachers')
    .select('id')
    .eq('person_id', personId)
    .eq('organization_id', orgId)
    .maybeSingle();
  if (existingTeacher?.id) {
    await admin.from('school_teachers').update({ specialty: 'Informatique', is_active: true }).eq('id', existingTeacher.id);
  } else {
    await admin.from('school_teachers').insert({
      organization_id: orgId,
      person_id: personId,
      specialty: 'Informatique',
      is_active: true,
    });
  }

  await admin.from('school_teaching_assignments').upsert(
    {
      organization_id: orgId,
      profile_id: userId,
      class_id: classRow.id,
      subject_id: subjectRow.id,
    },
    { onConflict: 'profile_id,class_id,subject_id' }
  );
  console.log(`    ✓ enseignant → ${classRow.name} / ${subjectRow.name}`);
}

async function setupStudent(userId, orgId, email, fullName, enrolled) {
  const { classRow } = await getSchoolClassAndSubject(orgId);

  let personId;
  const { data: existingPerson } = await admin
    .from('core_persons')
    .select('id')
    .eq('profile_id', userId)
    .eq('organization_id', orgId)
    .maybeSingle();

  if (existingPerson?.id) {
    personId = existingPerson.id;
    await admin
      .from('core_persons')
      .update({ kind: enrolled ? 'student' : 'candidate', full_name: fullName, email })
      .eq('id', personId);
  } else {
    const { data: created, error } = await admin
      .from('core_persons')
      .insert({
        organization_id: orgId,
        profile_id: userId,
        kind: enrolled ? 'student' : 'candidate',
        full_name: fullName,
        email,
      })
      .select('id')
      .single();
    if (error) throw error;
    personId = created.id;
  }

  const studentPatch = {
    organization_id: orgId,
    person_id: personId,
    class_id: classRow?.id ?? null,
    enrollment_status: enrolled ? 'enrolled' : 'pending',
    matricule: enrolled ? 'DEMO-ELEVE-001' : null,
    enrollment_date: enrolled ? '2025-09-15' : null,
  };

  const { data: existingStudent } = await admin
    .from('school_students')
    .select('id')
    .eq('person_id', personId)
    .eq('organization_id', orgId)
    .maybeSingle();

  let studentId = existingStudent?.id;
  if (studentId) {
    await admin.from('school_students').update(studentPatch).eq('id', studentId);
  } else {
    const { data: st, error } = await admin.from('school_students').insert(studentPatch).select('id').single();
    if (error) throw error;
    studentId = st.id;
  }

  if (!enrolled && studentId) {
    const { data: pending } = await admin
      .from('school_enrollments')
      .select('id')
      .eq('student_id', studentId)
      .eq('status', 'pending')
      .maybeSingle();
    if (!pending?.id) {
      await admin.from('school_enrollments').insert({
        organization_id: orgId,
        student_id: studentId,
        status: 'pending',
        academic_year: '2025-2026',
        request_type: 'new',
      });
    }
  }
  console.log(`    ✓ ${enrolled ? 'élève inscrit' : 'candidat en attente'}`);
}

async function setupNgoStaff(userId, orgId) {
  const { data: project } = await admin
    .from('ngo_projects')
    .select('id, title')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!project?.id) {
    console.warn('    ⚠ Aucun projet ONG — assignation ignorée');
    return;
  }
  await admin
    .from('collaborator_assignments')
    .delete()
    .eq('organization_id', orgId)
    .eq('profile_id', userId)
    .eq('resource_type', 'ngo_project');
  await admin.from('collaborator_assignments').insert({
    organization_id: orgId,
    profile_id: userId,
    resource_type: 'ngo_project',
    resource_id: project.id,
    can_import: false,
    can_upload: true,
    can_edit: true,
    assigned_by: userId,
  });
  console.log(`    ✓ assigné projet: ${project.title}`);
}

async function setupBtpStaff(userId, orgId) {
  const { data: sites } = await admin
    .from('btp_sites')
    .select('id, name')
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .order('name');
  if (!sites?.length) {
    console.warn('    ⚠ Aucun chantier BTP actif');
    return;
  }
  const primary = sites.find((s) => s.name === 'Pont Kaloum') ?? sites[0];
  const secondary = sites.find((s) => s.id !== primary.id);
  const assignIds = [primary.id, ...(secondary ? [secondary.id] : [])];

  await admin
    .from('collaborator_assignments')
    .delete()
    .eq('organization_id', orgId)
    .eq('profile_id', userId)
    .eq('resource_type', 'btp_site');

  await admin.from('collaborator_assignments').insert(
    assignIds.map((siteId) => ({
      organization_id: orgId,
      profile_id: userId,
      resource_type: 'btp_site',
      resource_id: siteId,
      can_import: false,
      can_upload: true,
      can_edit: true,
      assigned_by: userId,
    }))
  );
  console.log(`    ✓ chantiers: ${sites.filter((s) => assignIds.includes(s.id)).map((s) => s.name).join(', ')}`);
}

async function postSetup(userId, account) {
  switch (account.key) {
    case 'teacher':
      await setupTeacher(userId, account.orgId, account.email, account.fullName);
      break;
    case 'student':
      await setupStudent(userId, account.orgId, account.email, account.fullName, true);
      break;
    case 'candidate':
      await setupStudent(userId, account.orgId, account.email, account.fullName, false);
      break;
    case 'ngo_staff':
      await setupNgoStaff(userId, account.orgId);
      break;
    case 'btp_staff':
      await setupBtpStaff(userId, account.orgId);
      break;
    default:
      break;
  }
}

function accountIntent(role) {
  if (role === 'platform_admin') return 'platform_admin';
  if (['org_admin', 'deputy_director'].includes(role)) return 'org_admin';
  if (['student', 'candidate'].includes(role)) return 'learner';
  return 'staff';
}

function orgTypeForSector(orgId) {
  if (orgId === DEMO_ORG_IDS.school) return 'school';
  if (orgId === DEMO_ORG_IDS.ngo) return 'ngo';
  if (orgId === DEMO_ORG_IDS.btp) return 'btp';
  if (orgId === DEMO_ORG_IDS.pme) return 'business';
  return null;
}

async function main() {
  console.log('🎭 Seed comptes démo — tous les rôles\n');
  const created = [];

  for (const account of DEMO_ROLE_ACCOUNTS) {
    console.log(`▶ ${account.key} — ${account.email}`);
    if (account.orgId) {
      const { data: org } = await admin
        .from('organizations')
        .select('id, name')
        .eq('id', account.orgId)
        .maybeSingle();
      if (!org) {
        console.warn(`  ⚠ Organisation ${account.orgId} absente — ignoré`);
        continue;
      }
      await ensureOrgActive(account.orgId, orgTypeForSector(account.orgId));
    }

    const userId = await ensureAuthUser(account.email, account.fullName, accountIntent(account.role));
    await linkProfile(userId, account);
    await postSetup(userId, account);
    created.push({
      ...account,
      password: DEMO_PASSWORD,
      userId,
    });
    console.log('  ✓ OK\n');
  }

  mkdirSync(dirname(outJson), { recursive: true });
  writeFileSync(
    outJson,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        password: DEMO_PASSWORD,
        loginUrl: 'https://www.konadatagn.com/login',
        accounts: created.map(({ userId, ...rest }) => rest),
      },
      null,
      2
    ),
    'utf8'
  );

  console.log('✅', created.length, 'comptes prêts →', outJson);
  console.log('\nMot de passe commun :', DEMO_PASSWORD);
  console.log('\n| Rôle | Email | Secteur |');
  console.log('|------|-------|---------|');
  for (const a of created) {
    console.log(`| ${a.role} | ${a.email} | ${a.sector} |`);
  }
}

main().catch((e) => {
  console.error('❌', e.message || e);
  process.exit(1);
});
