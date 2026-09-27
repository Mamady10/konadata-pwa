/**
 * Capture d'un tutoriel : exécute les étapes dans la vraie application (Playwright),
 * enregistre les captures avant / après chaque action et la position des éléments ciblés.
 * Résultat : <work>/<id>/manifest.json + shots/*.jpg
 */
import { mkdir, writeFile, rm } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import sharp from 'sharp';
import { renderPdfPages } from './pdf-pages.mjs';

export const DEVICES = {
  desktop: { viewport: { width: 1536, height: 864 }, deviceScaleFactor: 2 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
};

const esc = (s) => s.replace(/"/g, '\\"');

/** Cible → locator Playwright. */
export function resolve(page, t) {
  if (!t) return null;
  if (typeof t === 'string') return page.locator(t).first();
  const nth = t.nth ?? 0;
  let l;
  if (t.role) l = page.getByRole(t.role, { name: t.name, exact: t.exact ?? false });
  else if (t.field)
    l = page.locator(
      `xpath=//label[contains(normalize-space(.), "${esc(t.field)}")]/following::*[self::input or self::textarea or self::select][1]`
    );
  else if (t.label) l = page.getByLabel(t.label, { exact: t.exact ?? false });
  else if (t.placeholder) l = page.getByPlaceholder(t.placeholder, { exact: t.exact ?? false });
  else if (t.text) l = page.getByText(t.text, { exact: t.exact ?? false });
  else if (t.css) l = page.locator(t.css);
  else throw new Error(`Cible inconnue : ${JSON.stringify(t)}`);
  if (t.within) l = resolve(page, t.within).locator(l);
  l = nth === 'last' ? l.last() : l.nth(nth);
  if (t.up === 'card')
    l = l.locator(
      'xpath=ancestor::*[contains(@class,"border") and (contains(@class,"rounded-xl") or contains(@class,"rounded-lg"))][1]'
    );
  else if (t.up) l = l.locator(`xpath=ancestor::*[${t.up}]`);
  return l;
}

async function settle(page, ms = 700) {
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function box(locator, pad = 0) {
  const b = await locator.boundingBox();
  if (!b) return null;
  return { x: b.x - pad, y: b.y - pad, w: b.width + pad * 2, h: b.height + pad * 2 };
}

async function cleanUi(page) {
  await page
    .evaluate(() => {
      for (const el of Array.from(document.querySelectorAll('div, span, p'))) {
        if (el.children.length <= 1 && el.textContent?.trim() === 'Supabase connecté') el.style.visibility = 'hidden';
      }
      document.documentElement.style.scrollBehavior = 'auto';
    })
    .catch(() => {});
}

/** Empreinte réduite pour dédoublonner les captures identiques. */
async function fingerprint(buf) {
  return sharp(buf).resize(480, 270, { fit: 'fill' }).greyscale().raw().toBuffer();
}

function sameImage(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let changed = 0;
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 24) changed += 1;
  return changed < 3;
}

export async function captureTutorial(browser, tut, { work, baseUrl, login, services, retry = false }) {
  const dir = path.join(work, tut.id);
  const shotsDir = path.join(dir, 'shots');
  await rm(dir, { recursive: true, force: true });
  await mkdir(shotsDir, { recursive: true });
  const device = DEVICES[tut.device || 'desktop'];
  const ctx = await browser.newContext({
    ...device,
    acceptDownloads: true,
    locale: 'fr-FR',
    timezoneId: 'Africa/Conakry',
    storageState: tut.anonymous ? undefined : await login(tut.account, tut.device || 'desktop', retry),
  });
  // Les exemples de saisie ne doivent pas citer de vrais projets clients.
  await ctx.addInitScript(() => {
    const scrub = () => {
      for (const el of document.querySelectorAll('[placeholder]')) {
        if (/kakand/i.test(el.getAttribute('placeholder'))) el.setAttribute('placeholder', 'Ex. : Résidence Les Palmiers');
      }
    };
    new MutationObserver(scrub).observe(document, { subtree: true, childList: true });
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);

  let n = 0;
  let lastFp = null;
  let lastFile = null;
  const shot = async (label) => {
    await cleanUi(page);
    const buf = await page.screenshot({ type: 'jpeg', quality: 88 });
    const fp = await fingerprint(buf);
    if (sameImage(fp, lastFp)) return lastFile;
    n += 1;
    const file = `${String(n).padStart(3, '0')}-${label}.jpg`;
    await writeFile(path.join(shotsDir, file), buf);
    lastFp = fp;
    lastFile = file;
    return file;
  };

  const run = { page, ctx, services, baseUrl, downloads: [] };
  const go = async (url) => {
    await page.goto(new URL(url, baseUrl).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await settle(page, 1200);
  };

  if (tut.setup) await tut.setup(run);
  const start = typeof tut.start === 'function' ? await tut.start(run) : tut.start;
  if (start) await go(start);
  if (!tut.anonymous && new URL(page.url()).pathname.startsWith('/login')) {
    await ctx.close();
    if (retry) throw new Error('Session refusée après reconnexion.');
    return captureTutorial(browser, tut, { work, baseUrl, login, services, retry: true });
  }

  const steps = [];
  for (const [si, step] of tut.steps.entries()) {
    const list = step.actions ?? [step];
    const actions = [];
    try {
      for (const a of list) {
        if (a.run) {
          await a.run(run);
          await settle(page, a.wait ?? 600);
          if (a.silent !== false) continue;
        }
        if (a.goto) {
          await go(a.goto);
          actions.push({ type: 'goto', shots: [await shot('goto')] });
          continue;
        }
        if (a.scrollTo || a.scrollBy) {
          if (a.scrollTo) {
            const l = resolve(page, a.scrollTo);
            await l.evaluate((el, off) => {
              const r = el.getBoundingClientRect();
              window.scrollBy(0, r.top - off);
            }, a.offset ?? 90);
          } else await page.mouse.wheel(0, a.scrollBy);
          await settle(page, 500);
          actions.push({ type: 'scroll', shots: [await shot('scroll')] });
          continue;
        }
        if (a.pages) {
          const pdf = run.downloads.filter((f) => f.toLowerCase().endsWith('.pdf')).at(-1);
          if (!pdf) throw new Error('Aucun PDF téléchargé avant l’étape « pages ».');
          const sub = `pages-${si + 1}`;
          const { files, total } = await renderPdfPages(browser, pdf, path.join(dir, sub), { maxPages: a.pages.max ?? 4 });
          actions.push({ type: 'pages', dir: sub, files, total, title: a.pages.title });
          continue;
        }
        if (a.card) {
          actions.push({ type: 'card', card: a.card });
          continue;
        }

        const targetSpec = a.click ?? a.fill ?? a.select ?? a.highlight ?? a.check ?? a.download ?? a.upload;
        const l = resolve(page, targetSpec);
        await l.waitFor({ state: 'visible', timeout: a.timeout ?? 20000 });
        await l.scrollIntoViewIfNeeded().catch(() => {});
        if (a.highlight) {
          await page.waitForTimeout(250);
          actions.push({ type: 'highlight', target: await box(l, a.pad ?? 6), shots: [await shot('highlight')], callout: a.callout });
          continue;
        }
        if (tut.device !== 'mobile') await l.hover().catch(() => {});
        await page.waitForTimeout(200);
        const target = await box(l, a.pad ?? 0);
        const before = await shot('before');
        const act = { type: 'click', target, callout: a.callout, shots: [before] };

        if (a.fill !== undefined) {
          act.type = 'fill';
          const value = String(a.value ?? '');
          await l.click();
          await l.fill('');
          const inputType = await l.evaluate((el) => el.type || '').catch(() => '');
          const typed = !a.instant && !['date', 'week', 'month', 'time', 'datetime-local'].includes(inputType);
          const cuts = typed && value.length > 6 ? [0.35, 0.7] : [];
          for (const c of cuts) {
            await l.fill(value.slice(0, Math.max(1, Math.round(value.length * c))));
            await page.waitForTimeout(80);
            act.shots.push(await shot('typing'));
          }
          await l.fill(value);
          if (a.press) await l.press(a.press);
          await settle(page, a.wait ?? 350);
          act.shots.push(await shot('filled'));
          act.text = value;
        } else if (a.select !== undefined) {
          act.type = 'select';
          act.options = await l.evaluate((el) => Array.from(el.options).map((o) => o.text.trim()));
          const opt = a.option;
          await l.selectOption(typeof opt === 'number' ? { index: opt } : { label: opt }).catch(async () => {
            const match = act.options.find((o) => o.includes(opt));
            if (!match) throw new Error(`Option introuvable : ${opt}`);
            await l.selectOption({ label: match });
          });
          act.selected = typeof opt === 'number' ? act.options[opt] : act.options.find((o) => o.includes(opt)) ?? opt;
          await settle(page, a.wait ?? 500);
          act.shots.push(await shot('selected'));
        } else if (a.check !== undefined) {
          await l.click();
          await settle(page, a.wait ?? 400);
          act.shots.push(await shot('checked'));
        } else if (a.upload !== undefined) {
          act.type = 'click';
          await l.setInputFiles(a.files);
          await settle(page, a.wait ?? 1500);
          act.shots.push(await shot('uploaded'));
        } else if (a.download !== undefined) {
          const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), l.click()]);
          const file = path.join(dir, 'downloads', dl.suggestedFilename());
          await mkdir(path.dirname(file), { recursive: true });
          await dl.saveAs(file);
          run.downloads.push(file);
          await settle(page, a.wait ?? 600);
          act.shots.push(await shot('downloaded'));
          act.download = path.basename(file);
        } else {
          if (a.dialog) page.once('dialog', (d) => d.accept().catch(() => {}));
          await l.click({ force: a.force });
          if (a.waitFor) {
            const timeout = a.waitTimeout ?? 15000;
            const expected = resolve(page, a.waitFor);
            try {
              await expected.waitFor({ state: 'visible', timeout });
            } catch (e) {
              // Clic parfois perdu si la page n'était pas encore hydratée : on réessaie une fois.
              if (a.waitTimeout) throw e;
              await l.click({ force: a.force });
              await expected.waitFor({ state: 'visible', timeout: 20000 });
            }
          }
          if (a.waitUrl) await page.waitForURL(a.waitUrl, { timeout: 30000 });
          await settle(page, a.wait ?? 800);
          act.shots.push(await shot('after'));
        }
        actions.push(act);
      }
    } catch (e) {
      await page.screenshot({ path: path.join(dir, `ERREUR-etape-${si + 1}.png`), fullPage: true }).catch(() => {});
      await ctx.close();
      throw new Error(`${tut.id} — étape ${si + 1} (« ${step.say?.slice(0, 50)} ») : ${e.message.split('\n')[0]}`);
    }
    let focus = null;
    if (step.focus) {
      const fl = resolve(page, step.focus);
      if (await fl.count()) focus = await box(fl, 16);
    }
    steps.push({ say: step.say, caption: step.caption ?? step.say, zoom: step.zoom, focus, actions });
  }

  if (tut.teardown) await tut.teardown(run).catch((e) => console.warn('  ⚠ nettoyage :', e.message));
  await ctx.close();

  const manifest = {
    id: tut.id,
    title: tut.title,
    sector: tut.sector,
    device: tut.device || 'desktop',
    viewport: device.viewport,
    dpr: device.deviceScaleFactor,
    intro: tut.intro,
    outro: tut.outro,
    steps,
    downloads: run.downloads.map((f) => path.relative(dir, f)),
    pagesDir: existsSync(path.join(dir, 'pages')) ? 'pages' : null,
  };
  await writeFile(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 1));
  return manifest;
}
