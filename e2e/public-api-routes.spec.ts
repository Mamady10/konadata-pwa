import { test, expect } from '@playwright/test';

/**
 * Garde-fou démo : les API d’inscription / OTP ne doivent jamais rediriger vers /login.
 */
test.describe('Routes API publiques — sans session', () => {
  test('POST /api/auth/register renvoie du JSON (pas redirect login)', async ({ request }) => {
    const res = await request.post('/api/auth/register', {
      data: {
        method: 'phone',
        phone: '000',
        password: 'testtest123',
        fullName: 'Test Smoke',
        accountIntent: 'learner',
      },
      maxRedirects: 0,
    });

    expect(res.status()).not.toBe(307);
    expect(res.status()).not.toBe(302);
    expect(res.headers()['content-type'] ?? '').toContain('application/json');

    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('POST /api/auth/phone/request-otp renvoie du JSON', async ({ request }) => {
    const res = await request.post('/api/auth/phone/request-otp', {
      data: { phone: '000', purpose: 'recovery' },
      maxRedirects: 0,
    });

    expect(res.status()).not.toBe(307);
    expect(res.headers()['content-type'] ?? '').toContain('application/json');
  });

  test('page inscription candidat — bouton ne reste pas bloqué sur erreur', async ({ page }) => {
    await page.goto('/register/candidat');
    await page.getByLabel(/nom complet/i).fill('Test Démo');
    await page.getByLabel(/téléphone/i).fill('000');
    await page.getByLabel(/mot de passe/i).fill('testtest123');

    await page.route('**/api/auth/register', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Numéro invalide (test)' }),
      });
    });

    await page.getByRole('button', { name: /créer mon compte candidat/i }).click();
    await expect(page.getByText('Numéro invalide (test)')).toBeVisible();
    await expect(page.getByRole('button', { name: /créer mon compte candidat/i })).toBeEnabled();
  });
});
