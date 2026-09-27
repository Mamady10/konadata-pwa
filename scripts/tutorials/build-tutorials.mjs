#!/usr/bin/env node
/**
 * Tutoriels vidéo courts KonaData : capture dans la vraie application (organisations vitrine)
 * puis rendu avec curseur, zooms, voix off et sous-titres.
 *
 * Sorties : docs/formation/tutoriels/<secteur>/<id>.mp4 (+ .srt)
 *
 * Usage :
 *   node scripts/tutorials/build-tutorials.mjs                    # tout
 *   node scripts/tutorials/build-tutorials.mjs --only=btp-devis-creer,btp-devis-metre
 *   node scripts/tutorials/build-tutorials.mjs --sector=btp
 *   node scripts/tutorials/build-tutorials.mjs --capture-only | --render-only | --list
 * Variables : TUTORIAL_BASE_URL (défaut https://www.konadatagn.com)
 */
import { mkdir, readFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { ROOT, launchBrowser, prepareBrandAssets } from '../marketing/campaign-html.mjs';
import { loadEnvLocal } from '../demo-env.mjs';
import { captureTutorial, DEVICES } from './engine/capture.mjs';
import { renderTutorial } from './engine/render.mjs';
import { VITRINE_ACCOUNTS, VITRINE_PASSWORD } from './accounts.mjs';
import { TUTORIALS } from './tutorials/index.mjs';

loadEnvLocal();

const BASE = process.env.TUTORIAL_BASE_URL || 'https://www.konadatagn.com';
const OUT = path.join(ROOT, 'docs', 'formation', 'tutoriels');
const WORK = path.join(OUT, '.work');
const AUTH = path.join(WORK, 'auth');

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const flag = (name) => process.argv.includes(`--${name}`);
const ONLY = arg('only')?.split(',');
const SECTOR = arg('sector');

async function makeLogin(browser) {
  return async function login(accountKey, device, force = false) {
    const acc = VITRINE_ACCOUNTS[accountKey];
    if (!acc) throw new Error(`Compte vitrine inconnu : ${accountKey}`);
    const file = path.join(AUTH, `${accountKey}-${device}.json`);
    if (!force && existsSync(file) && Date.now() - (await stat(file)).mtimeMs < 6 * 3600 * 1000) return file;
    await mkdir(AUTH, { recursive: true });
    for (let attempt = 1; ; attempt++) {
      try {
        return await doLogin(acc, device, file);
      } catch (e) {
        if (attempt >= 3) throw e;
        console.warn(`  ⚠ connexion ${accountKey} impossible (${attempt}/3), nouvelle tentative dans 60 s`);
        await new Promise((r) => setTimeout(r, 60000));
      }
    }
  };

  async function doLogin(acc, device, file) {
    const ctx = await browser.newContext({ ...DEVICES[device], locale: 'fr-FR' });
    try {
      return await fillLogin(ctx, acc, file);
    } finally {
      await ctx.close().catch(() => {});
    }
  }

  async function fillLogin(ctx, acc, file) {
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 60000 });
    const email = page.locator('#email');
    if ((await email.count()) && (await email.isVisible())) {
      await email.fill(acc.email);
      await page.locator('#password').fill(VITRINE_PASSWORD);
      await page.locator('#password').press('Enter');
    } else {
      await page.locator('#login-phone').fill(acc.email);
      await page.locator('#login-phone-password').fill(VITRINE_PASSWORD);
      await page.locator('#login-phone-password').press('Enter');
    }
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 45000 });
    await page.waitForLoadState('networkidle').catch(() => {});
    if (page.url().includes('cgu=1')) {
      const btn = page.getByRole('button', { name: /accepte/i });
      if (await btn.count()) {
        await btn.first().click();
        await page.waitForTimeout(2500);
      }
    }
    await ctx.storageState({ path: file });
    return file;
  }
}

function services() {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const cache = {};
  return {
    admin,
    async orgId(accountKey) {
      if (cache[accountKey]) return cache[accountKey];
      const { data, error } = await admin
        .from('profiles')
        .select('organization_id')
        .eq('email', VITRINE_ACCOUNTS[accountKey].email)
        .maybeSingle();
      if (error || !data?.organization_id) throw new Error(`Organisation introuvable pour ${accountKey}`);
      cache[accountKey] = data.organization_id;
      return data.organization_id;
    },
  };
}

async function main() {
  const list = TUTORIALS.filter((t) => (!ONLY || ONLY.includes(t.id)) && (!SECTOR || t.sector === SECTOR));
  if (flag('list')) {
    for (const t of TUTORIALS) console.log(`${t.id.padEnd(34)} ${t.device || 'desktop'}  ${t.title}`);
    return;
  }
  if (!list.length) throw new Error('Aucun tutoriel ne correspond au filtre.');
  await prepareBrandAssets();
  const browser = await launchBrowser();
  const login = await makeLogin(browser);
  const svc = services();
  let failed = 0;

  for (const tut of list) {
    console.log(`\n🎓 ${tut.id} — ${tut.title}`);
    const dir = path.join(WORK, tut.id);
    try {
      let manifest;
      if (!flag('render-only')) {
        manifest = await captureTutorial(browser, tut, { work: WORK, baseUrl: BASE, login, services: svc });
        console.log(`  ✓ capture (${manifest.steps.length} étapes)`);
      } else {
        manifest = JSON.parse(await readFile(path.join(dir, 'manifest.json'), 'utf8'));
      }
      manifest.role = tut.role;
      if (!flag('capture-only')) {
        const outDir = path.join(OUT, tut.sector === 'brand' ? 'commun' : tut.sector);
        await mkdir(outDir, { recursive: true });
        await renderTutorial(browser, manifest, dir, path.join(outDir, `${tut.id}.mp4`));
      }
    } catch (e) {
      failed += 1;
      console.error('  ❌', e.message);
    }
  }

  await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]);
  if (failed) throw new Error(`${failed} tutoriel(s) en échec`);
  console.log('\n✅ Tutoriels :', OUT);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error('❌', e.message);
    process.exit(1);
  }
);
