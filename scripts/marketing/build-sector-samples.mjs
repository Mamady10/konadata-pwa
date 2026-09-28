/**
 * Exemples de documents à montrer aux prospects des secteurs école, ONG et PME,
 * générés dans l'application avec les organisations vitrine.
 *
 *   node scripts/marketing/build-sector-samples.mjs [--only=ecole,ong,pme|bulletins]
 *
 * Variables : SAMPLES_BASE_URL (défaut http://localhost:3000).
 * Prérequis : seeds vitrine école, ONG et PME.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { admin } from '../tutorials/seed/vitrine-common.mjs';
import { BASE, OUT, ROOT, card, cardByText, download, log, login, open, pick } from './sample-kit.mjs';

const ECOLE_ORG = 'b7a1e0c2-3d4f-4a5b-8c6d-0000000ec001';
const ONG_ORG = 'b7a1e0c2-3d4f-4a5b-8c6d-0000000a0001';
const YEAR = '2026-2027';

const ONLY = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1]?.split(',');
const want = (k) => !ONLY || ONLY.includes(k);

/** Clique un bouton de période puis attend la fin du chargement (les boutons sont désactivés pendant la génération). */
async function runPeriod(page, scope, label) {
  const btn = scope.getByRole('button', { name: label, exact: true });
  await btn.click();
  await page.waitForTimeout(500);
  for (let i = 0; i < 600 && !(await btn.isEnabled()); i++) await page.waitForTimeout(500);
  await scope.getByRole('button', { name: 'Télécharger PDF' }).waitFor({ timeout: 120000 });
  await page.waitForTimeout(1200);
}

// ─── École ────────────────────────────────────────────────────────────────────

async function bulletin(page, dir, className, semester, file) {
  const cls = (await admin.from('school_classes').select('id').eq('organization_id', ECOLE_ORG).eq('name', className).single()).data;
  const best = (
    await admin
      .from('school_report_cards')
      .select('id, student_id')
      .eq('class_id', cls.id)
      .eq('semester', semester)
      .eq('academic_year', YEAR)
      .order('rank', { ascending: true })
      .limit(1)
      .single()
  ).data;
  const { matricule } = (await admin.from('school_students').select('matricule').eq('id', best.student_id).single()).data;
  log(` • ${file} (${className}, ${matricule})`);
  await open(page, `/etablissement/bulletins?classId=${cls.id}&semester=${semester}&year=${YEAR}`);
  const row = page.locator('tr', { hasText: matricule }).first();
  // Bulletin définitif le temps du téléchargement (sans filigrane « provisoire »), puis retour en brouillon.
  await admin.from('school_report_cards').update({ publication_status: 'final' }).eq('id', best.id);
  try {
    await download(page, row.getByRole('button', { name: 'PDF' }), path.join(dir, file));
  } finally {
    await admin.from('school_report_cards').update({ publication_status: 'draft' }).eq('id', best.id);
  }
}

async function ecole(browser) {
  const dir = path.join(OUT, 'ecole');
  await mkdir(dir, { recursive: true });
  const { ctx, page } = await login(browser, 'ecole');
  try {
    await bulletin(page, dir, 'Terminale SM', 'S1', '01-bulletin-lycee');
    await bulletin(page, dir, 'CM2 A', 'T1', '02-bulletin-primaire');
    if (ONLY?.includes('bulletins')) return;

    for (const [label, file] of [
      ['Mois', '03-rapport-direction-mensuel'],
      ['Année scolaire', '04-rapport-direction-annuel'],
    ]) {
      log(` • ${file}`);
      await open(page, '/etablissement/rapports');
      const report = cardByText(page, 'Rapport de direction — présentable');
      await runPeriod(page, report, label);
      await download(page, report.getByRole('button', { name: 'Télécharger PDF' }), path.join(dir, file));
    }

    log(' • 05-recu-paiement');
    const pay = (
      await admin
        .from('school_payments')
        .select('payment_token, receipt_number')
        .eq('organization_id', ECOLE_ORG)
        .eq('status', 'paid')
        .neq('payment_kind', 'reenrollment')
        .not('receipt_number', 'is', null)
        .order('amount', { ascending: false })
        .limit(1)
        .single()
    ).data;
    const res = await page.request.get(`${BASE}/api/school-payment/receipt/${pay.payment_token}`);
    if (!res.ok()) throw new Error(`Reçu ${pay.receipt_number} : HTTP ${res.status()}`);
    await writeFile(path.join(dir, '05-recu-paiement.pdf'), await res.body());
    log(`   ✓ ${path.relative(ROOT, path.join(dir, '05-recu-paiement.pdf'))} (${pay.receipt_number})`);

    log(' • 06/07 exports Excel');
    await open(page, '/etablissement/paiements');
    await download(page, page.getByRole('button', { name: 'Export encaissements Excel' }), path.join(dir, '06-encaissements'));
    await download(page, page.getByRole('button', { name: 'Export impayés Excel' }), path.join(dir, '07-impayes-relances'));
  } finally {
    await ctx.close();
  }
}

// ─── ONG ──────────────────────────────────────────────────────────────────────

const ONG_AI = [
  { file: '03-rapport-general-projets', scope: 'Tous — projet', type: 'Rapport général projet' },
  { file: '04-execution-budgetaire', scope: 'Tous — projet', type: 'Budget & exécution' },
  { file: '05-beneficiaires-kindia', scope: 'Santé maternelle et infantile — Kindia', type: 'Bénéficiaires (zone projet)' },
];

const ONG_SURVEYS = [
  { file: '01-rapport-sondage-cpn-kindia', id: 'b7a1e0c2-3d4f-4a5b-8c6d-0000000a4001' },
  { file: '02-rapport-sondage-satisfaction', id: 'b7a1e0c2-3d4f-4a5b-8c6d-0000000a4003' },
];

async function ong(browser) {
  const dir = path.join(OUT, 'ong');
  await mkdir(dir, { recursive: true });
  const { ctx, page } = await login(browser, 'ong');
  try {
    for (const s of ONG_SURVEYS) {
      log(` • ${s.file}`);
      await open(page, `/ong/sondages/${s.id}/analytiques`);
      await page.getByRole('tab', { name: 'KonaAI' }).click();
      const auto = cardByText(page, 'Rapport automatique');
      await auto.getByRole('button', { name: 'Générer le rapport KonaAI' }).click();
      const pdf = auto.getByRole('button', { name: 'Télécharger PDF' });
      await pdf.waitFor({ timeout: 300000 });
      await download(page, pdf, path.join(dir, s.file));
    }

    for (const t of ONG_AI) {
      log(` • ${t.file}`);
      await open(page, '/ong/rapports');
      const panel = card(page, 'Générer et archiver');
      await pick(page, panel, 0, t.scope);
      await pick(page, panel, 1, t.type);
      await panel.getByRole('button', { name: 'Générer et archiver' }).click();
      const pdf = panel.getByRole('button', { name: 'Télécharger PDF' });
      await pdf.waitFor({ timeout: 300000 });
      await download(page, pdf, path.join(dir, t.file));
    }

    log(' • 06-tableau-de-bord-ong');
    await open(page, '/ong/rapports');
    await download(page, page.getByRole('button', { name: 'Tout exporter en PDF' }), path.join(dir, '06-tableau-de-bord-ong'));
  } finally {
    await ctx.close();
  }
}

// ─── PME ──────────────────────────────────────────────────────────────────────

async function pme(browser) {
  const dir = path.join(OUT, 'pme');
  await mkdir(dir, { recursive: true });
  const { ctx, page } = await login(browser, 'pme');
  try {
    const runs = [
      { label: 'Mois', file: '01-analyse-financiere-mensuelle' },
      { label: 'Trimestre', file: '02-analyse-financiere-trimestrielle' },
      { label: 'Année', file: '03-analyse-financiere-annuelle' },
      { label: 'Mois', file: '04-analyse-boutique-madina', boutique: 'Boutique Madina — Détail' },
    ];
    for (const r of runs) {
      log(` • ${r.file}`);
      await open(page, '/pme/rapports');
      const report = cardByText(page, 'Analyse financière — présentable');
      if (r.boutique) await report.locator('#pme-boutique').selectOption({ label: r.boutique });
      await runPeriod(page, report, r.label);
      await download(page, report.getByRole('button', { name: 'Télécharger PDF' }), path.join(dir, r.file));
    }

    log(' • 05-indicateurs-synthese');
    await open(page, '/pme/rapports');
    await download(page, page.getByRole('button', { name: 'Tout exporter en PDF' }), path.join(dir, '05-indicateurs-synthese'));
  } finally {
    await ctx.close();
  }
}

async function main() {
  const browser = await chromium.launch();
  try {
    if (want('ecole') || want('bulletins')) await ecole(browser);
    if (want('ong')) await ong(browser);
    if (want('pme')) await pme(browser);
  } finally {
    await browser.close();
  }
  log('\n✅ Exemples générés dans', path.relative(ROOT, OUT));
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
