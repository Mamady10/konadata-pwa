/**
 * Rendu des pages d'un PDF en images (pdf.js dans Chromium, servi sur une origine locale fictive).
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { ROOT } from '../../marketing/campaign-html.mjs';

const ORIGIN = 'http://pdf.local';
const PDFJS = path.join(ROOT, 'node_modules', 'pdfjs-dist', 'build');

export async function renderPdfPages(browser, pdfFile, outDir, { maxPages = 6, width = 1400 } = {}) {
  await mkdir(outDir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 800, height: 600 } });
  const page = await ctx.newPage();
  const data = await readFile(pdfFile);
  await page.route(`${ORIGIN}/**`, async (route) => {
    const p = new URL(route.request().url()).pathname;
    if (p === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' });
    if (p === '/doc.pdf') return route.fulfill({ contentType: 'application/pdf', body: data });
    return route.fulfill({ contentType: 'text/javascript', body: await readFile(path.join(PDFJS, path.basename(p))) });
  });
  await page.goto(`${ORIGIN}/`);
  const pages = await page.evaluate(
    async ({ maxPages, width }) => {
      const pdfjs = await import('/pdf.min.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      const doc = await pdfjs.getDocument({ url: '/doc.pdf' }).promise;
      const out = [];
      for (let i = 1; i <= Math.min(doc.numPages, maxPages); i++) {
        const pg = await doc.getPage(i);
        const vp1 = pg.getViewport({ scale: 1 });
        const vp = pg.getViewport({ scale: width / vp1.width });
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(vp.width);
        canvas.height = Math.round(vp.height);
        const c = canvas.getContext('2d');
        c.fillStyle = '#fff';
        c.fillRect(0, 0, canvas.width, canvas.height);
        await pg.render({ canvasContext: c, viewport: vp }).promise;
        out.push(canvas.toDataURL('image/jpeg', 0.9));
      }
      return { out, total: doc.numPages };
    },
    { maxPages, width }
  );
  await ctx.close();
  const files = [];
  for (const [i, d] of pages.out.entries()) {
    const f = path.join(outDir, `page-${String(i + 1).padStart(2, '0')}.jpg`);
    await writeFile(f, Buffer.from(d.split(',')[1], 'base64'));
    files.push(path.basename(f));
  }
  return { files, total: pages.total };
}
