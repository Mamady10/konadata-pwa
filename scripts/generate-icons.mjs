/**
 * Génère les icônes d'installation (PWA, iOS, favicon) : le symbole KonaData
 * (public/brand/konadata-symbol.svg : K blanc prolongé en graphique à barres) sur fond vert dégradé.
 *
 * - icon-192/512 (« any ») : carré arrondi, symbole en grand (bureau, barre des tâches, onglets)
 * - maskable-192/512 : fond plein, symbole dans la zone sûre (Android découpe en cercle ou goutte)
 * - apple-touch-icon (180) : fond plein, iOS arrondit lui-même
 * - favicon-32/48 : symbole au plus près pour rester lisible en très petit
 * - public/brand/konadata-app-icon.png (1024) : icône complète pour les supports marketing
 * - public/brand/konadata-mark.png (512) : carré arrondi affiché dans l'appli à côté du nom
 *
 * Usage : npm run generate:icons
 */
import sharp from 'sharp';
import { mkdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SYMBOL = join(ROOT, 'public', 'brand', 'konadata-symbol.svg');
const ICONS_DIR = join(ROOT, 'public', 'icons');

function backgroundSvg(size, radius) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#17634D"/>
      <stop offset="1" stop-color="#4FB488"/>
    </linearGradient>
    <radialGradient id="glow" cx="72%" cy="22%" r="70%">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity=".14"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * radius}" fill="url(#bg)"/>
  <rect width="${size}" height="${size}" rx="${size * radius}" fill="url(#glow)"/>
</svg>`;
}

function symbolSvg(symbol, size, scale) {
  const inner = symbol.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const s = size * scale;
  const o = (size - s) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <svg x="${o}" y="${o}" width="${s}" height="${s}" viewBox="0 0 100 100">${inner}</svg>
</svg>`;
}

/**
 * Icône carrée `size` : le symbole occupe `scale` × size, centré ; `radius` arrondit les coins
 * (fond transparent autour), `shadow` ajoute une ombre douce sous le symbole.
 * L'ombre est composée avec sharp : les filtres SVG masquent le symbole avec librsvg.
 */
async function renderIcon(symbol, size, { scale, radius = 0, shadow = true }) {
  const layers = [];
  const art = await sharp(Buffer.from(symbolSvg(symbol, size, scale))).png().toBuffer();
  if (shadow) {
    const alpha = await sharp(art).extractChannel('alpha').linear(0.35, 0).toBuffer();
    const shade = await sharp({ create: { width: size, height: size, channels: 3, background: '#0B3D2E' } })
      .joinChannel(alpha)
      .blur(Math.max(0.3, size * 0.012))
      .png()
      .toBuffer();
    layers.push({ input: shade, top: Math.round(size * 0.012), left: 0 });
  }
  layers.push({ input: art, top: 0, left: 0 });
  return sharp(Buffer.from(backgroundSvg(size, radius))).composite(layers);
}

async function main() {
  await mkdir(ICONS_DIR, { recursive: true });
  const symbol = await readFile(SYMBOL, 'utf8');

  const outputs = [
    [join(ICONS_DIR, 'icon-192x192.png'), 192, { scale: 0.66, radius: 0.22 }],
    [join(ICONS_DIR, 'icon-512x512.png'), 512, { scale: 0.66, radius: 0.22 }],
    // Zone sûre Android : cercle de 80 % ; le symbole (100 × 91) y tient à 58 %.
    [join(ICONS_DIR, 'maskable-192x192.png'), 192, { scale: 0.58 }],
    [join(ICONS_DIR, 'maskable-512x512.png'), 512, { scale: 0.58 }],
    [join(ICONS_DIR, 'apple-touch-icon.png'), 180, { scale: 0.64 }],
    [join(ICONS_DIR, 'favicon-48x48.png'), 48, { scale: 0.78, radius: 0.2, shadow: false }],
    [join(ICONS_DIR, 'favicon-32x32.png'), 32, { scale: 0.8, radius: 0.18, shadow: false }],
    [join(ROOT, 'public', 'brand', 'konadata-app-icon.png'), 1024, { scale: 0.62 }],
    [join(ROOT, 'public', 'brand', 'konadata-mark.png'), 512, { scale: 0.68, radius: 0.24 }],
  ];
  for (const [file, size, options] of outputs) {
    const icon = await renderIcon(symbol, size, options);
    await icon.png({ compressionLevel: 9 }).toFile(file);
    console.log(`✓ ${file}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
