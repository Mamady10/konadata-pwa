/**
 * Génère les affiches A4 PNG (300 dpi) avec QR code intégré.
 * Usage :
 *   npm run generate:poster          → multi-secteur + écoles
 *   npm run generate:poster -- school → écoles uniquement
 */
import sharp from 'sharp';
import { readFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'public', 'marketing');
const QR_PATH = join(ROOT, 'public', 'konadata-qr.png');
const CONTACT_PATH = join(ROOT, 'lib', 'marketing', 'poster-contact.json');
const BRAND_TAGLINE = 'Simple, connecté, local.';

/** A4 @ 300 dpi */
const W = 2480;
const H = 3508;

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function posterSvg(qrBase64, contact, variant) {
  const isSchool = variant === 'school';
  const qrSize = 720;
  const qrX = W - 180 - qrSize;
  const qrY = isSchool ? 880 : 920;

  const badge = isSchool ? 'ÉCOLES · GUINÉE · PWA' : 'GUINÉE · 3G/4G · PWA';

  const leadLines = isSchool
    ? [
        'KonaData simplifie la vie scolaire : inscriptions en ligne,',
        'notes centralisées, bulletins PDF et suivi des paiements',
        'des familles — pensé pour mobile et les réseaux 3G/4G.',
      ]
    : [
        'KonaData : plateforme SaaS de gestion de données',
        'pensée pour le terrain guinéen — simple sur mobile,',
        'sécurisée dans le cloud, utilisable en 3G/4G.',
      ];

  const features = isSchool
    ? [
        ['Inscriptions & candidatures', 'Portail familles, pièces jointes, codes réinscription'],
        ['Notes & bulletins officiels', 'Saisie enseignants, moyennes, rang, export PDF'],
        ['Finances scolarité', 'Tranches, reçus, liens de paiement Orange Money'],
        ['Direction & enseignants', 'Tableaux de bord, classes, utilisateurs, essai 30 jours'],
      ]
    : [
        ['Inscriptions & scolarité', 'Candidatures, réinscriptions, paiements familles'],
        ['Notes & bulletins', 'Saisie enseignants, moyennes auto, PDF officiels'],
        ['Direction & comptabilité', 'Tableaux de bord, finances par classe'],
        ['Assistant KonaAI', 'Aide à la saisie, analyse et rapports (option)'],
      ];

  const sectorPills = isSchool
    ? [
        ['Primaire', 140],
        ['Collège', 360],
        ['Lycée', 580],
        ['Université', 800],
      ]
    : [
        ['Écoles', 140],
        ['ONG', 340],
        ['BTP', 540],
        ['PME', 740],
      ];

  const footerTagline = isSchool
    ? 'Solution dédiée établissements · Données sécurisées · Support en français'
    : 'Plateforme multi-secteur · Données sécurisées · Support en français';

  const partnersLine = isSchool
    ? 'PREMCO · VCCOM · Loukhy · Établissements partenaires'
    : 'PREMCO · VCCOM · Loukhy · Établissements · ONG';

  const featuresY0 = isSchool ? 940 : 980;

  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0A192F"/>
      <stop offset="100%" stop-color="#0d2240"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#22d3ee"/>
      <stop offset="50%" stop-color="#2dd4bf"/>
      <stop offset="100%" stop-color="#2563eb"/>
    </linearGradient>
    <radialGradient id="glow1" cx="90%" cy="5%" r="45%">
      <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#22d3ee" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="10%" cy="95%" r="40%">
      <stop offset="0%" stop-color="#2563eb" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#2563eb" stop-opacity="0"/>
    </radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="24" flood-color="#000" flood-opacity="0.35"/>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow1)"/>
  <rect width="${W}" height="${H}" fill="url(#glow2)"/>

  <rect x="140" y="120" width="110" height="110" rx="28" fill="url(#accent)" filter="url(#shadow)"/>
  <text x="195" y="192" text-anchor="middle" fill="#fff" font-family="system-ui,sans-serif" font-size="42" font-weight="800">KD</text>
  <text x="280" y="155" fill="#22d3ee" font-family="system-ui,sans-serif" font-size="72" font-weight="800">KONA</text>
  <text x="280" y="225" fill="#f8fafc" font-family="system-ui,sans-serif" font-size="72" font-weight="800">DATA</text>
  <text x="280" y="268" fill="rgba(248,250,252,0.55)" font-family="system-ui,sans-serif" font-size="26" font-weight="600" letter-spacing="2">${esc(BRAND_TAGLINE)}</text>

  <rect x="${W - 560}" y="135" width="420" height="56" rx="28" fill="rgba(45,212,191,0.12)" stroke="rgba(45,212,191,0.35)" stroke-width="2"/>
  <text x="${W - 350}" y="172" text-anchor="middle" fill="#2dd4bf" font-family="system-ui,sans-serif" font-size="24" font-weight="700" letter-spacing="2">${esc(badge)}</text>

  <text x="140" y="420" fill="#f8fafc" font-family="system-ui,sans-serif" font-size="62" font-weight="800">
    <tspan x="140" dy="0">Votre établissement,</tspan>
    <tspan x="140" dy="78" fill="url(#accent)">connecté et organisé</tspan>
    <tspan x="140" dy="78" fill="#f8fafc">— inscriptions, notes,</tspan>
    <tspan x="140" dy="78" fill="#f8fafc">bulletins et finances.</tspan>
  </text>

  <text x="140" y="780" fill="rgba(248,250,252,0.75)" font-family="system-ui,sans-serif" font-size="34" font-weight="400">
    ${leadLines.map((line, i) => `<tspan x="140" dy="${i === 0 ? 0 : 48}">${esc(line)}</tspan>`).join('')}
  </text>

  ${features
    .map(([title, desc], i) => {
      const y = featuresY0 + i * 130;
      return `
    <circle cx="158" cy="${y + 8}" r="10" fill="url(#accent)"/>
    <text x="190" y="${y}" fill="#f8fafc" font-family="system-ui,sans-serif" font-size="32" font-weight="700">${esc(title)}</text>
    <text x="190" y="${y + 42}" fill="rgba(248,250,252,0.65)" font-family="system-ui,sans-serif" font-size="28">${esc(desc)}</text>`;
    })
    .join('')}

  ${sectorPills
    .map(([label, x]) => {
      const w = isSchool ? 190 : 170;
      return `
    <rect x="${x}" y="1520" width="${w}" height="52" rx="12" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
    <text x="${x + w / 2}" y="1554" text-anchor="middle" fill="rgba(248,250,252,0.7)" font-family="system-ui,sans-serif" font-size="24" font-weight="600">${esc(label)}</text>`;
    })
    .join('')}

  <rect x="${qrX - 40}" y="${qrY - 60}" width="${qrSize + 80}" height="${qrSize + 320}" rx="32" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.14)" stroke-width="2"/>
  <text x="${qrX + qrSize / 2}" y="${qrY - 10}" text-anchor="middle" fill="#22d3ee" font-family="system-ui,sans-serif" font-size="26" font-weight="700" letter-spacing="4">ACCÈS RAPIDE</text>
  <rect x="${qrX}" y="${qrY + 30}" width="${qrSize}" height="${qrSize}" rx="24" fill="#ffffff" filter="url(#shadow)"/>
  <image x="${qrX + 36}" y="${qrY + 66}" width="${qrSize - 72}" height="${qrSize - 72}" href="data:image/png;base64,${qrBase64}"/>
  <text x="${qrX + qrSize / 2}" y="${qrY + qrSize + 100}" text-anchor="middle" fill="#f8fafc" font-family="system-ui,sans-serif" font-size="34" font-weight="700">${esc(contact.website)}</text>
  <text x="${qrX + qrSize / 2}" y="${qrY + qrSize + 150}" text-anchor="middle" fill="rgba(248,250,252,0.5)" font-family="system-ui,sans-serif" font-size="24">
    <tspan x="${qrX + qrSize / 2}" dy="0">Scannez pour vous connecter</tspan>
    <tspan x="${qrX + qrSize / 2}" dy="36">Installez sur l'écran d'accueil</tspan>
  </text>

  <line x1="140" y1="${H - 300}" x2="${W - 140}" y2="${H - 300}" stroke="rgba(255,255,255,0.12)" stroke-width="2"/>
  <text x="140" y="${H - 230}" fill="rgba(248,250,252,0.75)" font-family="system-ui,sans-serif" font-size="26">
    <tspan font-weight="700">Email :</tspan> ${esc(contact.email)}
  </text>
  <text x="140" y="${H - 185}" fill="#25D366" font-family="system-ui,sans-serif" font-size="26" font-weight="600">
    WhatsApp : ${esc(contact.whatsappDisplay)}
  </text>
  <text x="140" y="${H - 140}" fill="rgba(248,250,252,0.45)" font-family="system-ui,sans-serif" font-size="24">${esc(footerTagline)}</text>
  <text x="${W - 140}" y="${H - 230}" text-anchor="end" fill="rgba(248,250,252,0.4)" font-family="system-ui,sans-serif" font-size="22" letter-spacing="3">ILS NOUS FONT CONFIANCE</text>
  <text x="${W - 140}" y="${H - 185}" text-anchor="end" fill="rgba(248,250,252,0.55)" font-family="system-ui,sans-serif" font-size="24" font-weight="600">${esc(partnersLine)}</text>
</svg>`;
}

async function generateVariant(variant, qrBase64, contact) {
  const svg = posterSvg(qrBase64, contact, variant);
  const filename =
    variant === 'school' ? 'affiche-konadata-ecoles-a4.png' : 'affiche-konadata-a4.png';
  const pngPath = join(OUT_DIR, filename);
  await sharp(Buffer.from(svg)).png({ quality: 95 }).toFile(pngPath);
  console.log(`✓ ${filename}`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const contact = JSON.parse(await readFile(CONTACT_PATH, 'utf8'));
  const qrBuffer = await readFile(QR_PATH);
  const qrBase64 = qrBuffer.toString('base64');

  const arg = process.argv[2];
  if (arg === 'school') {
    await generateVariant('school', qrBase64, contact);
    return;
  }
  if (arg === 'all') {
    await generateVariant('all', qrBase64, contact);
    return;
  }

  await generateVariant('all', qrBase64, contact);
  await generateVariant('school', qrBase64, contact);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
