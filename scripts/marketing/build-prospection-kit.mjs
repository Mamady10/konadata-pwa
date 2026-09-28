#!/usr/bin/env node
/**
 * Kit de prospection : fiche « Programme pilote » (PDF + PNG pour WhatsApp)
 * et présentation PowerPoint pour les organisations professionnelles et universités.
 *
 * Usage : node scripts/marketing/build-prospection-kit.mjs [--only=fiche|deck]
 * Sortie : docs/marketing/prospection/
 */
import { mkdir, readFile } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import QRCode from 'qrcode';
import PptxGenJS from 'pptxgenjs';
import { CONTACT, OFFER } from './campaign-content.mjs';
import {
  ROOT,
  CAMPAIGN,
  CAPTURES,
  WORK,
  prepareBrandAssets,
  launchBrowser,
  qrSvg,
  icon,
  esc,
  rich,
} from './campaign-html.mjs';

const OUT = path.join(ROOT, 'docs', 'marketing', 'prospection');
const KIT_WORK = path.join(WORK, 'prospection');
const only = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1];

/** Nombre de places du programme pilote, par secteur. */
const PILOT_PLACES = 10;

/** Tarifs repris de lib/marketing/landing-content.ts : à garder alignés. */
const SECTORS = [
  {
    id: 'btp',
    label: 'BTP & chantiers',
    color: '#EA580C',
    offer: OFFER.autres,
    price: '200 000 GNF',
    first: [
      'Un chantier suivi au quotidien : avancement, personnel, carburant, livraisons',
      'Votre premier rapport hebdomadaire en PDF et PowerPoint',
      'Un devis PDF avec extrait des matériaux calculé automatiquement',
    ],
  },
  {
    id: 'ecole',
    label: 'Établissements scolaires',
    color: '#4F46E5',
    offer: OFFER.ecoles,
    price: '1 500 000 GNF',
    first: [
      'Vos élèves importés à partir de vos listes existantes',
      "Les notes d'une classe saisies et ses bulletins PDF générés",
      'Le suivi des paiements de scolarité par classe',
    ],
  },
  {
    id: 'ong',
    label: 'ONG & projets',
    color: '#059669',
    offer: OFFER.autres,
    price: '500 000 GNF',
    first: [
      'Un projet paramétré : budget, activités, localités',
      'Des bénéficiaires collectés sur téléphone, même sans réseau',
      'Un premier rapport prêt pour le bailleur',
    ],
  },
  {
    id: 'pme',
    label: 'PME & commerce',
    color: '#7C3AED',
    offer: OFFER.autres,
    price: '200 000 GNF',
    first: [
      'Vos articles, stocks et clients enregistrés',
      'Ventes et dépenses saisies depuis le téléphone',
      'Votre résultat du mois en un coup d’œil',
    ],
  },
];

const WEEKS = [
  ['Semaine 1', 'Installation', 'Nous créons votre espace, importons vos listes existantes et ouvrons les comptes de votre équipe.'],
  ['Semaine 2', 'Formation', 'Une heure par rôle, sur place ou en visio. Votre équipe enregistre ses premières données réelles.'],
  ['Semaine 3', 'Premier document', 'Ensemble, nous produisons votre premier document officiel : rapport, devis, bulletins ou bilan.'],
  ['Semaine 4', 'Bilan', 'Nous mesurons le temps gagné et ce qui reste à ajuster. Vous décidez de la suite, librement.'],
];

// ---------------------------------------------------------------- fiche pilote (HTML → PDF / PNG)

const SECTOR_ICON = { btp: 'btp', ecole: 'ecole', ong: 'ong', pme: 'pme' };

function ficheCss() {
  return `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=block');
@page{size:A4;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased;color:#0F172A;background:#E2E8F0}
.page{width:794px;height:1123px;position:relative;overflow:hidden;background:#fff;page-break-after:always;display:flex;flex-direction:column}
.page:last-child{page-break-after:auto}
em{font-style:normal;background:linear-gradient(90deg,#22D3EE,#3B82F6);-webkit-background-clip:text;background-clip:text;color:transparent}
.logo{display:inline-flex;align-items:center;gap:.28em;font-weight:800;letter-spacing:-.02em;line-height:1}
.logo img{width:1.2em;height:1.2em;border-radius:.26em}
.logo .k{color:#fff}.logo .d{color:#38BDF8}
.hero{position:relative;background:#0A192F;color:#fff;padding:34px 44px 36px;overflow:hidden}
.hero .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(148,163,184,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,.08) 1px,transparent 1px);background-size:40px 40px;-webkit-mask-image:radial-gradient(ellipse at 70% 30%,#000 10%,transparent 70%)}
.hero .glow{position:absolute;width:420px;height:420px;border-radius:50%;filter:blur(90px);opacity:.35;background:#22D3EE;right:-140px;top:-180px}
.hero .top{position:relative;display:flex;justify-content:space-between;align-items:center}
.pill{display:inline-flex;align-items:center;gap:8px;padding:7px 14px;border-radius:999px;font-weight:800;font-size:12px;letter-spacing:.06em;text-transform:uppercase}
.pill.y{background:#FACC15;color:#0A192F}
.pill.o{border:1.5px solid rgba(34,211,238,.6);color:#E2E8F0;background:rgba(15,32,60,.7)}
.pill.o i{width:8px;height:8px;border-radius:50%;background:#22D3EE;box-shadow:0 0 10px #22D3EE}
.pill svg{width:15px;height:15px}
.hero h1{position:relative;font-size:40px;line-height:1.08;font-weight:800;letter-spacing:-.03em;margin:22px 0 14px;max-width:640px}
.hero p{position:relative;color:#CBD5E1;font-size:16px;line-height:1.5;font-weight:500;max-width:620px}
.body{padding:26px 44px 0;flex:1;display:flex;flex-direction:column}
h2{font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#2563EB;margin-bottom:12px}
.cards{display:flex;gap:14px}
.card{flex:1;border-radius:14px;padding:16px 16px 15px;background:#F1F5F9;border:1px solid #E2E8F0}
.card .ic{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,#22D3EE,#2563EB);margin-bottom:10px}
.card .ic svg{width:19px;height:19px}
.card b{display:block;font-size:15px;font-weight:800;margin-bottom:5px;letter-spacing:-.01em}
.card p{font-size:12.5px;line-height:1.45;color:#475569;font-weight:500}
.timeline{display:flex;flex-direction:column;gap:14px;margin-top:4px}
.wk{display:flex;gap:14px;align-items:stretch}
.wk .n{flex:none;width:96px;border-radius:12px;background:#0A192F;color:#fff;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:10px 6px}
.wk .n small{font-size:10.5px;font-weight:700;color:#7DD3FC;letter-spacing:.08em;text-transform:uppercase}
.wk .n span{font-size:24px;font-weight:900;line-height:1}
.wk .t{flex:1;border-radius:12px;border:1px solid #E2E8F0;padding:14px 18px;display:flex;flex-direction:column;justify-content:center}
.wk .t b{font-size:15px;font-weight:800;margin-bottom:3px}
.wk .t p{font-size:13px;color:#475569;line-height:1.45;font-weight:500}
.band{margin:auto -44px 0;background:linear-gradient(90deg,#0A192F,#12305A);color:#fff;padding:18px 44px;display:flex;justify-content:space-between;align-items:center;gap:16px}
.band .l b{display:block;font-size:17px;font-weight:800}
.band .l span{font-size:12.5px;color:#CBD5E1;font-weight:500}
.cta{display:inline-flex;align-items:center;gap:8px;padding:12px 18px;border-radius:999px;background:linear-gradient(90deg,#22D3EE,#3B82F6);color:#06111F;font-weight:800;font-size:14px;white-space:nowrap}
.cta svg{width:16px;height:16px}
.head2{background:#0A192F;padding:18px 44px;display:flex;justify-content:space-between;align-items:center;color:#CBD5E1;font-weight:700;font-size:13px}
.sectors{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.sec{border-radius:14px;border:1px solid #E2E8F0;padding:16px 18px 16px;position:relative;overflow:hidden}
.sec:before{content:'';position:absolute;left:0;top:0;bottom:0;width:5px;background:var(--c)}
.sec .h{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.sec .h div{display:flex;align-items:center;gap:8px;font-weight:800;font-size:14.5px;color:var(--c)}
.sec .h svg{width:19px;height:19px}
.sec .h small{font-size:11px;font-weight:800;padding:4px 9px;border-radius:999px;background:#FEF9C3;color:#854D0E;white-space:nowrap}
.sec ul{list-style:none;display:flex;flex-direction:column;gap:5px}
.sec li{display:flex;gap:7px;font-size:12.3px;line-height:1.4;color:#334155;font-weight:500}
.sec li svg{flex:none;width:14px;height:14px;margin-top:2px;color:var(--c);stroke-width:3}
.cols{display:flex;gap:14px;margin-top:18px}
.box{flex:1;border-radius:14px;background:#F1F5F9;padding:15px 16px}
.box h3{font-size:14.5px;font-weight:800;margin-bottom:8px;display:flex;align-items:center;gap:8px}
.box h3 svg{width:17px;height:17px;color:#2563EB}
.box ul{list-style:none;display:flex;flex-direction:column;gap:6px}
.box li{display:flex;gap:7px;font-size:12.5px;line-height:1.42;color:#334155;font-weight:500}
.box li svg{flex:none;width:14px;height:14px;margin-top:2px;color:#059669;stroke-width:3}
table{width:100%;border-collapse:separate;border-spacing:0;margin-top:2px;font-size:12.5px}
th{background:#0A192F;color:#fff;text-align:left;padding:8px 12px;font-weight:700}
th:first-child{border-radius:10px 0 0 0}th:last-child{border-radius:0 10px 0 0}
td{padding:8px 12px;border-bottom:1px solid #E2E8F0;font-weight:600;color:#334155}
td:nth-child(2){color:#15803D;font-weight:800}
.fine{font-size:11px;color:#64748B;font-weight:500;margin-top:7px;line-height:1.45}
.contact{margin:auto -44px 0;background:#0A192F;color:#fff;padding:20px 44px;display:flex;justify-content:space-between;align-items:center}
.contact .c{display:flex;flex-direction:column;gap:7px;font-weight:700;font-size:14px}
.contact .c span{display:inline-flex;align-items:center;gap:9px}
.contact .c svg{width:16px;height:16px;color:#22D3EE}
.contact .c b{font-size:19px;font-weight:800;margin-bottom:3px}
.qr{background:#fff;border-radius:12px;padding:9px;display:flex;flex-direction:column;align-items:center;gap:4px;color:#0A192F;font-size:10px;font-weight:800}
.qr svg{width:92px;height:92px;display:block}
`;
}

let iconDataUri = '';
const logoHtml = (size) =>
  `<div class="logo" style="font-size:${size}px"><img src="${iconDataUri}" alt=""><span><b class="k">Kona</b><b class="d">Data</b></span></div>`;
const check = () => icon('check');

async function ficheHtml() {
  iconDataUri = `data:image/png;base64,${(await readFile(path.join(WORK, 'icon.png'))).toString('base64')}`;
  const qr = await qrSvg();
  const page1 = `
<section class="page">
  <div class="hero">
    <div class="grid"></div><div class="glow"></div>
    <div class="top">${logoHtml(30)}<span class="pill y">${icon('gift')}${PILOT_PLACES} places par secteur</span></div>
    <h1>${rich('30 jours pour passer au numérique, *accompagné*.')}</h1>
    <p>Nous installons KonaData avec vos vraies données, nous formons votre équipe et nous produisons ensemble votre premier document officiel. Vous n'avez rien à paramétrer.</p>
  </div>
  <div class="body">
    <h2>Ce que vous obtenez</h2>
    <div class="cards">
      <div class="card"><div class="ic">${icon('gift')}</div><b>La période gratuite</b><p>${esc(OFFER.ecoles)} pour les écoles, ${esc(OFFER.autres)} pour les ONG, le BTP et les PME.</p></div>
      <div class="card"><div class="ic">${icon('phone')}</div><b>30 jours d'accompagnement</b><p>Installation, formation de l'équipe et suivi personnalisé sur WhatsApp, offerts.</p></div>
      <div class="card"><div class="ic">${icon('check')}</div><b>Un résultat concret</b><p>Votre premier rapport, devis, bulletin ou bilan réel, produit avec vos données.</p></div>
    </div>
    <h2 style="margin-top:24px">Comment ça se passe</h2>
    <div class="timeline">
      ${WEEKS.map(
        ([w, t, p]) =>
          `<div class="wk"><div class="n"><small>Semaine</small><span>${w.split(' ')[1]}</span></div><div class="t"><b>${esc(t)}</b><p>${esc(p)}</p></div></div>`
      ).join('')}
    </div>
    <div class="band">
      <div class="l"><b>Écoles · ONG · BTP · PME</b><span>Places limitées pour garantir un vrai accompagnement à chacun.</span></div>
      <div class="cta">Réservez : WhatsApp ${esc(CONTACT.whatsapp)} ${icon('arrow')}</div>
    </div>
  </div>
</section>`;

  const page2 = `
<section class="page">
  <div class="head2">${logoHtml(22)}<span>Programme pilote · 30 jours accompagnés</span></div>
  <div class="body" style="padding-top:22px">
    <h2>Votre premier résultat en 30 jours</h2>
    <div class="sectors">
      ${SECTORS.map(
        (s) => `<div class="sec" style="--c:${s.color}">
          <div class="h"><div>${icon(SECTOR_ICON[s.id])}${esc(s.label)}</div><small>${esc(s.offer)}</small></div>
          <ul>${s.first.map((f) => `<li>${check()}<span>${esc(f)}</span></li>`).join('')}</ul>
        </div>`
      ).join('')}
    </div>
    <div class="cols">
      <div class="box"><h3>${icon('check')}Ce que nous vous demandons</h3><ul>
        <li>${check()}<span>Désigner un référent dans votre équipe</span></li>
        <li>${check()}<span>Utiliser KonaData sur un cas réel : un chantier, une classe, un projet ou une boutique</span></li>
        <li>${check()}<span>Un retour d'expérience de 15 minutes à la fin du mois</span></li>
      </ul></div>
      <div class="box"><h3>${icon('globe')}Vos données restent les vôtres</h3><ul>
        <li>${check()}<span>Un accès personnel protégé par mot de passe pour chaque membre</span></li>
        <li>${check()}<span>Chacun ne voit que ce que vous l'autorisez à voir</span></li>
        <li>${check()}<span>Rapports en PDF, principales listes exportables vers Excel</span></li>
      </ul></div>
    </div>
    <h2 style="margin-top:20px">Après la période gratuite</h2>
    <table>
      <tr><th>Secteur</th><th>Offre de lancement</th><th>Ensuite, abonnement mensuel</th></tr>
      ${SECTORS.map((s) => `<tr><td>${esc(s.label)}</td><td>${esc(s.offer)}</td><td>à partir de ${esc(s.price)} / mois</td></tr>`).join('')}
    </table>
    <p class="fine">${esc(OFFER.rule)} Aucun paiement n'est demandé pour démarrer. Le programme pilote s'ajoute à l'offre de lancement, dans la limite de ${PILOT_PLACES} organisations par secteur.</p>
    <div class="contact">
      <div class="c"><b>Réservez votre place</b>
        <span>${icon('phone')}WhatsApp ${esc(CONTACT.whatsapp)} · ${esc(CONTACT.whatsapp2)}</span>
        <span>${icon('mail')}${esc(CONTACT.email)}</span>
        <span>${icon('globe')}${esc(CONTACT.site)}</span>
      </div>
      <div class="qr">${qr}<span>konadatagn.com</span></div>
    </div>
  </div>
</section>`;

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>${ficheCss()}</style></head><body>${page1}${page2}</body></html>`;
}

async function buildFiche(browser) {
  const html = await ficheHtml();
  const page = await browser.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);

  const pages = await page.$$('section.page');
  for (let i = 0; i < pages.length; i++) {
    await pages[i].screenshot({ path: path.join(OUT, `programme-pilote-page-${i + 1}.png`) });
  }
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: path.join(OUT, 'programme-pilote.pdf'), preferCSSPageSize: true, printBackground: true });
  await page.close();
  console.log('✓ programme-pilote.pdf + PNG');
}

// ---------------------------------------------------------------- présentation PowerPoint

const C = {
  navy: '0A192F',
  navy2: '12305A',
  cyan: '22D3EE',
  blue: '3B82F6',
  white: 'FFFFFF',
  soft: 'CBD5E1',
  muted: '94A3B8',
  yellow: 'FACC15',
};
const FONT = 'Segoe UI';

async function jpeg(src, name, width = 1600) {
  const out = path.join(KIT_WORK, name);
  await sharp(src).resize({ width, withoutEnlargement: true }).jpeg({ quality: 84 }).toFile(out);
  return out;
}

function base(pptx, notes) {
  const s = pptx.addSlide();
  s.background = { color: C.navy };
  if (notes) s.addNotes(notes);
  return s;
}

function title(s, kicker, text) {
  s.addText(kicker.toUpperCase(), { x: 0.6, y: 0.42, w: 9, h: 0.35, fontFace: FONT, fontSize: 12, bold: true, color: C.cyan, charSpacing: 3 });
  s.addText(text, { x: 0.6, y: 0.75, w: 12.1, h: 0.85, fontFace: FONT, fontSize: 30, bold: true, color: C.white });
}

function footer(s, pptx) {
  s.addText(`${CONTACT.site}   ·   WhatsApp ${CONTACT.whatsapp}`, { x: 0.6, y: 7.0, w: 8, h: 0.3, fontFace: FONT, fontSize: 10, color: C.muted });
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 7.42, w: 13.333, h: 0.08, fill: { color: C.cyan } });
}

function bulletList(s, items, box) {
  s.addText(
    items.map((t) => ({ text: t, options: { bullet: { code: '25CF' }, breakLine: true, paraSpaceAfter: 10 } })),
    { fontFace: FONT, fontSize: 17, color: C.white, valign: 'top', ...box }
  );
}

function card(s, pptx, x, y, w, h, head, body, accent = C.cyan) {
  s.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.12, fill: { color: C.white, transparency: 93 }, line: { color: C.white, transparency: 80, width: 1 } });
  s.addShape(pptx.ShapeType.rect, { x, y: y + 0.18, w: 0.07, h: h - 0.36, fill: { color: accent }, line: { color: accent } });
  s.addText(head, { x: x + 0.3, y: y + 0.2, w: w - 0.5, h: 0.55, fontFace: FONT, fontSize: 20, bold: true, color: C.white, valign: 'top' });
  s.addText(body, { x: x + 0.3, y: y + 0.8, w: w - 0.5, h: h - 0.95, fontFace: FONT, fontSize: 16, color: C.soft, valign: 'top' });
}

function sectorSlide(pptx, img, kicker, heading, items, accent, notes) {
  const s = base(pptx, notes);
  title(s, kicker, heading);
  bulletList(s, items, { x: 0.6, y: 1.85, w: 5.2, h: 4.6 });
  s.addShape(pptx.ShapeType.roundRect, { x: 6.15, y: 1.8, w: 6.6, h: 4.3, rectRadius: 0.08, fill: { color: accent }, line: { color: accent } });
  s.addImage({ path: img, x: 6.25, y: 1.9, w: 6.4, h: 4.0 });
  footer(s, pptx);
  return s;
}

async function buildDeck() {
  await mkdir(KIT_WORK, { recursive: true });
  const cap = (n) => path.join(CAPTURES, n);
  const ex = (sector, n) => path.join(CAMPAIGN, 'visuels', `exemples-${sector}`, 'paysage-1200x628', n);
  const img = {
    btp: await jpeg(cap('btp-dashboard-desktop.png'), 'btp.jpg'),
    ecole: await jpeg(cap('ecole-dashboard-desktop.png'), 'ecole.jpg'),
    ong: await jpeg(cap('ong-dashboard-desktop.png'), 'ong.jpg'),
    pme: await jpeg(cap('pme-dashboard-desktop.png'), 'pme.jpg'),
    mobile: await jpeg(cap('btp-dashboard-mobile.png'), 'mobile.jpg', 700),
    mobileEcole: await jpeg(cap('ecole-dashboard-mobile.png'), 'mobile-ecole.jpg', 700),
    mobileOng: await jpeg(cap('ong-dashboard-mobile.png'), 'mobile-ong.jpg', 700),
  };
  const iconPath = path.join(WORK, 'icon.png');
  const qr = await QRCode.toDataURL(CONTACT.url, { margin: 1, width: 600, color: { dark: '#0A192F', light: '#FFFFFF' } });

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'KonaData';
  pptx.company = 'KonaData';
  pptx.title = 'KonaData — Présentation partenaires';

  // 1. Couverture
  {
    const s = base(pptx, "Présentez-vous en une phrase, puis KonaData : une plateforme guinéenne de gestion des données pour les écoles, les ONG, les entreprises du BTP et les PME. Annoncez le déroulé : le constat, ce que fait l'outil, des exemples concrets, puis ce que nous pouvons construire ensemble.");
    s.addShape(pptx.ShapeType.ellipse, { x: 9.2, y: -2.2, w: 6, h: 6, fill: { color: C.cyan, transparency: 82 }, line: { color: C.cyan, transparency: 100 } });
    s.addImage({ path: iconPath, x: 0.6, y: 0.6, w: 0.8, h: 0.8 });
    s.addText([{ text: 'Kona', options: { color: C.white } }, { text: 'Data', options: { color: '38BDF8' } }], { x: 1.5, y: 0.62, w: 4, h: 0.75, fontFace: FONT, fontSize: 30, bold: true });
    s.addText('Digitaliser la gestion des organisations guinéennes', { x: 0.6, y: 2.3, w: 9.5, h: 1.9, fontFace: FONT, fontSize: 44, bold: true, color: C.white, valign: 'top' });
    s.addText('Écoles  ·  ONG  ·  BTP  ·  PME', { x: 0.6, y: 4.35, w: 9, h: 0.5, fontFace: FONT, fontSize: 20, bold: true, color: C.cyan });
    s.addText('Présentation et proposition de partenariat', { x: 0.6, y: 4.9, w: 9, h: 0.5, fontFace: FONT, fontSize: 18, color: C.soft });
    s.addImage({ path: img.mobile, x: 10.3, y: 1.3, w: 2.2, h: 4.76 });
    footer(s, pptx);
  }

  // 2. Le constat
  {
    const s = base(pptx, "Demandez à la salle : qui a déjà perdu une information importante parce qu'elle était dans un cahier ou dans le fichier Excel d'un collègue ? Laissez répondre. Ces quatre problèmes sont communs à tous les secteurs : l'information existe, mais elle est éparpillée et ressaisie plusieurs fois.");
    title(s, 'Le constat', 'Des données précieuses, mais éparpillées');
    const items = [
      ['Cahiers et registres', "Perdus, abîmés, illisibles : l'historique disparaît avec eux."],
      ['Fichiers Excel éparpillés', 'Chacun a sa version. Consolider prend des heures, avec des erreurs.'],
      ['Rapports en retard', 'Les mêmes chiffres ressaisis pour le client, le bailleur ou la direction.'],
      ['Décisions à l’aveugle', 'Stock, carburant, paiements : on découvre les problèmes trop tard.'],
    ];
    items.forEach(([h, b], i) => card(s, pptx, 0.6 + (i % 2) * 6.15, 1.9 + Math.floor(i / 2) * 2.45, 5.95, 2.2, h, b));
    footer(s, pptx);
  }

  // 3. KonaData en bref
  {
    const s = base(pptx, "Un seul message à retenir : une donnée saisie une seule fois sert partout, au tableau de bord, au rapport et au partenaire. Insistez sur le terrain guinéen : téléphone, 3G, saisie sans réseau, support local.");
    title(s, 'La solution', 'KonaData en bref');
    bulletList(
      s,
      [
        'Une plateforme, quatre secteurs : écoles, ONG, BTP, PME',
        'Sur ordinateur et sur téléphone, comme une application',
        'Fonctionne en 3G, saisie possible sans réseau',
        'Rapports PDF et PowerPoint générés automatiquement',
        'KonaAI : alertes et synthèses rédigées en un clic',
        'Support local, en français, sur WhatsApp',
      ],
      { x: 0.6, y: 1.85, w: 5.4, h: 4.8 }
    );
    [img.mobile, img.mobileEcole, img.mobileOng].forEach((p, i) => {
      s.addImage({ path: p, x: 6.5 + i * 2.1, y: 1.75 + (i === 1 ? 0 : 0.35), w: 1.9, h: 4.11 });
    });
    footer(s, pptx);
  }

  // 4 à 7. Secteurs
  sectorSlide(
    pptx,
    img.btp,
    'BTP & chantiers',
    'Tous vos chantiers sous contrôle',
    [
      'Suivi quotidien par chantier : avancement, personnel, carburant, livraisons',
      'Devis avec extrait des matériaux calculé à partir des dimensions',
      'Rapports hebdomadaires à annuels en PDF et PowerPoint',
      'Version sans montants pour le client',
      'Alertes sur les consommations de carburant anormales',
    ],
    'EA580C',
    "Pour un public d'ingénieurs, c'est la diapositive clé. Montrez qu'on part des données de terrain (saisies sur téléphone par le chef de chantier) pour arriver au rapport envoyé au client, sans ressaisie. Citez le devis : l'extrait des matériaux (ciment, fer, agglos) est calculé à partir des dimensions, pertes incluses."
  );
  {
    const s = base(pptx, "Montrez des documents réels produits par la plateforme (données de démonstration). Si vous avez un ordinateur, ouvrez les PDF du dossier docs/marketing/exemples/btp-rapports et btp-devis pour les faire défiler.");
    title(s, 'BTP : exemples de documents', 'Devis et rapports prêts à envoyer');
    s.addImage({ path: ex('btp', 'exemple-devis.png'), x: 0.6, y: 1.9, w: 5.95, h: 3.11 });
    s.addImage({ path: ex('btp', 'exemple-rapport.png'), x: 6.78, y: 1.9, w: 5.95, h: 3.11 });
    s.addText('Devis PDF à votre logo : lots, TVA, montant en lettres', { x: 0.6, y: 5.15, w: 5.95, h: 0.6, fontFace: FONT, fontSize: 14, color: C.soft });
    s.addText('Rapport de chantier : prévu et réalisé, photos, synthèse', { x: 6.78, y: 5.15, w: 5.95, h: 0.6, fontFace: FONT, fontSize: 14, color: C.soft });
    footer(s, pptx);
  }
  sectorSlide(
    pptx,
    img.ecole,
    'Établissements scolaires',
    'Toute l’école sur un tableau de bord',
    ['Inscriptions et dossiers des élèves', 'Notes, moyennes et bulletins PDF automatiques', 'Suivi des paiements de scolarité par classe', 'Espace parents, élèves et enseignants', `Offre de lancement : ${OFFER.ecoles}`],
    '4F46E5',
    "Point fort pour les directeurs : les bulletins d'une classe entière générés en quelques minutes, et une vue claire des paiements de scolarité. Rappelez les 12 mois gratuits pour les écoles."
  );
  sectorSlide(
    pptx,
    img.ong,
    'ONG & projets',
    'Du terrain au rapport bailleur',
    ['Projets, activités et budget prévu / dépensé', 'Bénéficiaires par localité, cartographie', 'Collecte sur téléphone et par QR code, même sans réseau', 'Sondages et enquêtes', 'Rapports prêts à partager avec les bailleurs'],
    '059669',
    "Beaucoup d'ingénieurs travaillent sur des projets d'ONG (eau, assainissement, infrastructures). Insistez sur la fin de la ressaisie : ce qui est collecté sur le terrain alimente directement les indicateurs et le rapport."
  );
  sectorSlide(
    pptx,
    img.pme,
    'PME & commerce',
    'Votre résultat du mois, en direct',
    ['Ventes, achats et dépenses', 'Stocks avec alerte quand un article est bas', 'Crédits clients et dettes fournisseurs', 'Plusieurs boutiques suivies séparément', 'Recommandations automatiques de KonaAI'],
    '7C3AED',
    "Question simple à poser : savez-vous exactement ce que vous avez gagné le mois dernier, une fois les achats et les dépenses retirés ? KonaData répond à cette question en temps réel."
  );

  // 9. Exemples tous secteurs
  {
    const s = base(pptx, "Ces documents sont générés par la plateforme à partir de données de démonstration. Ils montrent le niveau de qualité que vos membres peuvent remettre à leurs clients, parents d'élèves ou bailleurs.");
    title(s, 'Exemples de documents', 'Des documents professionnels, sans mise en page');
    const trio = [
      [ex('ecole', 'exemple-bulletin.png'), 'Bulletin scolaire'],
      [ex('ong', 'exemple-bailleur.png'), 'Rapport bailleur'],
      [ex('pme', 'exemple-analyse.png'), 'Analyse financière PME'],
    ];
    trio.forEach(([p, label], i) => {
      const x = 0.6 + i * 4.1;
      s.addImage({ path: p, x, y: 2.1, w: 3.9, h: 2.04 });
      s.addText(label, { x, y: 4.25, w: 3.9, h: 0.5, fontFace: FONT, fontSize: 15, bold: true, color: C.white, align: 'center' });
    });
    footer(s, pptx);
  }

  // 10. Pensé pour la Guinée
  {
    const s = base(pptx, "Répondez ici aux objections habituelles avant qu'elles ne soient posées : le réseau, la langue, le prix, et à qui s'adresser en cas de problème.");
    title(s, 'Pensé pour la Guinée', 'Un outil conçu pour notre terrain');
    const items = [
      ['3G et hors ligne', 'Les saisies faites sans réseau partent automatiquement au retour de la connexion.'],
      ['Français et francs guinéens', 'Montants en GNF, montant en lettres, formats de documents habituels.'],
      ['Support local', 'Une équipe joignable sur WhatsApp, qui peut se déplacer pour former.'],
      ['Prix adaptés', 'Période gratuite au lancement, puis abonnement mensuel accessible.'],
    ];
    items.forEach(([h, b], i) => card(s, pptx, 0.6 + (i % 2) * 6.15, 1.9 + Math.floor(i / 2) * 2.45, 5.95, 2.2, h, b));
    footer(s, pptx);
  }

  // 11. Partenariat organisations professionnelles
  {
    const s = base(pptx, "Adaptez cette diapositive à l'organisation en face de vous. L'objectif est de repartir avec une date d'atelier ou une liste de membres volontaires pour le programme pilote. Toute communication commune (logo, citation) se fait uniquement avec leur accord écrit.");
    title(s, 'Proposition de partenariat', 'Pour les organisations professionnelles');
    const items = [
      ['Atelier pratique pour vos membres', '1 heure, sur place ou en ligne : « Du métré au rapport client », « Du terrain au rapport bailleur »…'],
      ['Programme pilote réservé', `Accompagnement de 30 jours pour vos adhérents, dans la limite de ${PILOT_PLACES} organisations par secteur.`],
      ['Un référent KonaData dédié', 'Un interlocuteur unique pour vos membres, joignable sur WhatsApp.'],
      ['Retours d’expérience', 'Présentation des résultats des pilotes à vos membres, avec leur accord.'],
    ];
    items.forEach(([h, b], i) => card(s, pptx, 0.6 + (i % 2) * 6.15, 1.9 + Math.floor(i / 2) * 2.45, 5.95, 2.2, h, b));
    footer(s, pptx);
  }

  // 12. Partenariat universités
  {
    const s = base(pptx, "Pour une université ou une école professionnelle : les étudiants découvrent des outils utilisés en entreprise et deviennent, une fois embauchés, les meilleurs prescripteurs. Proposez une première séance de travaux pratiques à une date précise.");
    title(s, 'Proposition de partenariat', 'Pour les universités et écoles professionnelles');
    const items = [
      ['Travaux pratiques', 'Séance sur un compte de démonstration : métré et devis, suivi de chantier, rapports.'],
      ['Ambassadeurs étudiants', 'Des étudiants formés qui présentent l’outil dans leur réseau et leurs stages.'],
      ['Cas d’étude réels', 'Des jeux de données de démonstration pour les cours de gestion de projet.'],
      ['Liens avec les entreprises', 'Mise en relation avec les entreprises utilisatrices, à discuter ensemble.'],
    ];
    items.forEach(([h, b], i) => card(s, pptx, 0.6 + (i % 2) * 6.15, 1.9 + Math.floor(i / 2) * 2.45, 5.95, 2.2, h, b));
    footer(s, pptx);
  }

  // 13. Programme pilote
  {
    const s = base(pptx, "Le programme pilote lève la principale barrière : la peur de se lancer seul. Nous faisons l'installation et la formation ; l'organisation n'a qu'à utiliser l'outil sur un cas réel. Distribuez la fiche programme-pilote.pdf.");
    title(s, 'Programme pilote', '30 jours pour passer au numérique, accompagné');
    WEEKS.forEach(([w, t, p], i) => {
      const x = 0.6 + i * 3.1;
      s.addShape(pptx.ShapeType.roundRect, { x, y: 2.0, w: 2.9, h: 3.6, rectRadius: 0.12, fill: { color: C.white, transparency: 93 }, line: { color: C.white, transparency: 80, width: 1 } });
      s.addShape(pptx.ShapeType.ellipse, { x: x + 0.25, y: 2.25, w: 0.75, h: 0.75, fill: { color: C.cyan }, line: { color: C.cyan } });
      s.addText(String(i + 1), { x: x + 0.25, y: 2.25, w: 0.75, h: 0.75, fontFace: FONT, fontSize: 22, bold: true, color: C.navy, align: 'center', valign: 'middle' });
      s.addText(w.toUpperCase(), { x: x + 0.25, y: 3.15, w: 2.5, h: 0.3, fontFace: FONT, fontSize: 11, bold: true, color: C.cyan, charSpacing: 2 });
      s.addText(t, { x: x + 0.25, y: 3.45, w: 2.5, h: 0.5, fontFace: FONT, fontSize: 18, bold: true, color: C.white });
      s.addText(p, { x: x + 0.25, y: 3.95, w: 2.5, h: 1.55, fontFace: FONT, fontSize: 12.5, color: C.soft, valign: 'top' });
    });
    s.addText(`En plus de la période gratuite : ${OFFER.ecoles} pour les écoles, ${OFFER.autres} pour les ONG, le BTP et les PME.`, {
      x: 0.6, y: 5.9, w: 12.1, h: 0.5, fontFace: FONT, fontSize: 15, bold: true, color: C.yellow,
    });
    footer(s, pptx);
  }

  // 14. Offre et tarifs
  {
    const s = base(pptx, "Soyez transparent sur les prix : c'est rassurant. La période gratuite s'active une seule fois, dans les 2 mois qui suivent l'inscription. Aucun paiement n'est demandé pour démarrer.");
    title(s, 'Offre et tarifs', 'Démarrer sans risque');
    const head = (t) => ({ text: t, options: { bold: true, color: C.white, fill: { color: C.navy2 } } });
    const rows = [
      [head('Secteur'), head('Offre de lancement'), head('Ensuite, abonnement mensuel')],
      ...SECTORS.map((sec) => [
        { text: sec.label, options: { color: C.white } },
        { text: sec.offer, options: { bold: true, color: '4ADE80' } },
        { text: `à partir de ${sec.price} / mois`, options: { color: C.soft } },
      ]),
    ];
    s.addTable(rows, { x: 0.6, y: 1.95, w: 12.1, colW: [4.2, 3.6, 4.3], fontFace: FONT, fontSize: 16, rowH: 0.62, border: { type: 'solid', color: '1E3A5F', pt: 1 }, fill: { color: '0F2442' } });
    s.addText(`${OFFER.rule} Aucun paiement n'est demandé pour démarrer.`, { x: 0.6, y: 5.35, w: 12.1, h: 0.5, fontFace: FONT, fontSize: 14, color: C.soft });
    footer(s, pptx);
  }

  // 15. Contact
  {
    const s = base(pptx, "Terminez par une proposition concrète : une date d'atelier, une séance de travaux pratiques ou une liste de membres volontaires pour le pilote. Laissez le QR code affiché pendant les questions.");
    s.addShape(pptx.ShapeType.ellipse, { x: -2, y: 3.5, w: 6, h: 6, fill: { color: C.blue, transparency: 85 }, line: { color: C.blue, transparency: 100 } });
    s.addText('Construisons ensemble', { x: 0.6, y: 1.2, w: 8, h: 0.9, fontFace: FONT, fontSize: 40, bold: true, color: C.white });
    s.addText('Prochaine étape : fixons une date d’atelier ou de démonstration.', { x: 0.6, y: 2.15, w: 8, h: 0.6, fontFace: FONT, fontSize: 18, color: C.soft });
    s.addText(
      [
        { text: `WhatsApp  ${CONTACT.whatsapp}  ·  ${CONTACT.whatsapp2}`, options: { breakLine: true } },
        { text: CONTACT.email, options: { breakLine: true } },
        { text: CONTACT.site },
      ],
      { x: 0.6, y: 3.3, w: 8, h: 1.8, fontFace: FONT, fontSize: 20, bold: true, color: C.white, paraSpaceAfter: 12, valign: 'top' }
    );
    s.addText(CONTACT.slogan, { x: 0.6, y: 5.5, w: 8, h: 0.5, fontFace: FONT, fontSize: 16, italic: true, color: C.cyan });
    s.addShape(pptx.ShapeType.roundRect, { x: 9.3, y: 1.5, w: 3.4, h: 3.9, rectRadius: 0.15, fill: { color: C.white }, line: { color: C.white } });
    s.addImage({ data: qr, x: 9.5, y: 1.7, w: 3.0, h: 3.0 });
    s.addText('konadatagn.com', { x: 9.3, y: 4.75, w: 3.4, h: 0.45, fontFace: FONT, fontSize: 14, bold: true, color: C.navy, align: 'center' });
    footer(s, pptx);
  }

  const file = path.join(OUT, 'KONADATA-PRESENTATION-PARTENAIRES.pptx');
  await pptx.writeFile({ fileName: file });
  console.log('✓ KONADATA-PRESENTATION-PARTENAIRES.pptx');
}

// ---------------------------------------------------------------- main
await mkdir(OUT, { recursive: true });
await prepareBrandAssets();
if (!only || only === 'fiche') {
  const browser = await launchBrowser();
  try {
    await buildFiche(browser);
  } finally {
    await browser.close();
  }
}
if (!only || only === 'deck') await buildDeck();
