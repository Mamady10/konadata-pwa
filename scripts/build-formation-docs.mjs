#!/usr/bin/env node
/**
 * Exporte le guide utilisateur en PDF et PPTX pour les formations.
 * Usage: npm run build:formation-docs
 */
import { readFile, mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import PptxGenJS from 'pptxgenjs';
import { CAPTURES, FORMATION_SLIDES } from './formation-pptx-slides.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dir, '..');
const SRC_MD = path.join(ROOT, 'docs', 'formation', 'GUIDE-UTILISATEUR-KONADATA.md');
const OUT_DIR = path.join(ROOT, 'docs', 'formation', 'output');

const COLORS = {
  bg: 'F8FAFC',
  dark: '0A192F',
  accent: '2DD4BF',
  text: '334155',
  muted: '64748B',
  headerBar: '134E4A',
};

function mdToHtml(md) {
  const lines = md.split('\n');
  const out = [];
  let inTable = false;
  let inList = false;
  let tableRows = [];

  const flushTable = () => {
    if (!tableRows.length) return;
    out.push('<table>');
    tableRows.forEach((row, i) => {
      const tag = i === 0 ? 'th' : 'td';
      out.push('<tr>' + row.map((c) => `<${tag}>${c}</${tag}>`).join('') + '</tr>');
    });
    out.push('</table>');
    tableRows = [];
    inTable = false;
  };

  const flushList = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.startsWith('|') && line.includes('|')) {
      flushList();
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim());
      if (cells.every((c) => /^[-:]+$/.test(c))) continue;
      if (!inTable) inTable = true;
      tableRows.push(cells.map(escapeHtml));
      continue;
    }
    if (inTable) flushTable();

    if (line.startsWith('# ')) {
      flushList();
      out.push(`<h1>${escapeHtml(line.slice(2))}</h1>`);
    } else if (line.startsWith('## ')) {
      flushList();
      out.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
    } else if (line.startsWith('### ')) {
      flushList();
      out.push(`<h3>${escapeHtml(line.slice(4))}</h3>`);
    } else if (line.startsWith('#### ')) {
      flushList();
      out.push(`<h4>${escapeHtml(line.slice(5))}</h4>`);
    } else if (line.startsWith('- ')) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${inlineMd(line.slice(2))}</li>`);
    } else if (line.startsWith('---')) {
      flushList();
      out.push('<hr/>');
    } else if (line === '') {
      flushList();
    } else {
      flushList();
      out.push(`<p>${inlineMd(line)}</p>`);
    }
  }
  flushTable();
  flushList();
  return out.join('\n');
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function inlineMd(s) {
  let t = escapeHtml(s);
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return t;
}

function imagePath(filename) {
  if (!filename) return null;
  const full = path.join(CAPTURES, filename);
  return existsSync(full) ? full : null;
}

function addSlideHeader(slide, title, route) {
  slide.addShape('rect', {
    x: 0,
    y: 0,
    w: 10,
    h: 0.85,
    fill: { color: COLORS.headerBar },
  });
  slide.addText(title, {
    x: 0.35,
    y: 0.12,
    w: route ? 6.5 : 9.2,
    h: 0.55,
    fontSize: 20,
    bold: true,
    color: 'FFFFFF',
  });
  if (route) {
    slide.addText(route, {
      x: 6.9,
      y: 0.2,
      w: 2.8,
      h: 0.4,
      fontSize: 10,
      color: COLORS.accent,
      align: 'right',
    });
  }
}

function bulletTexts(items) {
  return items.map((b) => ({
    text: b.text,
    options: {
      bullet: true,
      breakLine: true,
      bold: Boolean(b.bold),
    },
  }));
}

function addScreenSlide(pptx, def) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.bg };
  addSlideHeader(slide, def.title, def.route);

  const img = imagePath(def.image);
  const hasImage = Boolean(img);
  const textX = 0.45;
  const textW = hasImage ? 4.55 : 9.1;

  if (def.bullets?.length) {
    slide.addText(bulletTexts(def.bullets), {
      x: textX,
      y: 1.05,
      w: textW,
      h: 4.35,
      fontSize: 12,
      color: COLORS.text,
      valign: 'top',
    });
  }

  if (def.steps?.length) {
    slide.addText(
      def.steps.map((s, i) => ({
        text: `${i + 1}. ${s}`,
        options: { breakLine: true, fontSize: 12 },
      })),
      {
        x: textX,
        y: 1.05,
        w: textW,
        h: 4.35,
        fontSize: 12,
        color: COLORS.text,
        valign: 'top',
      }
    );
  }

  if (img) {
    slide.addImage({
      path: img,
      x: 5.15,
      y: 1.0,
      w: 4.55,
      h: 4.4,
      sizing: { type: 'contain', w: 4.55, h: 4.4 },
    });
    slide.addShape('rect', {
      x: 5.1,
      y: 0.95,
      w: 4.65,
      h: 4.5,
      line: { color: '99F6E4', width: 1 },
    });
  } else if (def.image) {
    slide.addText(`Capture manquante : ${def.image}\nLancez npm run capture:demo:all`, {
      x: 5.15,
      y: 2.5,
      w: 4.5,
      h: 1,
      fontSize: 11,
      color: COLORS.muted,
      italic: true,
      align: 'center',
    });
  }
}

function addTableSlide(pptx, def) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.bg };
  addSlideHeader(slide, def.title);

  const colCount = def.headers.length;
  const colW = Array(colCount).fill(9.1 / colCount);
  const rows = [def.headers, ...def.rows];

  const tableRows = rows.map((row, ri) =>
    row.map((cell) => ({
      text: cell,
      options: {
        bold: ri === 0,
        fill: ri === 0 ? { color: 'CCFBF1' } : { color: 'FFFFFF' },
        color: COLORS.text,
        fontSize: def.rows.length > 6 ? 9 : 10,
      },
    }))
  );

  slide.addTable(tableRows, {
    x: 0.45,
    y: 1.05,
    w: 9.1,
    colW,
    border: { type: 'solid', color: '99F6E4', pt: 0.5 },
    valign: 'middle',
  });
}

function addContentSlide(pptx, def) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.bg };
  addSlideHeader(slide, def.title, def.route);

  if (def.bullets?.length) {
    slide.addText(bulletTexts(def.bullets), {
      x: 0.45,
      y: 1.05,
      w: 9.1,
      h: 4.35,
      fontSize: 13,
      color: COLORS.text,
      valign: 'top',
    });
  }

  if (def.steps?.length) {
    slide.addText(
      def.steps.map((s, i) => ({
        text: `${i + 1}. ${s}`,
        options: { breakLine: true },
      })),
      {
        x: 0.45,
        y: 1.05,
        w: 9.1,
        h: 4.35,
        fontSize: 13,
        color: COLORS.text,
        valign: 'top',
      }
    );
  }
}

async function buildPdf(htmlBody) {
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<style>
  @page { margin: 18mm 16mm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #0A192F; line-height: 1.45; }
  h1 { font-size: 22pt; color: #0A192F; border-bottom: 3px solid #2DD4BF; padding-bottom: 8px; margin-top: 0; }
  h2 { font-size: 15pt; color: #134E4A; margin-top: 22px; page-break-after: avoid; }
  h3 { font-size: 12pt; color: #115E59; margin-top: 16px; }
  h4 { font-size: 11pt; color: #0F766E; }
  code { background: #F0FDFA; padding: 1px 5px; border-radius: 3px; font-size: 10pt; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10pt; }
  th, td { border: 1px solid #99F6E4; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #CCFBF1; }
  ul { margin: 8px 0; padding-left: 22px; }
  li { margin: 4px 0; }
  hr { border: none; border-top: 1px solid #99F6E4; margin: 20px 0; }
  .cover { text-align: center; padding: 80px 0 40px; }
  .cover h1 { border: none; font-size: 28pt; }
  .cover p { color: #64748B; font-size: 13pt; }
</style>
</head>
<body>
<div class="cover">
  <h1>Guide utilisateur KonaData</h1>
  <p>Établissements scolaires — Tous les rôles</p>
  <p>Version formation · ${new Date().toISOString().slice(0, 10)}</p>
</div>
${htmlBody}
</body>
</html>`;

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  const pdfPath = path.join(OUT_DIR, 'GUIDE-UTILISATEUR-KONADATA.pdf');
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '12mm', bottom: '14mm', left: '12mm', right: '12mm' },
  });
  await browser.close();
  return pdfPath;
}

async function buildPptx() {
  const pptx = new PptxGenJS();
  pptx.author = 'KonaData';
  pptx.title = 'Guide utilisateur KonaData — Formation';
  pptx.layout = 'LAYOUT_16x9';

  let imageCount = 0;

  for (const def of FORMATION_SLIDES) {
    if (def.kind === 'title') {
      const slide = pptx.addSlide();
      slide.background = { color: COLORS.dark };
      slide.addText(def.title, {
        x: 0.5,
        y: 1.7,
        w: 9,
        h: 1,
        fontSize: 32,
        bold: true,
        color: 'FFFFFF',
        align: 'center',
      });
      slide.addText(def.subtitle ?? '', {
        x: 0.5,
        y: 2.85,
        w: 9,
        h: 0.6,
        fontSize: 16,
        color: COLORS.accent,
        align: 'center',
      });
      slide.addText(`konadatagn.com · ${new Date().toISOString().slice(0, 10)}`, {
        x: 0.5,
        y: 4.8,
        w: 9,
        h: 0.4,
        fontSize: 11,
        color: '94A3B8',
        align: 'center',
      });
      continue;
    }

    if (def.kind === 'screen') {
      if (def.image && imagePath(def.image)) imageCount += 1;
      addScreenSlide(pptx, def);
      continue;
    }

    if (def.kind === 'table') {
      addTableSlide(pptx, def);
      continue;
    }

    addContentSlide(pptx, def);
  }

  const basePptx = path.join(OUT_DIR, 'GUIDE-UTILISATEUR-KONADATA.pptx');
  let pptxPath = basePptx;
  try {
    await pptx.writeFile({ fileName: pptxPath });
  } catch (err) {
    if (err?.code === 'EBUSY') {
      pptxPath = path.join(
        OUT_DIR,
        `GUIDE-UTILISATEUR-KONADATA-${new Date().toISOString().slice(0, 10)}.pptx`
      );
      await pptx.writeFile({ fileName: pptxPath });
    } else {
      throw err;
    }
  }
  return { pptxPath, slideCount: FORMATION_SLIDES.length, imageCount };
}

async function main() {
  if (!existsSync(SRC_MD)) {
    throw new Error(`Guide source manquant: ${SRC_MD}`);
  }

  await mkdir(OUT_DIR, { recursive: true });
  const md = await readFile(SRC_MD, 'utf8');
  const htmlBody = mdToHtml(md);

  let pdfPath = null;
  try {
    console.log('📄 Génération PDF…');
    pdfPath = await buildPdf(htmlBody);
    console.log('   ✓', pdfPath);
  } catch (err) {
    if (err?.code === 'EBUSY') {
      console.warn('   ⚠ PDF verrouillé (fichier ouvert ?) — PPTX généré quand même');
    } else {
      throw err;
    }
  }

  console.log('📊 Génération PPTX (captures + boutons)…');
  const { pptxPath, slideCount, imageCount } = await buildPptx();
  console.log('   ✓', pptxPath);
  console.log(`   ${slideCount} slides · ${imageCount} captures intégrées`);

  await writeFile(path.join(OUT_DIR, 'README.txt'), [
    'Fichiers de formation KonaData',
    '',
    'GUIDE-UTILISATEUR-KONADATA.pdf — guide texte complet',
    'GUIDE-UTILISATEUR-KONADATA.pptx — présentation avec captures écran et détail boutons',
    '',
    'Régénérer : npm run build:formation-docs',
    'Captures : npm run capture:demo:all (avant PPTX)',
    'Slides : scripts/formation-pptx-slides.mjs',
    'Guide texte : docs/formation/GUIDE-UTILISATEUR-KONADATA.md',
  ].join('\n'), 'utf8');

  console.log('\n✅ Documents de formation prêts dans docs/formation/output/');
}

main().catch((e) => {
  console.error('❌', e.message || e);
  process.exit(1);
});
