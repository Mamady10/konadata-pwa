// Génère les QR codes KonaData (logo au centre) pour plusieurs cibles, plus des
// FLYERS PDF (une page A4 légendée par cible) à imprimer et coller dans les
// institutions pour faciliter l'accès à la plateforme.
//
// Sortie : exports/KonaData-QR-<slug>.png  +  exports/KonaData-QR-flyers.pdf
// Usage  : node scripts/generate-qr-codes.mjs [baseUrl]

import QRCode from 'qrcode';
import sharp from 'sharp';
import { jsPDF } from 'jspdf';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const iconPath = path.join(root, 'public', 'brand', 'konadata-icon.png');

const BASE_URL = (process.argv[2]?.trim() || 'https://www.konadatagn.com').replace(/\/$/, '');
const NAVY = '#0A192F';

// Cibles à encoder — avec descriptions orientées vers le public qui scanne.
const TARGETS = [
  {
    slug: 'accueil',
    pathname: '/',
    title: 'Découvrez KonaData',
    description:
      "La plateforme guinéenne qui digitalise la gestion des écoles, ONG, chantiers BTP et commerces. Scannez pour découvrir nos solutions.",
    bullets: [
      'Gestion complète de votre organisation',
      'Rapports et documents automatiques (IA)',
      'Accessible sur mobile, même en réseau faible',
    ],
  },
  {
    slug: 'connexion',
    pathname: '/login',
    title: 'Connectez-vous à votre espace',
    description:
      "Vous êtes membre d'une organisation qui utilise KonaData ? Scannez ce code pour ouvrir votre tableau de bord.",
    bullets: [
      'Vos données en temps réel',
      'Espace sécurisé selon votre rôle',
      'Disponible 24h/24 depuis votre téléphone',
    ],
  },
  {
    slug: 'suivi-scolarite',
    pathname: '/suivi-scolarite',
    title: "Suivez la scolarité de votre enfant",
    description:
      "Parents et tuteurs : consultez notes, bulletins et paiements. Aucun compte à créer — il suffit du matricule de l'élève et de votre numéro de téléphone.",
    bullets: [
      'Notes et bulletins en ligne',
      'Payer la scolarité par Orange Money',
      'Notifications par WhatsApp',
    ],
  },
  {
    slug: 'inscription-etablissement',
    pathname: '/inscription-etablissement',
    title: 'Inscrivez votre établissement',
    description:
      "Direction d'école : digitalisez inscriptions, notes, bulletins et paiements avec KonaData. Scannez pour démarrer.",
    bullets: [
      'Bulletins et reçus automatiques',
      'Suivi des paiements et des impayés',
      'Communication directe avec les parents',
    ],
  },
];

const QR_SIZE = 900;

/** Génère un PNG de QR code avec le logo KonaData incrusté au centre. */
async function makeQrWithLogo(url) {
  const qrBuffer = await QRCode.toBuffer(url, {
    errorCorrectionLevel: 'H', // tolère l'occlusion du logo central
    margin: 2,
    width: QR_SIZE,
    color: { dark: NAVY + 'FF', light: '#FFFFFFFF' },
  });

  const badge = Math.round(QR_SIZE * 0.24);
  const logo = Math.round(QR_SIZE * 0.17);
  const radius = Math.round(badge * 0.22);
  const badgeSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${badge}" height="${badge}">
       <rect x="0" y="0" width="${badge}" height="${badge}" rx="${radius}" ry="${radius}" fill="#FFFFFF"/>
     </svg>`
  );

  const logoBuffer = await sharp(iconPath)
    .resize(logo, logo, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();

  const badgeWithLogo = await sharp(badgeSvg)
    .composite([{ input: logoBuffer, gravity: 'center' }])
    .png()
    .toBuffer();

  return sharp(qrBuffer)
    .composite([{ input: badgeWithLogo, gravity: 'center' }])
    .png()
    .toBuffer();
}

// ── Génération PNG + collecte pour le PDF ──────────────────
const generated = [];
for (const t of TARGETS) {
  const url = `${BASE_URL}${t.pathname}`;
  const png = await makeQrWithLogo(url);
  const outPng = path.join(root, 'exports', `KonaData-QR-${t.slug}.png`);
  await writeFile(outPng, png);
  generated.push({ ...t, url, png });
  console.log('PNG :', outPng, '->', url);
}

// ── Flyers PDF (A4, une page par cible) ────────────────────
const doc = new jsPDF({ unit: 'mm', format: 'a4' });
const PW = 210;
const PH = 297;

function drawFlyer(g, isFirst) {
  if (!isFirst) doc.addPage();

  // Bandeau de marque (navy)
  doc.setFillColor(10, 25, 47);
  doc.rect(0, 0, PW, 46, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(34);
  const wk = doc.getTextWidth('Kona');
  const wd = doc.getTextWidth('Data');
  let x = (PW - (wk + wd)) / 2;
  doc.setTextColor(255, 255, 255);
  doc.text('Kona', x, 25);
  doc.setTextColor(56, 189, 248);
  doc.text('Data', x + wk, 25);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(203, 213, 225);
  doc.text('Simple, connecté, local.', PW / 2, 35, { align: 'center' });

  // Titre d'action
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(23);
  doc.setTextColor(10, 25, 47);
  const titleLines = doc.splitTextToSize(g.title, 170);
  let y = 62;
  doc.text(titleLines, PW / 2, y, { align: 'center' });
  y += titleLines.length * 9 + 3;

  // Description
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12.5);
  doc.setTextColor(71, 85, 105);
  const descLines = doc.splitTextToSize(g.description, 168);
  doc.text(descLines, PW / 2, y, { align: 'center' });
  y += descLines.length * 6 + 6;

  // Avantages (puces, alignées à gauche)
  doc.setFontSize(12);
  for (const b of g.bullets) {
    doc.setFillColor(37, 99, 235);
    doc.circle(34, y - 1.3, 1.2, 'F');
    doc.setTextColor(30, 41, 59);
    doc.text(b, 39, y);
    y += 7.5;
  }

  // QR (centré, cadre léger)
  const qrMm = 80;
  const qrX = (PW - qrMm) / 2;
  const qrY = Math.max(y + 6, 150);
  const dataUri = 'data:image/png;base64,' + g.png.toString('base64');
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.roundedRect(qrX - 4, qrY - 4, qrMm + 8, qrMm + 8, 3, 3);
  doc.addImage(dataUri, 'PNG', qrX, qrY, qrMm, qrMm);

  // Instruction de scan + URL
  let yc = qrY + qrMm + 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(10, 25, 47);
  doc.text('Scannez avec l\u2019appareil photo de votre téléphone', PW / 2, yc, { align: 'center' });
  yc += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(100, 116, 139);
  doc.text('Ouvrez l\u2019appareil photo  ·  visez le code  ·  touchez le lien affiché', PW / 2, yc, { align: 'center' });
  yc += 8;
  doc.setFontSize(12);
  doc.setTextColor(37, 99, 235);
  doc.text(g.url, PW / 2, yc, { align: 'center' });

  // Pied de page
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(30, PH - 20, PW - 30, PH - 20);
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text('www.konadatagn.com  ·  contact@konadatagn.com', PW / 2, PH - 13, { align: 'center' });
}

generated.forEach((g, i) => drawFlyer(g, i === 0));

const pdfBytes = Buffer.from(doc.output('arraybuffer'));
const pdfOut = path.join(root, 'exports', 'KonaData-QR-flyers.pdf');
try {
  await writeFile(pdfOut, pdfBytes);
  console.log('PDF  :', pdfOut, `(${generated.length} flyers)`);
} catch (e) {
  if (e?.code === 'EBUSY') {
    const alt = path.join(root, 'exports', 'KonaData-QR-flyers-new.pdf');
    await writeFile(alt, pdfBytes);
    console.log('PDF verrouillé (ouvert ailleurs). Copie écrite ->', alt);
  } else {
    throw e;
  }
}
