/**
 * Outils Playwright communs aux scripts d'exemples (connexion vitrine, navigation, téléchargements).
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { VITRINE_ACCOUNTS, VITRINE_PASSWORD } from '../tutorials/accounts.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const OUT = path.join(ROOT, 'docs', 'marketing', 'exemples');
export const BASE = process.env.SAMPLES_BASE_URL || 'http://localhost:3000';

export const log = (...a) => console.log(...a);

export async function login(browser, accountKey) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR', acceptDownloads: true });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 180000 });
  const acc = VITRINE_ACCOUNTS[accountKey];
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
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 120000 });
  if (page.url().includes('cgu=1')) {
    const btn = page.getByRole('button', { name: /accepte/i });
    if (await btn.count()) await btn.first().click();
  }
  page.on('dialog', (d) => d.accept().catch(() => {}));
  return { ctx, page };
}

export async function open(page, url) {
  await page.goto(`${BASE}${url}`, { waitUntil: 'load', timeout: 300000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1200);
}

/** Carte (Card) la plus interne contenant le bouton donné. */
export function card(page, buttonName) {
  return page
    .locator('div.rounded-xl.border')
    .filter({ has: page.getByRole('button', { name: buttonName }) })
    .last();
}

/** Carte la plus interne contenant le texte donné (titre de carte). */
export function cardByText(page, text) {
  return page.locator('div.rounded-xl.border').filter({ hasText: text }).last();
}

export async function pick(page, scope, comboIndex, optionName) {
  await scope.getByRole('combobox').nth(comboIndex).click();
  await page.getByRole('option', { name: optionName, exact: true }).click();
  await page.waitForTimeout(300);
}

export async function download(page, locator, target, timeout = 180000) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout }), locator.click()]);
  const ext = path.extname(dl.suggestedFilename()) || '.pdf';
  const file = `${target}${ext}`;
  await dl.saveAs(file);
  log(`   ✓ ${path.relative(ROOT, file)}`);
  return file;
}
