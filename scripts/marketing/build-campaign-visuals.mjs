#!/usr/bin/env node
/**
 * Génère les visuels de la campagne KonaData (HTML → PNG/PDF via Playwright).
 *
 * Entrées : docs/marketing/campagne/photos (photos en situation)
 *           docs/marketing/campagne/captures (npm run marketing:captures)
 * Sorties : docs/marketing/campagne/visuels/
 *
 * Usage : node scripts/marketing/build-campaign-visuals.mjs [--only=01-marque,02-offre]
 */
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { ACCENTS, CAROUSEL, CONTACT, OFFER, POSTERS, POSTS, SECTOR_LABELS } from './campaign-content.mjs';

import {
  CAMPAIGN,
  CSS,
  WORK,
  badge,
  bullets,
  capture,
  chips,
  cta,
  em,
  esc,
  foot,
  glows,
  icon,
  laptop,
  launchBrowser,
  logo,
  phone,
  photo,
  prepareBrandAssets,
  qrSvg,
  rich,
  url,
  work,
  kicker,
} from './campaign-html.mjs';

const OUT = path.join(CAMPAIGN, 'visuels');

const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const ONLY = onlyArg ? onlyArg.slice(7).split(',') : null;

const FORMATS = {
  carre: { W: 1080, H: 1080, pad: 70, h1: 64, sub: 28, body: 26, logo: 38, dir: 'carre-1080x1080' },
  story: { W: 1080, H: 1920, pad: 80, h1: 86, sub: 36, body: 32, logo: 46, dir: 'story-1080x1920' },
  paysage: { W: 1200, H: 628, pad: 48, h1: 44, sub: 20, body: 19, logo: 28, dir: 'paysage-1200x628' },
  a4: { W: 1240, H: 1754, pad: 90, h1: 92, sub: 38, body: 32, logo: 54, dir: 'affiches-a4' },
};

function page(f, accent, body) {
  const [a1, a2] = ACCENTS[accent];
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>${CSS}
:root{--a1:${a1};--a2:${a2}}</style></head><body>
<div class="cv" style="width:${f.W}px;height:${f.H}px">${body}</div>
<script>
window.__fit = () => {
  const out = [];
  for (const el of document.querySelectorAll('[data-fit]')) {
    let fs = parseFloat(getComputedStyle(el).fontSize), start = fs, n = 0;
    while (el.scrollHeight > el.clientHeight + 1 && n++ < 60) {
      fs *= 0.97; el.style.fontSize = fs + 'px';
    }
    if (fs < start) out.push(Math.round((fs / start) * 100));
  }
  return out;
};
</script></body></html>`;
}

// ---------------------------------------------------------------- layouts
function layoutPhoto(p, fk) {
  const f = FORMATS[fk];
  const B = f.body;
  const text = (withBullets = true) => `
    ${kicker(p.kicker)}
    <h1 style="font-size:${em(f.h1, B)}">${rich(p.title)}</h1>
    ${p.sub ? `<p class="sub" style="font-size:${em(f.sub, B)}">${esc(p.sub)}</p>` : ''}
    ${withBullets && p.bullets ? bullets(p.bullets) : ''}`;

  if (fk === 'carre') {
    return `
      <img class="abs" src="${photo(p.photo)}" style="inset:0;width:100%;height:100%;object-fit:cover;object-position:72% center">
      <div class="abs" style="inset:0;background:linear-gradient(90deg,rgba(10,25,47,.97) 0%,rgba(10,25,47,.92) 40%,rgba(10,25,47,.45) 62%,rgba(10,25,47,0) 80%)"></div>
      <div class="abs" style="inset:0;background:linear-gradient(0deg,rgba(10,25,47,.85) 0%,rgba(10,25,47,0) 26%)"></div>
      ${p.badge ? `<div class="abs" style="right:${f.pad}px;top:${f.pad}px;font-size:${B}px">${badge(p.badge)}</div>` : ''}
      <div class="abs col" data-fit style="left:${f.pad}px;top:${f.pad}px;bottom:${f.pad}px;width:600px;gap:${em(26, B)};font-size:${B}px">
        ${logo(em(f.logo, B))}
        <div class="fill"></div>
        ${text()}
        <div class="fill"></div>
        ${cta(p.cta)}
        ${foot()}
      </div>`;
  }
  if (fk === 'story' || fk === 'a4') {
    const photoH = fk === 'story' ? 1180 : 960;
    const top = fk === 'story' ? 1000 : 760;
    const bottom = fk === 'story' ? f.pad : 250 + 56;
    return `
      <img class="abs" src="${photo(p.photo)}" style="left:0;top:0;width:100%;height:${photoH}px;object-fit:cover;object-position:62% 30%">
      <div class="abs" style="left:0;top:0;width:100%;height:${photoH}px;background:linear-gradient(180deg,rgba(10,25,47,.6) 0%,rgba(10,25,47,0) 16%,rgba(10,25,47,0) 55%,#0A192F 99%)"></div>
      <div class="abs" style="left:${f.pad}px;top:${f.pad}px">${logo(f.logo)}</div>
      ${p.badge ? `<div class="abs" style="right:${f.pad}px;top:${f.pad - 6}px;font-size:${B}px">${badge(p.badge)}</div>` : ''}
      <div class="abs col" data-fit style="left:${f.pad}px;right:${f.pad}px;top:${top}px;bottom:${bottom}px;gap:${em(30, B)};font-size:${B}px">
        ${text()}
        <div class="fill"></div>
        ${cta(p.cta)}
        ${fk === 'story' ? foot() : ''}
      </div>
      ${fk === 'a4' ? posterFoot(f) : ''}`;
  }
  // paysage
  return `
    <img class="abs" src="${photo(p.photo)}" style="right:0;top:0;width:62%;height:100%;object-fit:cover;object-position:75% 35%">
    <div class="abs" style="inset:0;background:linear-gradient(90deg,#0A192F 0%,#0A192F 40%,rgba(10,25,47,.55) 56%,rgba(10,25,47,0) 76%)"></div>
    ${p.badge ? `<div class="abs" style="right:${f.pad}px;top:${f.pad}px;font-size:${B}px">${badge(p.badge)}</div>` : ''}
    <div class="abs col" data-fit style="left:${f.pad}px;top:${f.pad}px;bottom:${f.pad}px;width:600px;gap:${em(18, B)};font-size:${B}px">
      ${logo(em(f.logo, B))}
      <div class="fill"></div>
      ${text(false)}
      <div class="fill"></div>
      ${cta(p.cta)}
      ${foot()}
    </div>`;
}

let QR_SVG = '';
function posterFoot(f) {
  return `
    <div class="abs poster-foot" style="left:0;right:0;bottom:0;height:250px;padding:0 ${f.pad}px;font-size:28px;gap:48px">
      <div class="col" style="gap:14px;flex:none">${logo(46, 'light')}<span style="color:#475569;font-weight:600;font-size:22px">${CONTACT.slogan}</span></div>
      <div class="c" style="flex:1">
        <span>${icon('globe')}${CONTACT.site}</span>
        <span>${icon('phone')}WhatsApp ${CONTACT.whatsapp}</span>
        <span>${icon('phone')}WhatsApp ${CONTACT.whatsapp2}</span>
        <span>${icon('mail')}${CONTACT.email}</span>
      </div>
      <div class="qr"><div style="width:150px;height:150px">${QR_SVG}</div>Scannez-moi</div>
    </div>`;
}

function devices(p, lapW, phoneW, lapPos, phonePos) {
  const lap = `<div class="abs" style="${lapPos}">${laptop(capture(p.desktop), lapW)}</div>`;
  if (p.card) {
    return `${lap}<div class="abs card-img" style="${phonePos};width:${phoneW}px"><img src="${work(p.card)}"></div>`;
  }
  const ph = p.mobile ? `<div class="abs" style="${phonePos}">${phone(capture(p.mobile), phoneW)}</div>` : '';
  return lap + ph;
}

function layoutProduct(p, fk, opts = {}) {
  const f = FORMATS[fk];
  const B = f.body;
  const topRight = opts.counter
    ? `<span class="counter">${opts.counter}</span>`
    : `<span class="foot" style="font-size:${em(20, B)}"><span>${icon('globe')}${CONTACT.site}</span></span>`;

  if (fk === 'carre') {
    const cardW = p.card ? 760 : 205;
    const cardPos = p.card ? 'right:24px;top:760px' : 'right:52px;top:560px';
    return `${glows()}
      <div class="abs col" data-fit style="left:${f.pad}px;right:${f.pad}px;top:${f.pad}px;height:${500 - f.pad}px;gap:${em(22, B)};font-size:${B}px">
        <div style="display:flex;justify-content:space-between;align-items:center">${logo(em(f.logo, B))}${topRight}</div>
        <div class="fill"></div>
        ${kicker(p.kicker)}
        <h1 style="font-size:${em(f.h1 - 4, B)}">${rich(p.title)}</h1>
        ${chips(p.chips)}
      </div>
      ${devices(p, 820, cardW, `left:${f.pad - 10}px;top:540px`, cardPos)}
      ${p.badge ? `<div class="abs" style="right:290px;top:492px;font-size:${B}px;z-index:3">${badge(p.badge)}</div>` : ''}`;
  }
  if (fk === 'story') {
    const cardW = p.card ? 900 : 250;
    const cardPos = p.card ? 'right:40px;top:1210px' : 'right:48px;top:930px';
    return `${glows()}
      <div class="abs col" data-fit style="left:${f.pad}px;right:${f.pad}px;top:${f.pad}px;height:${760 - f.pad}px;gap:${em(28, B)};font-size:${B}px">
        <div style="display:flex;justify-content:space-between;align-items:center">${logo(em(f.logo, B))}${opts.counter ? topRight : ''}</div>
        <div class="fill"></div>
        ${kicker(p.kicker)}
        <h1 style="font-size:${em(f.h1, B)}">${rich(p.title)}</h1>
        ${chips(p.chips)}
      </div>
      ${devices(p, 930, cardW, `left:50px;top:820px`, cardPos)}
      ${p.badge ? `<div class="abs" style="right:${f.pad}px;top:790px;font-size:${B}px;z-index:3">${badge(p.badge)}</div>` : ''}
      <div class="abs col" data-fit style="left:${f.pad}px;right:${f.pad}px;top:1500px;bottom:${f.pad}px;gap:${em(30, B)};font-size:${B}px">
        ${bullets(p.bullets)}
        <div class="fill"></div>
        ${cta(p.cta === CONTACT.site.replace('www.', '') ? 'Essai gratuit sur konadatagn.com' : p.cta)}
        ${foot()}
      </div>`;
  }
  // paysage
  const cardW = p.card ? 480 : 140;
  const cardPos = p.card ? 'right:20px;top:400px' : 'right:34px;top:210px';
  return `${glows()}
    <div class="abs col" data-fit style="left:${f.pad}px;top:${f.pad}px;bottom:${f.pad}px;width:520px;gap:${em(18, B)};font-size:${B}px">
      ${logo(em(f.logo, B))}
      <div class="fill"></div>
      ${kicker(p.kicker)}
      <h1 style="font-size:${em(f.h1, B)}">${rich(p.title)}</h1>
      ${chips(p.chips)}
      <div class="fill"></div>
      ${foot()}
    </div>
    ${devices(p, 560, cardW, 'left:600px;top:120px', cardPos)}
    ${p.badge ? `<div class="abs" style="right:${f.pad}px;top:${f.pad - 10}px;font-size:${B}px;z-index:3">${badge(p.badge)}</div>` : ''}`;
}

function layoutPhones(p, fk) {
  const f = FORMATS[fk];
  const B = f.body;
  const [m1, m2, m3] = p.phones.map(capture);
  const textBlock = (extra = '') => `
    ${kicker(p.kicker)}
    <h1 style="font-size:${em(f.h1, B)}">${rich(p.title)}</h1>
    ${bullets(p.bullets)}${extra}`;

  if (fk === 'carre') {
    return `${glows()}
      <div class="abs col" data-fit style="left:${f.pad}px;top:${f.pad}px;bottom:${f.pad}px;width:520px;gap:${em(26, B)};font-size:${B}px">
        ${logo(em(f.logo, B))}
        <div class="fill"></div>
        ${textBlock()}
        <div class="fill"></div>
        ${cta('Essai gratuit')}
        ${foot()}
      </div>
      <div class="abs" style="left:590px;top:130px;transform:rotate(-6deg)">${phone(m1, 250)}</div>
      <div class="abs" style="left:770px;top:300px;transform:rotate(5deg)">${phone(m2, 250)}</div>`;
  }
  if (fk === 'story') {
    return `${glows()}
      <div class="abs col" data-fit style="left:${f.pad}px;right:${f.pad}px;top:${f.pad}px;height:${900 - f.pad}px;gap:${em(30, B)};font-size:${B}px">
        ${logo(em(f.logo, B))}
        <div class="fill"></div>
        ${textBlock()}
      </div>
      <div class="abs" style="left:60px;top:1030px;transform:rotate(-7deg)">${phone(m1, 290)}</div>
      <div class="abs" style="left:730px;top:1030px;transform:rotate(7deg)">${phone(m3, 290)}</div>
      <div class="abs" style="left:375px;top:950px;z-index:2">${phone(m2, 330)}</div>
      <div class="abs" style="left:0;right:0;bottom:0;height:420px;background:linear-gradient(0deg,#0A192F 30%,rgba(10,25,47,0));z-index:3"></div>
      <div class="abs col" style="left:${f.pad}px;right:${f.pad}px;bottom:${f.pad}px;gap:26px;font-size:${B}px;z-index:4;align-items:center">
        ${cta(p.cta)}
        ${foot()}
      </div>`;
  }
  return `${glows()}
    <div class="abs col" data-fit style="left:${f.pad}px;top:${f.pad}px;bottom:${f.pad}px;width:640px;gap:${em(16, B)};font-size:${B}px">
      ${logo(em(f.logo, B))}
      <div class="fill"></div>
      ${textBlock()}
      <div class="fill"></div>
      ${foot()}
    </div>
    <div class="abs" style="left:760px;top:70px;transform:rotate(-6deg)">${phone(m1, 170)}</div>
    <div class="abs" style="left:950px;top:150px;transform:rotate(5deg)">${phone(m2, 170)}</div>`;
}

function offerCards(direction) {
  return `<div style="display:flex;flex-direction:${direction};gap:.8em">
    <div class="ocard"><div class="l">${icon('ecole')}Établissements</div><div class="v"><em>12 mois</em> gratuits</div></div>
    <div class="ocard"><div class="l">${icon('btp')}ONG · BTP · PME</div><div class="v"><em>6 mois</em> gratuits</div></div>
  </div>`;
}

function layoutOffer(p, fk) {
  const f = FORMATS[fk];
  const B = f.body;
  const big = `<h1 style="font-size:${em(fk === 'paysage' ? 58 : fk === 'story' ? 128 : 100, B)};line-height:.98">${rich(p.title)}</h1>`;
  const deco = `<div class="abs" style="right:-4%;top:${fk === 'story' ? '8%' : '-6%'};font-weight:900;font-size:${f.H * (fk === 'paysage' ? 1.1 : 0.62)}px;line-height:1;color:transparent;-webkit-text-stroke:3px rgba(52,211,153,.14);letter-spacing:-.06em">12</div>`;
  if (fk === 'paysage') {
    return `${glows()}${deco}
      <div class="abs col" data-fit style="left:${f.pad}px;top:${f.pad}px;bottom:${f.pad}px;width:560px;gap:${em(18, B)};font-size:${B}px">
        ${logo(em(f.logo, B))}
        <div class="fill"></div>
        ${kicker(p.kicker)}
        ${big}
        <p class="fine">${esc(OFFER.rule)}</p>
        <div class="fill"></div>
        ${foot()}
      </div>
      <div class="abs col" style="left:660px;right:${f.pad}px;top:150px;font-size:${B + 2}px;gap:18px">${offerCards('column')}${cta('konadatagn.com')}</div>`;
  }
  return `${glows()}${deco}
    <div class="abs col" data-fit style="left:${f.pad}px;right:${f.pad}px;top:${f.pad}px;bottom:${f.pad}px;gap:${em(fk === 'story' ? 40 : 28, B)};font-size:${B}px">
      ${logo(em(f.logo, B))}
      <div class="fill"></div>
      ${kicker(p.kicker)}
      ${big}
      ${offerCards(fk === 'story' ? 'column' : 'row')}
      <p class="fine">${esc(OFFER.rule)} Ensuite, abonnement mensuel.</p>
      <div class="fill"></div>
      ${cta(p.cta)}
      ${foot()}
    </div>`;
}

function layoutSteps(p, fk) {
  const f = FORMATS[fk];
  const B = fk === 'story' ? 40 : f.body;
  const steps = `<div class="steps" style="${fk === 'paysage' ? 'flex-direction:row' : ''}">${p.steps
    .map(([t, d], i) => `<div class="step" style="${fk === 'paysage' ? 'flex:1;flex-direction:column' : ''}"><div class="n">${i + 1}</div><div><b>${esc(t)}</b><p>${esc(d)}</p></div></div>`)
    .join('')}</div>`;
  return `${glows()}
    <div class="abs col" data-fit style="left:${f.pad}px;right:${f.pad}px;top:${f.pad}px;bottom:${f.pad}px;gap:${em(fk === 'paysage' ? 16 : 30, B)};font-size:${B}px">
      <div style="display:flex;justify-content:space-between;align-items:center">${logo(em(f.logo, B))}${fk === 'paysage' ? '' : `<div style="font-size:.9em">${badge('Jusqu’à 12 mois gratuits')}</div>`}</div>
      <div class="fill"></div>
      ${kicker(p.kicker)}
      <h1 style="font-size:${em(f.h1, B)}">${rich(p.title)}</h1>
      ${steps}
      <div class="fill"></div>
      <div style="display:flex;align-items:center;gap:1.2em;flex-wrap:wrap">${cta(p.cta)}${fk === 'paysage' ? foot() : ''}</div>
      ${fk === 'paysage' ? '' : foot()}
    </div>`;
}

function carouselCover(fk) {
  const f = FORMATS[fk];
  const B = f.body;
  const c = CAROUSEL.cover;
  const tiles = ['ecole', 'ong', 'btp', 'pme']
    .map((s) => {
      const [a1, a2] = ACCENTS[s];
      return `<div class="tile" style="background:linear-gradient(135deg,${a1},${a2})">${icon(s)}<span>${esc(SECTOR_LABELS[s])}</span></div>`;
    })
    .join('');
  return `${glows()}
    <div class="abs col" data-fit style="left:${f.pad}px;right:${f.pad}px;top:${f.pad}px;bottom:${f.pad}px;gap:${em(28, B)};font-size:${B}px">
      <div style="display:flex;justify-content:space-between;align-items:center">${logo(em(f.logo, B))}<span class="counter">1/6</span></div>
      <div class="fill"></div>
      ${kicker(c.kicker)}
      <h1 style="font-size:${em(88, B)}">${rich(c.title)}</h1>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.7em;height:${em(330, B)}">${tiles}</div>
      <div class="fill"></div>
      <div style="display:flex;justify-content:space-between;align-items:center">${foot()}<span class="counter">Glissez →</span></div>
    </div>`;
}

function banner(kind) {
  const dims = {
    'facebook-couverture': [1640, 624],
    'linkedin-couverture': [1584, 396],
    'linkedin-page': [1128, 191],
  }[kind];
  const [W, H] = dims;
  const f = { W, H };
  let body;
  if (kind === 'facebook-couverture') {
    body = `${glows()}
      <div class="abs col" style="left:90px;top:0;bottom:0;width:780px;justify-content:center;gap:26px;font-size:28px">
        ${logo(64)}
        <h1 style="font-size:54px">La plateforme de <em>gestion des données</em> pensée pour la Guinée.</h1>
        ${chips(['Écoles', 'ONG', 'BTP', 'PME', '3G/4G', 'IA intégrée'])}
      </div>
      <div class="abs" style="left:930px;top:70px">${laptop(capture('btp-dashboard-desktop.png'), 620)}</div>
      <div class="abs" style="left:1420px;top:190px">${phone(capture('ecole-dashboard-mobile.png'), 170)}</div>`;
  } else if (kind === 'linkedin-couverture') {
    body = `${glows()}
      <div class="abs col" style="left:430px;top:0;bottom:0;width:620px;justify-content:center;gap:16px;font-size:22px">
        <h1 style="font-size:40px">Vos données, <em>simples, connectées, locales.</em></h1>
        ${chips(['Écoles', 'ONG', 'BTP', 'PME'])}
      </div>
      <div class="abs" style="left:1110px;top:50px">${laptop(capture('ong-dashboard-desktop.png'), 420)}</div>`;
  } else {
    body = `${glows()}
      <div class="abs" style="left:40px;top:0;bottom:0;display:flex;align-items:center;gap:40px;font-size:18px">
        ${logo(40)}
        <span style="font-size:22px;font-weight:700;color:#CBD5E1">${CONTACT.slogan} <em>Écoles · ONG · BTP · PME</em></span>
      </div>`;
  }
  return { f, body };
}

function avatar() {
  const f = { W: 800, H: 800 };
  const body = `<div class="abs" style="inset:0;background:radial-gradient(circle at 50% 40%,#133056,#0A192F 70%)"></div>
    <img class="abs" src="${work('icon.png')}" style="left:150px;top:150px;width:500px;height:500px;border-radius:110px">`;
  return { f, body };
}

// ---------------------------------------------------------------- préparation
async function prepareAssets() {
  await prepareBrandAssets();
  QR_SVG = await qrSvg();
}

// ---------------------------------------------------------------- rendu

async function render(browser, { html, W, H, out, scale = 1, pdf = false }) {
  const htmlFile = path.join(WORK, 'html', path.basename(out).replace(/\.png$/, '.html'));
  await mkdir(path.dirname(htmlFile), { recursive: true });
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(htmlFile, html, 'utf8');
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: scale });
  const pg = await ctx.newPage();
  await pg.goto(url(htmlFile), { waitUntil: 'load' });
  await pg.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images).map((i) => (i.complete ? null : new Promise((r) => (i.onload = i.onerror = r)))));
  });
  const shrunk = await pg.evaluate(() => window.__fit());
  await pg.screenshot({ path: out, clip: { x: 0, y: 0, width: W, height: H } });
  if (pdf) {
    await pg.pdf({
      path: out.replace(/\.png$/, '.pdf'),
      width: '210mm',
      height: '297mm',
      printBackground: true,
      scale: 793.7 / W,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
  }
  await ctx.close();
  const note = shrunk.length ? `  (texte réduit à ${shrunk.join('/')} %)` : '';
  console.log('  ✓', path.relative(OUT, out) + note);
}

const LAYOUTS = { photo: layoutPhoto, product: layoutProduct, phones: layoutPhones, offer: layoutOffer, steps: layoutSteps };

async function main() {
  await prepareAssets();
  const browser = await launchBrowser();
  const byId = Object.fromEntries(POSTS.map((p) => [p.id, p]));

  for (const p of POSTS) {
    if (ONLY && !ONLY.includes(p.id)) continue;
    console.log(`\n🖼  ${p.id}`);
    for (const fk of ['carre', 'story', 'paysage']) {
      const f = FORMATS[fk];
      const html = page(f, p.accent, LAYOUTS[p.layout](p, fk));
      await render(browser, { html, W: f.W, H: f.H, out: path.join(OUT, f.dir, `${p.id}.png`) });
    }
    if (POSTERS.includes(p.id)) {
      const f = FORMATS.a4;
      const html = page(f, p.accent, layoutPhoto(p, 'a4'));
      await render(browser, { html, W: f.W, H: f.H, scale: 2, pdf: true, out: path.join(OUT, f.dir, `affiche-${p.id}.png`) });
    }
  }

  if (!ONLY || ONLY.includes('carrousel')) {
    console.log('\n🎠 Carrousel');
    const f = FORMATS.carre;
    const dir = path.join(OUT, 'carrousel-secteurs');
    await render(browser, { html: page(f, 'brand', carouselCover('carre')), W: f.W, H: f.H, out: path.join(dir, '1-couverture.png') });
    for (const [i, id] of CAROUSEL.slides.entries()) {
      const p = byId[id];
      const html = page(f, p.accent, layoutProduct(p, 'carre', { counter: `${i + 2}/6` }));
      await render(browser, { html, W: f.W, H: f.H, out: path.join(dir, `${i + 2}-${id.split('-')[1]}.png`) });
    }
    const end = byId[CAROUSEL.end];
    await render(browser, { html: page(f, end.accent, layoutOffer(end, 'carre')), W: f.W, H: f.H, out: path.join(dir, '6-offre.png') });
  }

  if (!ONLY || ONLY.includes('bannieres')) {
    console.log('\n🏷  Bannières et profil');
    for (const kind of ['facebook-couverture', 'linkedin-couverture', 'linkedin-page']) {
      const { f, body } = banner(kind);
      await render(browser, { html: page(f, 'brand', body), W: f.W, H: f.H, out: path.join(OUT, 'bannieres', `${kind}.png`) });
    }
    const { f, body } = avatar();
    await render(browser, { html: page(f, 'brand', body), W: f.W, H: f.H, out: path.join(OUT, 'bannieres', 'photo-profil.png') });
  }

  await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]);
  console.log('\n✅ Visuels :', OUT);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error('❌', e);
    process.exit(1);
  }
);
