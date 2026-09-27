#!/usr/bin/env node
/**
 * Captures HD de la plateforme pour la campagne (ordinateur @2x + mobile @3x).
 * Comptes démo de production (scripts/seed-demo-all-roles.mjs).
 *
 * Usage : node scripts/marketing/capture-marketing-screens.mjs
 * Variables : MARKETING_BASE_URL (défaut https://www.konadatagn.com),
 *             MARKETING_DEVICES=desktop,mobile (défaut : les deux)
 */
import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dir, '..', '..');
const OUT = path.join(ROOT, 'docs', 'marketing', 'campagne', 'captures');
const BASE = process.env.MARKETING_BASE_URL || 'https://www.konadatagn.com';
const PASSWORD = process.env.DEMO_PASSWORD || 'DemoKona2026!';

const ACCOUNTS = [
  {
    key: 'btp',
    email: 'demo.btp@konadata.demo',
    pages: [
      { id: 'btp-dashboard', url: '/btp' },
      { id: 'btp-rapports', url: '/btp/rapports' },
    ],
  },
  {
    key: 'ecole',
    email: 'demo.ecole@konadata.demo',
    pages: [{ id: 'ecole-dashboard', url: '/etablissement' }],
  },
  {
    key: 'ong',
    email: 'demo.ong@konadata.demo',
    acceptCgu: true,
    pages: [
      { id: 'ong-dashboard', url: '/ong' },
      { id: 'ong-cartographie', url: '/ong/cartographie' },
      { id: 'ong-sondages', url: '/ong/sondages' },
    ],
  },
  {
    key: 'pme',
    email: 'demo.pme@konadata.demo',
    pages: [
      { id: 'pme-dashboard', url: '/pme' },
      { id: 'pme-ventes', url: '/pme/ventes' },
    ],
  },
];

const ALL_DEVICES = [
  { suffix: 'desktop', options: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 } },
  {
    suffix: 'mobile',
    options: {
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    },
  },
];

const ONLY = process.env.MARKETING_DEVICES?.split(',').map((s) => s.trim());
const DEVICES = ONLY ? ALL_DEVICES.filter((d) => ONLY.includes(d.suffix)) : ALL_DEVICES;

async function launchBrowser() {
  for (const channel of ['chrome', 'msedge', undefined]) {
    try {
      return await chromium.launch(channel ? { channel } : {});
    } catch {
      /* navigateur suivant */
    }
  }
  throw new Error('Aucun navigateur Playwright disponible.');
}

async function cleanUi(page) {
  await page.evaluate(() => {
    for (const el of Array.from(document.querySelectorAll('div, span, p'))) {
      if (el.children.length <= 1 && el.textContent?.trim() === 'Supabase connecté') {
        el.style.display = 'none';
      }
    }
  });
}

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 60000 });
  const emailInput = page.locator('#email');
  if ((await emailInput.count()) && (await emailInput.isVisible())) {
    await emailInput.fill(email);
    await page.locator('#password').fill(PASSWORD);
    await page.locator('#password').press('Enter');
  } else {
    await page.locator('#login-phone').fill(email);
    await page.locator('#login-phone-password').fill(PASSWORD);
    await page.locator('#login-phone-password').press('Enter');
  }
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
}

async function acceptCguIfNeeded(page) {
  if (!page.url().includes('cgu=1')) return;
  const btn = page.getByRole('button', { name: /accepte les CGU/i });
  if (await btn.count()) {
    await btn.first().click();
    await page.waitForTimeout(3000);
  }
}

async function shot(page, url, file) {
  await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await cleanUi(page);
  await page.screenshot({ path: file, type: 'png' });
  console.log('  ✓', path.basename(file));
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await launchBrowser();

  for (const device of DEVICES) {
    const ctx = await browser.newContext(device.options);
    const page = await ctx.newPage();
    console.log(`\n📸 Accueil public (${device.suffix})`);
    await shot(page, '/', path.join(OUT, `landing-${device.suffix}.png`));
    await ctx.close();
  }

  for (const account of ACCOUNTS) {
    for (const device of DEVICES) {
      console.log(`\n📸 ${account.key} (${device.suffix})`);
      const ctx = await browser.newContext(device.options);
      const page = await ctx.newPage();
      try {
        await login(page, account.email);
        if (account.acceptCgu) await acceptCguIfNeeded(page);
        for (const p of account.pages) {
          await shot(page, p.url, path.join(OUT, `${p.id}-${device.suffix}.png`));
        }
      } catch (e) {
        console.error('  ✗', account.key, e.message);
      }
      await ctx.close();
    }
  }

  await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]);
  console.log('\n✅ Captures :', OUT);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
