/**
 * Génère les icônes PWA 192x192 et 512x512 avec la couleur #0D192F.
 * Usage : npm run generate:icons
 */
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = join(__dirname, '..', 'public', 'icons');
const BRAND_COLOR = '#0D192F';

async function createIcon(size) {
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="${BRAND_COLOR}" rx="${Math.round(size * 0.12)}"/>
      <text
        x="50%"
        y="54%"
        dominant-baseline="middle"
        text-anchor="middle"
        fill="#3B82F6"
        font-family="system-ui, sans-serif"
        font-weight="700"
        font-size="${Math.round(size * 0.28)}"
      >GN</text>
    </svg>
  `;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function main() {
  await mkdir(ICONS_DIR, { recursive: true });

  const sizes = [192, 512];
  for (const size of sizes) {
    const buffer = await createIcon(size);
    const filePath = join(ICONS_DIR, `icon-${size}x${size}.png`);
    await writeFile(filePath, buffer);
    console.log(`✓ ${filePath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
