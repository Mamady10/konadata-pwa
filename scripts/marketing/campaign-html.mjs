/**
 * Éléments graphiques partagés par les visuels et les vidéos de la campagne :
 * chemins, icônes, logo, maquettes ordinateur / téléphone et feuille de style.
 */
import sharp from 'sharp';
import QRCode from 'qrcode';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { chromium } from 'playwright';
import { CONTACT } from './campaign-content.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dir, '..', '..');
export const CAMPAIGN = path.join(ROOT, 'docs', 'marketing', 'campagne');
export const PHOTOS = path.join(CAMPAIGN, 'photos');
export const CAPTURES = path.join(CAMPAIGN, 'captures');
export const WORK = path.join(CAMPAIGN, '.work');

export const url = (p) => pathToFileURL(p).href;
export const photo = (name) => url(path.join(PHOTOS, name));
export const capture = (name) => url(path.join(CAPTURES, name));
export const work = (name) => url(path.join(WORK, name));

/** Icône détourée (work/icon.png) et encart « Recommandations IA » (work/ia-card.png). */
export async function prepareBrandAssets() {
  await mkdir(WORK, { recursive: true });
  const mask = Buffer.from(
    '<svg width="512" height="512"><rect width="512" height="512" rx="112" ry="112" fill="#fff"/></svg>'
  );
  await sharp(path.join(ROOT, 'public', 'brand', 'konadata-icon.png'))
    .extract({ left: 275, top: 10, width: 984, height: 1004 })
    .resize(512, 512, { fit: 'fill' })
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toFile(path.join(WORK, 'icon.png'));

  const pme = path.join(CAPTURES, 'pme-dashboard-desktop.png');
  if (existsSync(pme)) {
    await sharp(pme)
      .extract({ left: 545, top: 590, width: 2300, height: 515 })
      .png()
      .toFile(path.join(WORK, 'ia-card.png'));
  }
}

export function qrSvg(dark = '#0A192F', light = '#FFFFFF') {
  return QRCode.toString(CONTACT.url, { type: 'svg', margin: 0, color: { dark, light } });
}

export async function launchBrowser() {
  for (const channel of ['chrome', 'msedge', undefined]) {
    try {
      return await chromium.launch(channel ? { channel } : {});
    } catch {
      /* navigateur suivant */
    }
  }
  throw new Error('Aucun navigateur Playwright disponible.');
}

// ---------------------------------------------------------------- icônes (lucide)
export const ICON_PATHS = {
  check: '<path d="M20 6 9 17l-5-5"/>',
  arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  globe:
    '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  phone:
    '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  gift:
    '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>',
  ecole: '<path d="M22 10v6"/><path d="M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
  ong: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  btp: '<path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2z"/><path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5"/><path d="M4 15v-3a6 6 0 0 1 6-6"/><path d="M14 6a6 6 0 0 1 6 6v3"/>',
  pme: '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/>',
};
export const icon = (name, cls = '') =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[name]}</svg>`;

// ---------------------------------------------------------------- fragments
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const rich = (s) => esc(s).replace(/\*(.+?)\*/g, '<em>$1</em>');
export const em = (px, base) => `${(px / base).toFixed(3)}em`;

export function logo(size, tone = 'dark') {
  return `<div class="logo ${tone}" style="font-size:${size}px"><img src="${work('icon.png')}" alt=""><span><b class="k">Kona</b><b class="d">Data</b></span></div>`;
}
export const kicker = (text) => `<div class="kicker"><i></i>${esc(text)}</div>`;
export const bullets = (items) =>
  `<ul class="bul">${items.map((b) => `<li>${icon('check')}<span>${esc(b)}</span></li>`).join('')}</ul>`;
export const cta = (text) => `<div class="cta"><span>${esc(text)}</span>${icon('arrow')}</div>`;
export const foot = () =>
  `<div class="foot"><span>${icon('globe')}${CONTACT.site}</span><span>${icon('phone')}WhatsApp ${CONTACT.whatsapp}</span></div>`;
export const badge = (text) => (text ? `<div class="badge">${icon('gift')}<span>${esc(text)}</span></div>` : '');
export const chips = (items) => `<div class="chips">${items.map((c) => `<span>${esc(c)}</span>`).join('')}</div>`;

export function laptop(img, width) {
  return `<div class="laptop" style="width:${width}px"><div class="lid"><div class="cam"></div><div class="screen"><img src="${img}"></div></div><div class="base"></div></div>`;
}
export function phone(img, width) {
  return `<div class="phone" style="width:${width}px"><div class="scr"><img src="${img}"></div><div class="notch"></div></div>`;
}
export const glows = () =>
  `<div class="grid"></div><div class="glow g1"></div><div class="glow g2"></div>`;

// ---------------------------------------------------------------- styles
export const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=block');
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#0A192F}
body{font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased;color:#fff}
.cv{position:relative;overflow:hidden;background:#0A192F}
.abs{position:absolute}
.col{display:flex;flex-direction:column}
.fill{flex:1 1 auto}
em{font-style:normal;background:linear-gradient(90deg,var(--a1),var(--a2));-webkit-background-clip:text;background-clip:text;color:transparent}
h1{font-weight:800;letter-spacing:-.03em;line-height:1.06}
.sub{color:#CBD5E1;line-height:1.42;font-weight:500}
.logo{display:inline-flex;align-items:center;gap:.28em;font-weight:800;letter-spacing:-.02em;line-height:1}
.logo img{width:1.2em;height:1.2em;border-radius:.26em}
.logo .k{color:#fff}.logo .d{color:#38BDF8}
.logo.light .k{color:#0A192F}.logo.light .d{color:#2563EB}
.kicker{align-self:flex-start;display:inline-flex;align-items:center;gap:.6em;padding:.5em 1.05em;border-radius:999px;background:rgba(15,32,60,.72);border:1.5px solid color-mix(in srgb,var(--a1) 60%,transparent);font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:#E2E8F0;font-size:.72em;backdrop-filter:blur(6px)}
.kicker i{width:.6em;height:.6em;border-radius:50%;background:var(--a1);box-shadow:0 0 .8em var(--a1)}
.bul{list-style:none;display:flex;flex-direction:column;gap:.62em}
.bul li{display:flex;align-items:center;gap:.65em;font-weight:600;color:#F1F5F9;line-height:1.25}
.bul svg{flex:none;width:1.3em;height:1.3em;padding:.24em;border-radius:50%;background:linear-gradient(135deg,var(--a1),var(--a2));color:#0A192F;stroke-width:3.4}
.cta{align-self:flex-start;display:inline-flex;align-items:center;gap:.6em;padding:.78em 1.35em;border-radius:999px;background:linear-gradient(90deg,var(--a1),var(--a2));color:#06111F;font-weight:800;box-shadow:0 .6em 1.8em -.6em var(--a2)}
.cta svg{width:1.1em;height:1.1em;stroke-width:2.8}
.foot{display:flex;flex-wrap:wrap;align-items:center;gap:.4em 1.3em;color:#94A3B8;font-weight:600;font-size:.78em}
.foot span{display:inline-flex;align-items:center;gap:.45em}
.foot svg{width:1.15em;height:1.15em;color:var(--a1)}
.badge{display:inline-flex;align-items:center;gap:.5em;padding:.55em 1em;border-radius:.7em;background:#FACC15;color:#0A192F;font-weight:900;letter-spacing:-.01em;transform:rotate(-4deg);box-shadow:0 .5em 1.5em -.4em rgba(0,0,0,.6)}
.badge svg{width:1.15em;height:1.15em;stroke-width:2.6}
.chips{display:flex;flex-wrap:wrap;gap:.45em}
.chips span{padding:.42em .9em;border-radius:999px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);font-weight:600;color:#E2E8F0;font-size:.8em}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(148,163,184,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,.07) 1px,transparent 1px);background-size:54px 54px;-webkit-mask-image:radial-gradient(ellipse at 50% 40%,#000 20%,transparent 75%)}
.glow{position:absolute;border-radius:50%;filter:blur(110px);opacity:.3}
.g1{width:55%;height:55%;right:-20%;top:-20%;background:var(--a1)}
.g2{width:50%;height:50%;left:-22%;bottom:-22%;background:#2563EB;opacity:.28}
.laptop .lid{position:relative;background:linear-gradient(#1E293B,#0F172A);border-radius:1.6% 1.6% 0 0/2.6% 2.6% 0 0;padding:2.4% 2.4% 2%;box-shadow:0 30px 80px -20px rgba(0,0,0,.75),0 0 0 1.5px rgba(148,163,184,.25) inset}
.laptop .cam{position:absolute;top:.9%;left:50%;width:.7%;aspect-ratio:1;border-radius:50%;background:#334155;transform:translateX(-50%)}
.laptop .screen{aspect-ratio:16/10;overflow:hidden;border-radius:.4%;background:#fff}
.laptop .screen img{width:100%;height:100%;object-fit:cover;object-position:top left;display:block}
.laptop .base{height:0;padding-bottom:3.6%;width:114%;margin-left:-7%;background:linear-gradient(#E2E8F0,#94A3B8 60%,#64748B);border-radius:0 0 50% 50%/0 0 100% 100%;box-shadow:0 20px 40px -15px rgba(0,0,0,.7)}
.phone{position:relative;background:#0B1220;border-radius:15%/7%;padding:3.6%;box-shadow:0 40px 80px -24px rgba(0,0,0,.8),0 0 0 2px rgba(148,163,184,.35) inset}
.phone .scr{aspect-ratio:390/844;overflow:hidden;border-radius:12%/5.6%;background:#fff}
.phone .scr img{width:100%;height:100%;object-fit:cover;object-position:top;display:block}
.phone .notch{position:absolute;top:4.2%;left:50%;width:28%;height:2.6%;border-radius:999px;background:#0B1220;transform:translateX(-50%)}
.card-img{border-radius:18px;overflow:hidden;box-shadow:0 30px 70px -20px rgba(0,0,0,.8),0 0 0 2px rgba(255,255,255,.6)}
.card-img img{display:block;width:100%}
.steps{display:flex;flex-direction:column;gap:.7em}
.step{display:flex;gap:.9em;align-items:flex-start;padding:1em 1.1em;border-radius:1em;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1)}
.step .n{flex:none;width:2.1em;height:2.1em;border-radius:50%;display:grid;place-items:center;font-weight:900;color:#06111F;background:linear-gradient(135deg,var(--a1),var(--a2))}
.step b{display:block;font-size:1.08em;margin-bottom:.25em}
.step p{color:#CBD5E1;font-weight:500;line-height:1.38;font-size:.9em}
.ocard{flex:1;padding:1.1em 1.2em;border-radius:1.1em;background:rgba(255,255,255,.06);border:1.5px solid rgba(255,255,255,.14)}
.ocard .l{display:flex;align-items:center;gap:.5em;color:#CBD5E1;font-weight:700;font-size:.85em;text-transform:uppercase;letter-spacing:.06em}
.ocard .l svg{width:1.2em;height:1.2em;color:var(--a1)}
.ocard .v{font-weight:900;font-size:1.85em;letter-spacing:-.03em;margin-top:.3em;line-height:1.05;white-space:nowrap}
.fine{color:#94A3B8;font-weight:500;font-size:.78em}
.tile{border-radius:1em;padding:1em;display:flex;flex-direction:column;justify-content:space-between;color:#fff;font-weight:800}
.tile svg{width:2em;height:2em}
.counter{font-weight:800;color:#94A3B8;font-size:.8em;letter-spacing:.08em}
.poster-foot{background:#fff;color:#0A192F;display:flex;align-items:center;justify-content:space-between}
.poster-foot .c{display:flex;flex-direction:column;gap:.45em;font-weight:700;font-size:.9em}
.poster-foot .c span{display:inline-flex;align-items:center;gap:.5em}
.poster-foot .c svg{width:1.1em;height:1.1em;color:#2563EB}
.poster-foot .qr{display:flex;flex-direction:column;align-items:center;gap:.3em;font-weight:800;font-size:.7em;color:#475569}
`;
