#!/usr/bin/env node
/**
 * Génère le pitch commercial écoles en PPTX.
 * Usage: npm run build:commercial-docs
 */
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import PptxGenJS from 'pptxgenjs';
import { PITCH_SLIDES } from './commercial-pitch-slides.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dir, '..');
const OUT_DIR = path.join(ROOT, 'docs', 'commercial', 'output');

const COLORS = {
  bg: 'F8FAFC',
  dark: '0A192F',
  primary: '2563EB',
  accent: '2DD4BF',
  text: '334155',
  muted: '64748B',
  headerBar: '1E3A8A',
};

function addSlideHeader(slide, title) {
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
    w: 9.2,
    h: 0.55,
    fontSize: 20,
    bold: true,
    color: 'FFFFFF',
  });
}

function bulletTexts(items) {
  return items.map((b) => ({
    text: typeof b === 'string' ? b : b.text,
    options: {
      bullet: true,
      breakLine: true,
      bold: Boolean(b.bold),
    },
  }));
}

function addContentSlide(pptx, def) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.bg };
  addSlideHeader(slide, def.title);

  if (def.bullets?.length) {
    slide.addText(bulletTexts(def.bullets), {
      x: 0.45,
      y: 1.05,
      w: 9.1,
      h: 4.35,
      fontSize: 14,
      color: COLORS.text,
      valign: 'top',
    });
  }

  if (def.steps?.length) {
    slide.addText(
      def.steps.map((s, i) => ({
        text: `${i + 1}. ${s}`,
        options: { breakLine: true, fontSize: 12, italic: true },
      })),
      {
        x: 0.45,
        y: 1.05,
        w: 9.1,
        h: 4.35,
        fontSize: 12,
        color: COLORS.text,
        valign: 'top',
      }
    );
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
        fill: ri === 0 ? { color: 'DBEAFE' } : { color: 'FFFFFF' },
        color: COLORS.text,
        fontSize: def.rows.length > 5 ? 10 : 11,
      },
    }))
  );

  slide.addTable(tableRows, {
    x: 0.45,
    y: 1.05,
    w: 9.1,
    colW,
    border: { type: 'solid', color: '93C5FD', pt: 0.5 },
    valign: 'middle',
  });
}

async function buildPptx() {
  const pptx = new PptxGenJS();
  pptx.author = 'KonaData';
  pptx.title = 'Pitch commercial — Établissements scolaires';
  pptx.subject = 'KonaData SaaS Guinée';
  pptx.layout = 'LAYOUT_16x9';

  for (const def of PITCH_SLIDES) {
    if (def.kind === 'title') {
      const slide = pptx.addSlide();
      slide.background = { color: COLORS.dark };
      slide.addShape('rect', {
        x: 0,
        y: 4.6,
        w: 10,
        h: 0.08,
        fill: { color: COLORS.primary },
      });
      slide.addText(def.title, {
        x: 0.5,
        y: 1.6,
        w: 9,
        h: 1,
        fontSize: 36,
        bold: true,
        color: 'FFFFFF',
        align: 'center',
      });
      slide.addText(def.subtitle ?? '', {
        x: 0.5,
        y: 2.75,
        w: 9,
        h: 0.8,
        fontSize: 18,
        color: COLORS.accent,
        align: 'center',
      });
      slide.addText(def.footer ?? `konadatagn.com · ${new Date().toISOString().slice(0, 10)}`, {
        x: 0.5,
        y: 4.85,
        w: 9,
        h: 0.4,
        fontSize: 11,
        color: '94A3B8',
        align: 'center',
      });
      continue;
    }

    if (def.kind === 'table') {
      addTableSlide(pptx, def);
      continue;
    }

    addContentSlide(pptx, def);
  }

  const pptxPath = path.join(OUT_DIR, 'KONADATA-PITCH-ECOLES.pptx');
  await pptx.writeFile({ fileName: pptxPath });
  return { pptxPath, slideCount: PITCH_SLIDES.length };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log('📊 Génération pitch commercial PPTX…');
  const { pptxPath, slideCount } = await buildPptx();
  console.log(`   ✓ ${pptxPath}`);
  console.log(`   ${slideCount} slides`);

  await writeFile(
    path.join(OUT_DIR, 'README.txt'),
    [
      'Documents commerciaux KonaData — Établissements scolaires',
      '',
      'KONADATA-PITCH-ECOLES.pptx — présentation commerciale (11 slides)',
      '',
      'Sources Markdown (docs/commercial/) :',
      '  convention-partenariat-ecole-konadata.md',
      '  convention-partenariat-ecole-konadata-bilingue.md',
      '  grille-tarifaire-ecoles.md',
      '',
      'Régénérer le PPTX : npm run build:commercial-docs',
    ].join('\n'),
    'utf8'
  );

  console.log('\n✅ Documents commerciaux prêts dans docs/commercial/');
}

main().catch((e) => {
  console.error('❌', e.message || e);
  process.exit(1);
});
