import { test, expect, chromium } from '@playwright/test';
import { loginViaSupabase, SCHOOL_EMAIL } from './helpers/auth';

async function launchBrowser() {
  for (const channel of ['chrome', 'msedge', undefined] as const) {
    try {
      return await chromium.launch(channel ? { channel } : {});
    } catch {
      /* essai suivant */
    }
  }
  throw new Error(
    'Navigateur indisponible. Installez Chrome/Edge ou exécutez : npm run test:e2e:setup'
  );
}

test.describe('Établissement scolaire — smoke', () => {
  test('portail famille public charge', async ({ page }) => {
    await page.goto('/suivi-scolarite');
    await expect(page.getByText('Suivi scolarité')).toBeVisible();
    await expect(page.getByLabel(/matricule élève/i)).toBeVisible();
  });

  test('directeur démo — dashboard et pages clés', async ({ baseURL }) => {
    const browser = await launchBrowser();
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await loginViaSupabase(context, SCHOOL_EMAIL);
      await page.goto(`${baseURL}/etablissement`, { waitUntil: 'load' });
      await expect(page).toHaveURL(/\/etablissement/);

      await page.goto(`${baseURL}/etablissement/vie-scolaire`, { waitUntil: 'load' });
      await expect(page.getByText(/emploi du temps|vie scolaire/i).first()).toBeVisible();

      await page.goto(`${baseURL}/etablissement/rapports`, { waitUntil: 'load' });
      await expect(page.getByText(/export meps/i).first()).toBeVisible();
      await expect(page.getByRole('button', { name: /télécharger le csv/i })).toBeVisible();

      await page.goto(`${baseURL}/parametres/meps`, { waitUntil: 'load' });
      await expect(page.getByText(/export meps/i).first()).toBeVisible();
      await expect(page.getByLabel(/code établissement/i)).toBeVisible();
    } finally {
      await context.close();
      await browser.close();
    }
  });
});
