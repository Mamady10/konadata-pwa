/**
 * Création des organisations « vitrine » (tutoriels et vidéos) : organisation, abonnement actif,
 * CGU acceptées, utilisateurs + profils, logo. Ré-exécutable (identifiants fixes).
 */
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { loadEnvLocal } from '../../demo-env.mjs';
import { VITRINE_PASSWORD } from '../accounts.mjs';

loadEnvLocal();

export const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CGU_VERSION = '2026-06-01';

export function must({ data, error }, label) {
  if (error) throw new Error(`${label} : ${error.message}`);
  return data;
}

/** Générateur pseudo-aléatoire déterministe (mêmes données à chaque exécution). */
export function rng(seed = 42) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    round: (a, b, step = 1) => Math.round((a + next() * (b - a)) / step) * step,
  };
}

export const iso = (d) => d.toISOString().slice(0, 10);
export const addDays = (d, n) => {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
};
export const today = () => {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate(), 12));
};

async function findUserIdByEmail(email) {
  for (let page = 1; page <= 30; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit.id;
    if (data.users.length < 200) break;
  }
  return null;
}

/** Crée ou met à jour l'utilisateur puis rattache son profil à l'organisation. */
export async function ensureMember(orgId, { email, fullName, role, phone = null, intent = 'staff', onboarding = 'staff' }) {
  let id = await findUserIdByEmail(email);
  const meta = { full_name: fullName, account_intent: intent };
  if (id) {
    // Pas de changement de mot de passe : il révoquerait les sessions ouvertes (captures en cours).
    must(await admin.auth.admin.updateUserById(id, { email_confirm: true, user_metadata: meta }), `maj ${email}`);
  } else {
    const data = must(
      await admin.auth.admin.createUser({ email, password: VITRINE_PASSWORD, email_confirm: true, user_metadata: meta }),
      `création ${email}`
    );
    id = data.user.id;
  }
  for (let i = 0; i < 10; i++) {
    const { data } = await admin.from('profiles').select('id').eq('id', id).maybeSingle();
    if (data) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  must(
    await admin
      .from('profiles')
      .update({ organization_id: orgId, role, full_name: fullName, email, phone, is_active: true, onboarding_path: onboarding })
      .eq('id', id),
    `profil ${email}`
  );
  return id;
}

/** Organisation active (abonnement, CGU) — `type` : btp | school | ngo | business. */
export async function ensureOrg({ id, name, type, email, phone, address, planSector }) {
  const existing = must(await admin.from('organizations').select('id, settings').eq('id', id).maybeSingle(), 'lecture org');
  const row = { id, name, type, email, phone, address, is_active: true, billing_status: 'active' };
  if (existing) must(await admin.from('organizations').update(row).eq('id', id), 'maj org');
  else must(await admin.from('organizations').insert({ ...row, settings: {} }), 'création org');

  if (type !== 'school') {
    const plan = must(
      await admin
        .from('platform_billing_plans')
        .select('id')
        .eq('sector', planSector ?? type)
        .eq('is_active', true)
        .order('monthly_price_gnf')
        .limit(1)
        .maybeSingle(),
      'plan'
    );
    if (!plan) throw new Error(`Aucun plan de facturation actif pour ${planSector ?? type}`);
    const start = new Date();
    const end = new Date();
    end.setFullYear(end.getFullYear() + 2);
    must(
      await admin.from('organization_subscriptions').upsert(
        { organization_id: id, plan_id: plan.id, status: 'active', current_period_start: start.toISOString(), current_period_end: end.toISOString(), metadata: { vitrine: true } },
        { onConflict: 'organization_id' }
      ),
      'abonnement'
    );
  }
  return existing?.settings ?? {};
}

/** CGU/DPA acceptées par la direction + réglages divers (fusionnés). */
export async function finalizeOrgSettings(orgId, directorId, extra = {}) {
  const org = must(await admin.from('organizations').select('settings').eq('id', orgId).single(), 'settings');
  const now = new Date().toISOString();
  const settings = {
    ...(org.settings ?? {}),
    ...extra,
    vitrine: true,
    cgu_version: CGU_VERSION,
    cgu_accepted_at: now,
    cgu_accepted_by: directorId,
    dpa_version: CGU_VERSION,
    dpa_accepted_at: now,
    dpa_accepted_by: directorId,
    platform_billing_period: extra.platform_billing_period ?? 'monthly',
    platform_subscription_valid_until: '2028-12-31',
  };
  must(await admin.from('organizations').update({ settings }).eq('id', orgId), 'maj settings');
}

/** Logo SVG → PNG, déposé dans le stockage et mis en cache pour les exports PDF. */
export async function uploadLogo(orgId, svg) {
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const storagePath = `${orgId}/branding/logo.png`;
  must(await admin.storage.from('documents').upload(storagePath, png, { contentType: 'image/png', upsert: true }), 'upload logo');
  const org = must(await admin.from('organizations').select('settings').eq('id', orgId).single(), 'settings');
  const settings = org.settings ?? {};
  settings.school = {
    ...(settings.school ?? {}),
    branding: {
      ...(settings.school?.branding ?? {}),
      logo_storage_path: storagePath,
      logo_pdf_cache: { base64: png.toString('base64'), format: 'PNG' },
    },
  };
  must(await admin.from('organizations').update({ settings, logo_url: storagePath }).eq('id', orgId), 'logo settings');
  return storagePath;
}

/** Supprime les lignes de l'organisation dans les tables listées (enfants d'abord). */
export async function wipe(orgId, tables) {
  for (const t of tables) {
    const { error } = await admin.from(t).delete().eq('organization_id', orgId);
    if (error && !/does not exist|schema cache/i.test(error.message)) throw new Error(`purge ${t} : ${error.message}`);
  }
}

/** Insertion par paquets. */
export async function insertMany(table, rows, { select = 'id', chunk = 200 } = {}) {
  const out = [];
  for (let i = 0; i < rows.length; i += chunk) {
    const data = must(await admin.from(table).insert(rows.slice(i, i + chunk)).select(select), `insertion ${table}`);
    out.push(...data);
  }
  return out;
}

/** Dépose une image dans le stockage + ligne `documents` ; renvoie l'id du document. */
export async function uploadDocument(orgId, uploadedBy, { fileName, buffer, mimeType, category = 'other', extracted = {}, createdAt }) {
  const filePath = `${orgId}/${Date.now()}_${fileName}`;
  must(await admin.storage.from('documents').upload(filePath, buffer, { contentType: mimeType, upsert: true }), `upload ${fileName}`);
  const row = {
    organization_id: orgId,
    uploaded_by: uploadedBy,
    file_name: fileName,
    file_path: filePath,
    file_size: buffer.length,
    mime_type: mimeType,
    status: 'classified',
    category,
    ai_confidence: 98,
    extracted_data: { classified_by: 'user', original_name: fileName, ...extracted },
  };
  if (createdAt) row.created_at = createdAt;
  const data = must(await admin.from('documents').insert(row).select('id').single(), `document ${fileName}`);
  return data.id;
}
