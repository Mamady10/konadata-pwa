/**
 * Captures écrans pour la vidéo démo KonaData (public + comptes démo par org).
 * Usage: npm run dev puis npm run capture:demo:all
 */
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PUBLIC_SCENES, DEMO_PASSWORD } from './demo-accounts.config.mjs';
import { loadEnvLocal, supabaseProjectRef } from './demo-env.mjs';

loadEnvLocal();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'docs', 'demo-video', 'captures');
const ACCOUNTS_JSON = path.join(__dirname, '..', 'docs', 'demo-video', 'demo-accounts.json');
const BASE = process.env.DEMO_BASE_URL || 'http://localhost:3000';

async function launchBrowser() {
  for (const channel of ['chrome', 'msedge', undefined]) {
    try {
      return await chromium.launch(channel ? { channel } : {});
    } catch {
      /* essai suivant */
    }
  }
  throw new Error(
    'Aucun navigateur Playwright disponible. Installez Chrome/Edge ou : npm run capture:demo:setup'
  );
}

async function shot(page, scene) {
  const target = `${BASE}${scene.url}`;
  await page.goto(target, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(scene.wait ?? 2000);
  if (scene.scroll) {
    const el = await page.$(scene.scroll);
    if (el) await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
  }
  const file = path.join(OUT, `${scene.id}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log('OK', scene.id, '→', file);
}

function createChunks(key, value) {
  const CHUNK_SIZE = 3180;
  if (value.length <= CHUNK_SIZE) return [{ name: key, value }];
  const chunks = [];
  let remaining = value;
  let i = 0;
  while (remaining.length > 0) {
    chunks.push({ name: `${key}.${i}`, value: remaining.slice(0, CHUNK_SIZE) });
    remaining = remaining.slice(CHUNK_SIZE);
    i += 1;
  }
  return chunks;
}

async function loginViaSupabase(context, email, password) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const ref = supabaseProjectRef(url);
  if (!url || !anonKey || !ref) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / ANON_KEY manquants dans .env.local');
  }

  const supabase = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Auth ${email}: ${error.message}`);
  if (!data.session) throw new Error(`Pas de session pour ${email}`);

  const storageKey = `sb-${ref}-auth-token`;
  const payload = JSON.stringify({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    expires_in: data.session.expires_in,
    token_type: data.session.token_type,
    user: data.session.user,
  });

  const baseUrl = new URL(BASE);
  const cookies = createChunks(storageKey, payload).map((c) => ({
    name: c.name,
    value: c.value,
    domain: baseUrl.hostname,
    path: '/',
    httpOnly: false,
    secure: baseUrl.protocol === 'https:',
    sameSite: 'Lax',
  }));

  await context.addCookies(cookies);
}

async function loadDemoAccounts() {
  if (!existsSync(ACCOUNTS_JSON)) {
    console.warn('⚠ demo-accounts.json absent — lancez : npm run seed:demo');
    return [];
  }
  const raw = await readFile(ACCOUNTS_JSON, 'utf8');
  const parsed = JSON.parse(raw);
  return parsed.accounts ?? [];
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await launchBrowser();

  const publicPage = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  console.log('\n📸 Pages publiques');
  for (const scene of PUBLIC_SCENES) {
    try {
      await shot(publicPage, scene);
    } catch (err) {
      console.error('FAIL', scene.id, err.message);
    }
  }
  await publicPage.close();

  const accounts = await loadDemoAccounts();
  for (const account of accounts) {
    console.log(`\n📸 ${account.key} (${account.email})`);
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();
    try {
      await loginViaSupabase(context, account.email, account.password ?? DEMO_PASSWORD);
      await page.goto(`${BASE}/dashboard`, { waitUntil: 'load', timeout: 60000 });
      await page.waitForTimeout(2000);
      for (const scene of account.captures ?? []) {
        try {
          await shot(page, scene);
        } catch (err) {
          console.error('FAIL', scene.id, err.message);
        }
      }
    } catch (err) {
      console.error('FAIL login', account.key, err.message);
    }
    await context.close();
  }

  await browser.close();
  console.log('\n✅ Captures dans:', OUT);
}

main();
