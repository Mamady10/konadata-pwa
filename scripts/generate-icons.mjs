/**
 * Génère les icônes d'installation (PWA, iOS, favicon) à partir de l'icône d'application KonaData
 * (public/brand/konadata-app-icon.png : barres de croissance, flèche et étoile sur fond marine).
 *
 * - icon-192/512 (« any ») : carré arrondi, logo en grand (bureau, barre des tâches, onglets)
 * - maskable-192/512 : fond plein, logo dans la zone sûre (Android découpe en cercle ou goutte)
 * - apple-touch-icon (180) : fond plein, iOS arrondit lui-même
 * - favicon-32/48 : logo recadré au plus près pour rester lisible en très petit
 *
 * Usage : npm run generate:icons
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SOURCE = join(ROOT, 'public', 'brand', 'konadata-app-icon.png');
const ICONS_DIR = join(ROOT, 'public', 'icons');

/** Isole le dessin du logo (sans le carré arrondi ni le fond noir de l'image source). */
async function extractArtwork() {
  const { data, info } = await sharp(SOURCE).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const at = (x, y) => (y * width + x) * 3;
  const bg = [...data.subarray(at(width >> 1, 8), at(width >> 1, 8) + 3)];
  // Forme du carré arrondi de la source (étendue de chaque ligne et colonne), rognée de `m` :
  // son liseré de bord ne doit faire partie ni du cadrage ni du dessin.
  const lit = (x, y) => Math.max(data[at(x, y)], data[at(x, y) + 1], data[at(x, y) + 2]) > 8;
  const extent = (n, len, isLit) => {
    let [a, b] = [0, len - 1];
    while (a < len && !isLit(n, a)) a++;
    while (b > a && !isLit(n, b)) b--;
    return [a, b];
  };
  const rows = Array.from({ length: height }, (_, y) => extent(y, width, (yy, x) => lit(x, yy)));
  const cols = Array.from({ length: width }, (_, x) => extent(x, height, (xx, y) => lit(xx, y)));
  const m = Math.round(width * 0.03);
  const inside = (x, y) => x >= rows[y][0] + m && x <= rows[y][1] - m && y >= cols[x][0] + m && y <= cols[x][1] - m;

  let [x0, y0, x1, y1] = [width, height, 0, 0];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = at(x, y);
      if (inside(x, y) && Math.max(data[i], data[i + 1], data[i + 2]) > 90) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
    }
  }
  const pad = Math.round((x1 - x0) * 0.03);
  const box = {
    left: Math.max(0, x0 - pad),
    top: Math.max(0, y0 - pad),
    width: Math.min(width, x1 + pad) - Math.max(0, x0 - pad),
    height: Math.min(height, y1 + pad) - Math.max(0, y0 - pad),
  };
  // Fond marine retiré : le dessin est ensuite fondu (mode « screen ») sur le fond de l'icône, sans bord visible.
  const crop = await sharp(SOURCE).removeAlpha().extract(box).raw().toBuffer({ resolveWithObject: true });
  const { width: cw, height: ch } = crop.info;
  for (let i = 0; i < crop.data.length; i++) {
    const p = Math.floor(i / 3);
    const [x, y] = [p % cw, Math.floor(p / cw)];
    const edge = Math.min(x, cw - 1 - x, y, ch - 1 - y);
    const keep = inside(box.left + x, box.top + y) ? Math.min(1, edge / pad) : 0;
    crop.data[i] = Math.max(0, crop.data[i] - bg[i % 3] - 10) * keep;
  }
  const art = await sharp(crop.data, { raw: crop.info }).png().toBuffer();
  return { art, box, background: { r: bg[0], g: bg[1], b: bg[2] } };
}

/**
 * Icône carrée `size` : le logo tient dans `scale` × size (ou dans le cercle de diamètre
 * `safe` × size si fourni) ; `radius` arrondit les coins (fond transparent autour).
 */
async function renderIcon({ art, box, background }, size, { scale = 0.8, safe, radius = 0 }) {
  const fit = safe ? (safe * size) / Math.hypot(box.width, box.height) : (scale * size) / Math.max(box.width, box.height);
  const w = Math.round(box.width * fit);
  const h = Math.round(box.height * fit);
  const logo = await sharp(art).resize(w, h, { kernel: 'lanczos3' }).png().toBuffer();
  const { r, g, b } = background;
  const rgb = `rgb(${r},${g},${b})`;
  const frame = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="glow" cx="50%" cy="46%" r="78%">
          <stop offset="0%" stop-color="#0E2A4A"/>
          <stop offset="100%" stop-color="${rgb}"/>
        </radialGradient>
      </defs>
      <rect width="${size}" height="${size}" rx="${Math.round(size * radius)}" fill="url(#glow)"/>
    </svg>`
  );
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><rect width="${size}" height="${size}" rx="${Math.round(size * radius)}" fill="#fff"/></svg>`
  );
  return sharp(frame)
    .composite([
      { input: logo, left: Math.round((size - w) / 2), top: Math.round((size - h) / 2), blend: 'screen' },
      { input: mask, blend: 'dest-in' },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  await mkdir(ICONS_DIR, { recursive: true });
  const artwork = await extractArtwork();

  const outputs = [
    ['icon-192x192.png', 192, { scale: 0.74, radius: 0.22 }],
    ['icon-512x512.png', 512, { scale: 0.74, radius: 0.22 }],
    ['maskable-192x192.png', 192, { safe: 0.86 }],
    ['maskable-512x512.png', 512, { safe: 0.86 }],
    ['apple-touch-icon.png', 180, { scale: 0.72 }],
    ['favicon-48x48.png', 48, { scale: 0.96, radius: 0.2 }],
    ['favicon-32x32.png', 32, { scale: 0.98, radius: 0.18 }],
  ];
  for (const [name, size, options] of outputs) {
    const file = join(ICONS_DIR, name);
    await sharp(await renderIcon(artwork, size, options)).toFile(file);
    console.log(`✓ ${file}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
