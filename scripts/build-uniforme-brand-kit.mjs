/**
 * Kit marque pour uniformes — logo + slogan, fond blanc, prêt pour le designer.
 * Usage : npm run build:uniforme-brand
 */
import sharp from 'sharp';
import { mkdir, copyFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'docs', 'marketing', 'uniformes');
const WORDMARK = join(ROOT, 'public', 'brand', 'konadata-wordmark.png');
const ICON = join(ROOT, 'public', 'brand', 'konadata-icon.png');
const TAGLINE = 'Simple, connecté, local.';

const SLOGAN_SVG = (width, fontSize) => Buffer.from(`<svg width="${width}" height="${Math.round(fontSize * 2.2)}" xmlns="http://www.w3.org/2000/svg">
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
    fill="#475569" font-family="Segoe UI, system-ui, sans-serif" font-size="${fontSize}" font-weight="600" letter-spacing="1">${TAGLINE}</text>
</svg>`);

async function composeLogoSlogan(outName, logoWidth, sloganSize, pad = 80) {
  const logo = await sharp(WORDMARK).resize({ width: logoWidth }).png().toBuffer();
  const logoMeta = await sharp(logo).metadata();
  const slogan = await sharp(SLOGAN_SVG(logoWidth, sloganSize)).png().toBuffer();
  const sloganMeta = await sharp(slogan).metadata();

  const canvasW = logoWidth + pad * 2;
  const canvasH = pad + logoMeta.height + 48 + sloganMeta.height + pad;

  await sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([
      { input: logo, top: pad, left: pad },
      { input: slogan, top: pad + logoMeta.height + 48, left: pad },
    ])
    .png()
    .toFile(join(OUT, outName));

  console.log(`✓ ${outName} (${canvasW}×${canvasH})`);
}

async function logoSeul(outName, logoWidth, pad = 80) {
  const logo = await sharp(WORDMARK).resize({ width: logoWidth }).png().toBuffer();
  const logoMeta = await sharp(logo).metadata();
  const canvasW = logoWidth + pad * 2;
  const canvasH = logoMeta.height + pad * 2;

  await sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([{ input: logo, top: pad, left: pad }])
    .png()
    .toFile(join(OUT, outName));

  console.log(`✓ ${outName} (${canvasW}×${canvasH})`);
}

async function main() {
  await mkdir(OUT, { recursive: true });

  await copyFile(WORDMARK, join(OUT, 'konadata-wordmark-source.png'));
  await copyFile(ICON, join(OUT, 'konadata-icon-source.png'));
  console.log('✓ sources copiées');

  await logoSeul('01-logo-seul-poitrine.png', 640);
  await composeLogoSlogan('02-logo-slogan-dos.png', 900, 36);
  await composeLogoSlogan('03-logo-slogan-apercu-large.png', 1200, 48);

  const svgKit = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="800" viewBox="0 0 1200 800" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="800" fill="#ffffff"/>
  <image href="konadata-wordmark-source.png" x="150" y="120" width="900" height="600" preserveAspectRatio="xMidYMid meet"/>
  <text x="600" y="720" text-anchor="middle" fill="#475569" font-family="Segoe UI, system-ui, sans-serif" font-size="42" font-weight="600" letter-spacing="1.5">${TAGLINE}</text>
</svg>`;
  await import('node:fs/promises').then((fs) =>
    fs.writeFile(join(OUT, '04-logo-slogan.svg'), svgKit, 'utf8'),
  );
  console.log('✓ 04-logo-slogan.svg');

  const sloganOnly = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="800" height="120" viewBox="0 0 800 120" xmlns="http://www.w3.org/2000/svg">
  <text x="400" y="70" text-anchor="middle" fill="#475569" font-family="Segoe UI, system-ui, sans-serif" font-size="48" font-weight="600" letter-spacing="2">${TAGLINE}</text>
</svg>`;
  await import('node:fs/promises').then((fs) =>
    fs.writeFile(join(OUT, '05-slogan-seul.svg'), sloganOnly, 'utf8'),
  );
  console.log('✓ 05-slogan-seul.svg');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
