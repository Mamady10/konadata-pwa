/**
 * Exemples de rapports et de devis à montrer aux prospects, générés dans l'application
 * avec l'organisation vitrine « Bâtir Guinée SARL ».
 *
 *   node scripts/marketing/build-sample-reports.mjs [--only=periodique,ia,cloture,devis]
 *
 * Variables : SAMPLES_BASE_URL (défaut http://localhost:3000).
 * Prérequis : seeds vitrine BTP + scripts/tutorials/seed/seed-vitrine-devis.mjs.
 */
import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { admin } from '../tutorials/seed/vitrine-common.mjs';
import { VITRINE_ACCOUNTS, VITRINE_PASSWORD } from '../tutorials/accounts.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(ROOT, 'docs', 'marketing', 'exemples');
const BASE = process.env.SAMPLES_BASE_URL || 'http://localhost:3000';
const ORG_ID = 'b7a1e0c2-3d4f-4a5b-8c6d-0000000b7001';
const KIPE = 'Immeuble R+4 Kipé';
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1]?.split(',');
const want = (k) => !ONLY || ONLY.includes(k);

const PERIODIC = [
  {
    file: '01-rapport-hebdomadaire',
    period: 'Semaine',
    pptx: true,
    comment:
      'Dalle haute R+2 coulée et décoffrée. Semaine prochaine : ferraillage des poteaux et poutres R+3. ' +
      'Besoin : 120 barres HA12 et 300 sacs de ciment. Aucun incident de sécurité.',
  },
  {
    file: '02-rapport-mensuel',
    period: 'Mois',
    pptx: true,
    comment:
      'Septembre : structure du R+2 achevée, maçonnerie du R+1 à 80 %. Avancement conforme au planning ' +
      'de référence. Point de vigilance : délais de livraison du fer HA12 (3 jours de retard en moyenne).',
  },
  {
    file: '03-rapport-trimestriel',
    period: 'Trimestre',
    comment:
      'Troisième trimestre : fondations, RDC et deux niveaux de dalle réalisés. Consommation de carburant ' +
      'maîtrisée. Objectif T4 : clos-couvert du bâtiment et démarrage des enduits.',
  },
  {
    file: '04-rapport-annuel',
    period: 'Année',
    comment:
      'Bilan 2026 : gros œuvre avancé conformément au marché, aucun accident avec arrêt. ' +
      'Priorités 2027 : second œuvre, réception partielle des niveaux bas.',
  },
  {
    file: '05-rapport-hebdomadaire-sans-montants',
    period: 'Semaine',
    noFinancials: true,
    comment:
      'Version destinée au maître d’ouvrage : avancement, planning, livraisons et photos, sans aucun montant.',
  },
];

const AI_TYPES = [
  { file: '07-synthese-ia-generale', label: 'Rapport général chantier' },
  { file: '08-synthese-ia-carburant', label: 'Carburant' },
  { file: '09-synthese-ia-bons-livraison', label: 'Bons de livraison' },
  { file: '10-synthese-ia-avancement', label: 'Avancement terrain' },
  { file: '11-synthese-ia-stocks', label: 'Stocks (entrepôt)' },
];

const log = (...a) => console.log(...a);

async function login(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR', acceptDownloads: true });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 180000 });
  const acc = VITRINE_ACCOUNTS.btp;
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

async function open(page, url) {
  await page.goto(`${BASE}${url}`, { waitUntil: 'load', timeout: 300000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1200);
}

/** Carte (Card) la plus interne contenant le bouton donné. */
function card(page, buttonName) {
  return page
    .locator('div.rounded-xl.border')
    .filter({ has: page.getByRole('button', { name: buttonName }) })
    .last();
}

async function pick(page, scope, comboIndex, optionName) {
  await scope.getByRole('combobox').nth(comboIndex).click();
  await page.getByRole('option', { name: optionName, exact: true }).click();
  await page.waitForTimeout(300);
}

async function download(page, locator, target, timeout = 180000) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout }), locator.click()]);
  const ext = path.extname(dl.suggestedFilename()) || '.pdf';
  const file = `${target}${ext}`;
  await dl.saveAs(file);
  log(`   ✓ ${path.relative(ROOT, file)}`);
  return file;
}

/** Semaine ISO (2026-W39) de la dernière fiche journalière du chantier vitrine. */
async function lastReportedWeek() {
  const site = (await admin.from('btp_sites').select('id').eq('organization_id', ORG_ID).eq('name', KIPE).single()).data;
  const last = (
    await admin.from('btp_daily_progress').select('progress_date').eq('site_id', site.id).order('progress_date', { ascending: false }).limit(1).single()
  ).data;
  const d = new Date(`${last.progress_date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const week1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

async function periodicReports(page, dir) {
  const week = await lastReportedWeek();
  for (const r of PERIODIC) {
    log(` • ${r.file}${r.period === 'Semaine' ? ` (${week})` : ''}`);
    await open(page, '/btp/rapports');
    const panel = card(page, 'Compiler le rapport');
    await pick(page, panel, 0, KIPE);
    if (r.period !== 'Semaine') await pick(page, panel, 1, r.period);
    else await panel.locator('input[type=week]').fill(week);
    const fin = panel.getByRole('checkbox', { name: /Afficher les données financières/ });
    if (r.noFinancials && (await fin.isChecked())) await fin.click();
    await panel.getByPlaceholder('Risques semaine prochaine, demandes MOA, décisions…').fill(r.comment);
    await panel.getByRole('button', { name: 'Compiler le rapport' }).click();
    await page.getByRole('button', { name: 'Télécharger PDF' }).first().waitFor({ timeout: 300000 });
    await page.waitForTimeout(1500);
    await download(page, page.getByRole('button', { name: 'Télécharger PDF' }).first(), path.join(dir, r.file));
    if (r.pptx) await download(page, page.getByRole('button', { name: 'Télécharger PPTX' }).first(), path.join(dir, r.file), 300000);
  }
}

async function aiReports(page, dir) {
  for (const t of AI_TYPES) {
    log(` • ${t.file}`);
    await open(page, '/btp/rapports');
    const panel = card(page, 'Générer et archiver');
    await pick(page, panel, 0, KIPE);
    await pick(page, panel, 1, t.label);
    await panel.getByRole('button', { name: 'Générer et archiver' }).click();
    const pdf = panel.getByRole('button', { name: 'Télécharger PDF' });
    await pdf.waitFor({ timeout: 300000 });
    await download(page, pdf, path.join(dir, t.file));
  }
}

async function closureDossier(page, dir) {
  log(' • 06-dossier-cloture-chantier');
  const site = (
    await admin.from('btp_sites').select('id, status').eq('organization_id', ORG_ID).ilike('name', 'École primaire de Kindia%').single()
  ).data;
  if (!site) throw new Error('Chantier « École primaire de Kindia » introuvable');
  await open(page, `/btp/chantiers/${site.id}`);
  await page.getByRole('tab', { name: 'Clôture MOA' }).click();
  if (site.status === 'completed') {
    await page.getByRole('button', { name: 'Rouvrir le chantier' }).click();
    await page.getByRole('button', { name: 'Clôturer le chantier' }).waitFor({ timeout: 120000 });
  }
  await page
    .getByPlaceholder('Réserves MOA, observations finales, date de réception…')
    .fill(
      'Réception provisoire prononcée avec le maître d’ouvrage (Direction préfectorale de l’éducation de Kindia). ' +
        'Réserves mineures : reprise de peinture sur deux salles, réglage de trois fenêtres, à lever sous 30 jours.'
    );
  await page.getByRole('button', { name: 'Clôturer le chantier' }).click();
  const result = page.locator('div.space-y-2', { has: page.locator('pre', { hasText: 'DOSSIER DE CLÔTURE' }) });
  const pdf = result.getByRole('button', { name: 'Télécharger PDF' });
  await pdf.waitFor({ timeout: 300000 });
  await download(page, pdf, path.join(dir, '06-dossier-cloture-chantier'));
}

async function quote(page, dir) {
  log(' • devis DEV-2026-0003');
  const q = (await admin.from('btp_quotes').select('id').eq('organization_id', ORG_ID).eq('number', 'DEV-2026-0003').single()).data;
  if (!q) throw new Error('Devis DEV-2026-0003 absent : lancer seed-vitrine-devis.mjs');
  await open(page, `/btp/devis/${q.id}`);
  await download(page, page.getByRole('button', { name: 'PDF', exact: true }), path.join(dir, 'devis-DEV-2026-0003'));
  await download(page, page.getByRole('button', { name: 'Excel', exact: true }), path.join(dir, 'devis-DEV-2026-0003'));
}

async function main() {
  const reports = path.join(OUT, 'btp-rapports');
  const quotes = path.join(OUT, 'btp-devis');
  await mkdir(reports, { recursive: true });
  await mkdir(quotes, { recursive: true });
  const browser = await chromium.launch();
  try {
    const { page } = await login(browser);
    if (want('periodique')) await periodicReports(page, reports);
    if (want('cloture')) await closureDossier(page, reports);
    if (want('ia')) await aiReports(page, reports);
    if (want('devis')) await quote(page, quotes);
  } finally {
    await browser.close();
  }
  log('\n✅ Exemples générés dans', path.relative(ROOT, OUT));
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
