/**
 * Publicités KonaData en « motion design » : typographie animée calée mot à mot sur la voix off,
 * maquettes d'appli dessinées en HTML, transitions rapides, musique rythmée et bruitages synthétisés.
 *
 * Chaque image est calculée par un petit moteur de tweens dans la page (window.__frame(t)),
 * capturée par Playwright puis encodée par ffmpeg : le rendu est exact, image par image.
 *
 * Usage :
 *   node scripts/marketing/build-motion-ads.mjs                      # toutes les pubs, 9:16 et 16:9
 *   node scripts/marketing/build-motion-ads.mjs --only=btp --format=9x16
 *   node scripts/marketing/build-motion-ads.mjs --stills=1,5.5,12   # planche d'images fixes (sans vidéo)
 */
import { spawn } from 'child_process';
import { once } from 'events';
import { createHash } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import sharp from 'sharp';
import { EdgeTTS } from 'node-edge-tts';
import { FFMPEG, FPS, ff, durationSec } from './video-kit.mjs';
import { ROOT, CAMPAIGN, WORK, url, launchBrowser, esc, ICON_PATHS } from './campaign-html.mjs';
import { CONTACT, OFFER } from './campaign-content.mjs';

const OUT_DIR = path.join(CAMPAIGN, 'videos');
const DIR = path.join(WORK, 'motion');
const TTS_DIR = path.join(DIR, 'tts');
const SFX_DIR = path.join(DIR, 'sfx');
const ASSETS = path.join(DIR, 'assets');

const FORMATS = {
  '9x16': { W: 1080, H: 1920, V: true },
  '16x9': { W: 1920, H: 1080, V: false },
};
const VOICE = { name: 'fr-FR-RemyMultilingualNeural', rate: '+5%', pitch: '+0Hz' };

const C = {
  ink: '#07111F',
  navy: '#0A192F',
  sky: '#38BDF8',
  cyan: '#22D3EE',
  blue: '#2563EB',
  slate: '#64748B',
  white: '#FFFFFF',
  whatsapp: '#25D366',
};

const ICONS = {
  ...ICON_PATHS,
  clipboard:
    '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
  fuel: '<line x1="3" x2="15" y1="22" y2="22"/><line x1="4" x2="14" y1="9" y2="9"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/>',
  truck:
    '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  calculator:
    '<rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="16" x2="16" y1="14" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  users:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  smartphone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
  laptop:
    '<path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"/>',
  msg: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  chart: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
};
const svgIcon = (name, size, color, sw = 2.2) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;

// ------------------------------------------------------------------ voix off (mot à mot)
const norm = (s) =>
  String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

async function speak(text) {
  const key = createHash('md5').update(`${VOICE.name}|${VOICE.rate}|${VOICE.pitch}|${text}`).digest('hex').slice(0, 16);
  const mp3 = path.join(TTS_DIR, `${key}.mp3`);
  const wav = path.join(TTS_DIR, `${key}.wav`);
  const json = `${mp3}.json`;
  if (!existsSync(wav) || !existsSync(json)) {
    for (let attempt = 1; ; attempt++) {
      try {
        const tts = new EdgeTTS({
          voice: VOICE.name,
          lang: 'fr-FR',
          outputFormat: 'audio-24khz-96kbitrate-mono-mp3',
          rate: VOICE.rate,
          pitch: VOICE.pitch,
          saveSubtitles: true,
          timeout: 120000,
        });
        await tts.ttsPromise(text, mp3);
        break;
      } catch (err) {
        if (attempt >= 3) throw err;
      }
    }
    ff(
      ['-i', mp3, '-af', 'highpass=f=80,lowpass=f=11000,acompressor=threshold=-18dB:ratio=3:attack=10:release=120,alimiter=limit=0.95', '-ar', '44100', '-ac', '1', '-y', wav],
      'voix',
    );
  }
  const words = JSON.parse(readFileSync(json, 'utf8')).map((w) => ({ w: norm(w.part), t: w.start / 1000 }));
  return { wav, dur: durationSec(wav) ?? 3, words };
}

/** Instants (absolus) où la voix prononce chacun des mots affichés ; repli régulier si un mot n'est pas dit. */
function syncTimes(beat, list) {
  const out = [];
  let p = 0;
  let last = beat.v - 0.1;
  for (const word of list) {
    const n = norm(word);
    let found = -1;
    if (n) {
      for (let j = p; j < beat.words.length; j++) {
        const vw = beat.words[j].w;
        if (vw && (vw === n || (vw.length > 2 && n.startsWith(vw)) || (n.length > 2 && vw.startsWith(n)))) {
          found = j;
          break;
        }
      }
    }
    if (found >= 0) {
      last = beat.v + beat.words[found].t;
      p = found + 1;
    } else if (n) {
      last += 0.12;
    }
    out.push(last);
  }
  return out;
}

// ------------------------------------------------------------------ timeline
class Timeline {
  constructor() {
    this.tw = [];
    this.sfx = [];
  }
  /** Interpole les propriétés `p` ({ x: [de, à], … }) de l'élément `id` entre t0 et t0 + d. */
  to(id, t0, d, p, e = 'out') {
    this.tw.push({ id, t0: Math.round(t0 * 1000) / 1000, d: Math.max(0.001, d), p, e });
    return this;
  }
  count(id, t0, d, from, to, suffix = '') {
    this.tw.push({ id, t0, d, c: [from, to], suffix, e: 'out' });
    return this;
  }
  play(name, t, vol = 1) {
    this.sfx.push({ name, t: Math.max(0, t), vol });
    return this;
  }
}

// ------------------------------------------------------------------ fragments HTML
const px = (n) => `${Math.round(n)}px`;

/**
 * Bloc de texte révélé mot à mot. `lines` : tableau de lignes, `*mots*` en couleur d'accent.
 * Retourne le HTML, les identifiants des mots et leur texte (pour la synchro voix).
 */
function textBlock(id, lines, o) {
  const ids = [];
  const words = [];
  let k = 0;
  let inEm = false;
  const htmlLines = lines.map((line) => {
    const parts = line.split(/\s+/).filter(Boolean).map((tok) => {
      const open = tok.startsWith('*');
      const close = tok.endsWith('*') && tok.length > 1;
      if (open) inEm = true;
      const clean = tok.replace(/\*/g, '');
      const em = inEm;
      if (close) inEm = false;
      const wid = `${id}-${k++}`;
      ids.push(wid);
      words.push(clean);
      return `<span class="m"><span class="w${em ? ' em' : ''}" id="${wid}">${esc(clean)}</span></span>`;
    });
    return `<div class="ln">${parts.join(' ')}</div>`;
  });
  const style = [
    `left:${px(o.x)}`,
    `top:${px(o.y)}`,
    `width:${px(o.w)}`,
    `font-size:${px(o.size)}`,
    `font-weight:${o.weight ?? 800}`,
    `line-height:${o.lh ?? 1.04}`,
    `color:${o.color ?? C.white}`,
    `--em:${o.em ?? C.sky}`,
    `text-align:${o.align ?? 'left'}`,
    `letter-spacing:${o.ls ?? -0.035}em`,
  ].join(';');
  return { html: `<div class="tb" id="${id}" data-fit="1" style="${style}">${htmlLines.join('')}</div>`, ids, words };
}

function revealWords(tl, block, times, { lead = 0.06, dur = 0.5 } = {}) {
  block.ids.forEach((id, i) => tl.to(id, times[i] - lead, dur, { ye: [1.1, 0], o: [0, 1] }, 'expo'));
}

function chrome(id, tone, label, { logo = true } = {}) {
  const color = tone === 'dark' ? C.white : C.navy;
  const data = tone === 'dark' ? C.sky : C.blue;
  return `<div class="chrome" id="${id}" style="color:${color}">
    ${logo ? `<div class="cl"><img src="${url(path.join(ASSETS, 'mark.png'))}"><b>Kona</b><b style="color:${data}">Data</b></div>` : '<div></div>'}
    <div class="cr">${esc(label)}</div>
  </div>`;
}

const TILES = [
  { icon: 'clipboard', label: 'Fiche du jour', fg: '#2563EB', bg: '#DBEAFE' },
  { icon: 'fuel', label: 'Carburant', fg: '#D97706', bg: '#FEF3C7' },
  { icon: 'truck', label: 'Livraisons', fg: '#059669', bg: '#D1FAE5' },
  { icon: 'calculator', label: 'Devis', fg: '#7C3AED', bg: '#EDE9FE' },
  { icon: 'file', label: 'Rapports', fg: '#0284C7', bg: '#E0F2FE' },
  { icon: 'users', label: 'Équipes', fg: '#E11D48', bg: '#FFE4E6' },
];
const TILE = { w: 164, h: 112, x0: 16, y0: 296, gx: 180, gy: 126 };
const tilePos = (i) => ({ x: TILE.x0 + (i % 2) * TILE.gx, y: TILE.y0 + Math.floor(i / 2) * TILE.gy });

/** Téléphone 400 × 840 avec l'accueil BTP de KonaData (tuiles, chantier, surlignage). */
function phoneHtml() {
  const tiles = TILES.map((t, i) => {
    const p = tilePos(i);
    return `<div class="tile" style="left:${p.x}px;top:${p.y}px"><i style="background:${t.bg}">${svgIcon(t.icon, 26, t.fg)}</i><span>${t.label}</span></div>
      <div class="tap" id="tap${i}" style="left:${p.x + TILE.w / 2 - 40}px;top:${p.y + TILE.h / 2 - 40}px"></div>`;
  }).join('');
  const p0 = tilePos(0);
  return `<div class="phone"><div class="scr">
    <div class="ph-top">
      <div class="ph-status"><b>9:41</b><span>4G ▮▮▮ 82%</span></div>
      <div class="ph-brand"><img src="${url(path.join(ASSETS, 'mark.png'))}"><b>Kona<span>Data</span></b>${svgIcon('bell', 24, '#fff')}</div>
      <div class="ph-org">Bâtir Guinée SARL · BTP</div>
    </div>
    <div class="ph-site">
      <b>Immeuble R+4 · Kipé</b>
      <div class="ph-row"><span>Avancement global</span><em id="ph-pct">0 %</em></div>
      <div class="ph-track"><div class="ph-fill" id="ph-bar"></div></div>
    </div>
    ${tiles}
    <div class="hl" id="hl" style="left:${p0.x}px;top:${p0.y}px"></div>
    <div class="ph-nav">${['home', 'chart', 'file', 'user'].map((n, i) => svgIcon(n, 26, i === 0 ? C.blue : '#94A3B8')).join('')}</div>
  </div></div>`;
}

function cardHtml(id, o, F) {
  const t = TILES[o.tile];
  const rows = o.rows
    .map((r, k) => `<div class="row" id="${id}-r${k}"><span>${esc(r.label)}</span><b id="${id}-v${k}"${r.accent ? ` style="color:${C.blue}"` : ''}>${esc(r.value)}</b></div>`)
    .join('');
  const extra = o.photos
    ? `<div class="thumbs" id="${id}-x">${o.photos.map((p) => `<img src="${url(p)}">`).join('')}</div>`
    : o.stamp
      ? `<div class="stamp" id="${id}-x">${svgIcon('check', 30, '#059669', 3)}${esc(o.stamp)}</div>`
      : '';
  return `<div class="card" id="${id}" style="left:${px(F.cardX)};top:${px(F.cardY)};width:${px(F.cardW)}">
    <div class="ch"><i style="background:${t.bg}">${svgIcon(t.icon, 30, t.fg)}</i><div><b>${esc(o.title)}</b><span>${esc(o.sub)}</span></div></div>
    ${rows}${extra}
  </div>`;
}

// ------------------------------------------------------------------ CSS + moteur de la page
const PAGE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=block');
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:var(--W);height:var(--H);overflow:hidden;background:${C.ink};font-family:Inter,'Segoe UI',Arial,sans-serif;-webkit-font-smoothing:antialiased}
.sc{position:absolute;inset:0;overflow:hidden;display:none}
.sc.dark{background:radial-gradient(120% 70% at 85% 0%,#0F2A4D 0%,${C.ink} 60%);color:#fff}
.sc.light{background:radial-gradient(120% 80% at 20% 0%,#FFFFFF 0%,#EEF3FA 100%);color:${C.navy}}
.tb{position:absolute}
.tb .ln{white-space:nowrap}
.m{display:inline-block;overflow:hidden;vertical-align:top;padding:0 .05em .14em;margin:0 -.05em -.14em}
.w{display:inline-block;opacity:0}
.w.em{color:var(--em)}
.a{position:absolute}
.chrome{position:absolute;left:0;right:0;top:0;display:flex;justify-content:space-between;align-items:center;padding:var(--cp)}
.chrome .cl{display:flex;align-items:center;gap:12px;font-size:30px;letter-spacing:-.02em}
.chrome .cl img{width:44px;height:44px;margin-right:4px}
.chrome .cr{font-size:20px;font-weight:700;letter-spacing:.22em;opacity:.6}
.ring{position:absolute;border-radius:50%;border:6px solid #fff;display:grid;place-items:center;font-weight:900;color:#fff}
.dash{position:absolute;border-radius:50%;border:3px dashed rgba(56,189,248,.65)}
.phone{width:400px;height:840px;border-radius:58px;background:#0B1220;padding:12px;box-shadow:0 40px 90px -20px rgba(0,0,0,.7),0 0 0 2px rgba(255,255,255,.08)}
.scr{position:relative;width:376px;height:816px;border-radius:46px;background:#EEF2F7;overflow:hidden;color:${C.navy}}
.ph-top{position:absolute;left:0;right:0;top:0;height:210px;background:linear-gradient(160deg,#0F2A4D,${C.navy});padding:16px 24px;color:#fff}
.ph-status{display:flex;justify-content:space-between;font-size:15px;opacity:.85}
.ph-brand{display:flex;align-items:center;gap:10px;margin-top:22px;font-size:24px}
.ph-brand img{width:40px;height:40px}
.ph-brand b span{color:${C.sky}}
.ph-brand svg{margin-left:auto}
.ph-org{margin-top:10px;font-size:15px;opacity:.7}
.ph-site{position:absolute;left:16px;right:16px;top:150px;height:124px;background:#fff;border-radius:22px;padding:18px 20px;box-shadow:0 10px 30px -12px rgba(10,25,47,.35)}
.ph-site b{font-size:19px}
.ph-row{display:flex;justify-content:space-between;margin-top:12px;font-size:14px;color:${C.slate}}
.ph-row em{font-style:normal;font-weight:800;color:${C.blue}}
.ph-track{margin-top:10px;height:10px;border-radius:5px;background:#E2E8F0;overflow:hidden}
.ph-fill{height:100%;width:0;border-radius:5px;background:linear-gradient(90deg,${C.blue},${C.sky})}
.tile{position:absolute;width:${TILE.w}px;height:${TILE.h}px;background:#fff;border-radius:22px;padding:16px;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 6px 18px -10px rgba(10,25,47,.3)}
.tile i{width:46px;height:46px;border-radius:14px;display:grid;place-items:center}
.tile span{font-size:17px;font-weight:700}
.hl{position:absolute;width:${TILE.w}px;height:${TILE.h}px;border-radius:22px;border:3px solid ${C.blue};box-shadow:0 0 0 7px rgba(37,99,235,.18);opacity:0}
.tap{position:absolute;width:80px;height:80px;border-radius:50%;background:rgba(37,99,235,.35);opacity:0}
.ph-nav{position:absolute;left:0;right:0;bottom:0;height:78px;background:#fff;display:flex;justify-content:space-around;align-items:center;border-top:1px solid #E2E8F0}
.card{position:absolute;background:#fff;color:${C.navy};border-radius:30px;padding:28px 32px;box-shadow:0 30px 80px -24px rgba(0,0,0,.6);opacity:0}
.card .ch{display:flex;align-items:center;gap:18px;margin-bottom:14px}
.card .ch i{width:60px;height:60px;border-radius:18px;display:grid;place-items:center;flex:none}
.card .ch b{display:block;font-size:30px;font-weight:800;letter-spacing:-.02em}
.card .ch span{display:block;font-size:20px;color:${C.slate};margin-top:2px}
.card .row{display:flex;justify-content:space-between;align-items:baseline;padding:13px 0;border-top:1px solid #E2E8F0;font-size:24px;color:${C.slate}}
.card .row b{font-size:28px;font-weight:800;color:${C.navy};font-variant-numeric:tabular-nums}
.thumbs{display:flex;gap:12px;margin-top:12px}
.thumbs img{width:110px;height:80px;object-fit:cover;border-radius:14px}
.stamp{position:absolute;right:28px;top:30px;display:flex;align-items:center;gap:10px;padding:10px 18px;border:3px solid #059669;border-radius:14px;color:#059669;font-size:24px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;background:#ECFDF5}
.idx{position:absolute;font-size:24px;font-weight:800;letter-spacing:.2em;color:${C.sky}}
.dashes{position:absolute;display:flex;gap:14px}
.dashes div{width:70px;height:5px;border-radius:3px;background:rgba(255,255,255,.18);overflow:hidden}
.dashes div i{display:block;height:100%;width:0;background:${C.sky}}
.page{position:absolute;border-radius:10px;box-shadow:0 40px 80px -24px rgba(10,25,47,.45);overflow:hidden;background:#fff}
.page img{display:block;width:100%}
.chip{position:absolute;display:flex;align-items:center;gap:10px;padding:14px 24px;border-radius:999px;font-size:26px;font-weight:800;background:${C.navy};color:#fff}
.chip.light{background:#fff;color:${C.navy};box-shadow:0 10px 30px -12px rgba(10,25,47,.35)}
.big{position:absolute;font-weight:900;letter-spacing:-.06em;line-height:.9;color:#fff;font-variant-numeric:tabular-nums}
.bub{position:absolute;width:130px;height:130px;border-radius:38px;display:grid;place-items:center;background:#fff;box-shadow:0 20px 50px -18px rgba(10,25,47,.45)}
.mark{position:absolute}
.mark img{width:100%;height:100%;display:block}
.wm{position:absolute;font-weight:900;letter-spacing:-.045em;white-space:nowrap}
.pill{position:absolute;display:flex;align-items:center;gap:16px;padding:22px 40px;border-radius:999px;background:${C.whatsapp};color:#fff;font-weight:800;white-space:nowrap}
.edge{position:absolute;top:0;bottom:0;width:34px;background:linear-gradient(90deg,${C.blue},${C.sky})}
`;

const PAGE_JS = `
const EASE = {
  lin: (q) => q,
  out: (q) => 1 - Math.pow(1 - q, 3),
  in: (q) => q * q * q,
  inout: (q) => (q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2),
  expo: (q) => (q >= 1 ? 1 : 1 - Math.pow(2, -10 * q)),
  back: (q) => { const c = 1.7; return 1 + (c + 1) * Math.pow(q - 1, 3) + c * Math.pow(q - 1, 2); },
};
const G = new Map();
for (const tw of TL) { if (!G.has(tw.id)) G.set(tw.id, []); G.get(tw.id).push(tw); }
for (const list of G.values()) list.sort((a, b) => a.t0 - b.t0);
const EL = new Map([...G.keys()].map((id) => [id, document.getElementById(id)]));
const fmt = (n) => Math.round(n).toLocaleString('fr-FR').replace(/\\s/g, '\\u202F');
function apply(el, s) {
  if (!el) return;
  if ('x' in s || 'y' in s || 's' in s || 'r' in s || 'ye' in s || 'sx' in s) {
    const sc = s.s ?? 1;
    el.style.transform = 'translate(' + (s.x || 0) + 'px,' + (s.y || 0) + 'px) translateY(' + (s.ye || 0) + 'em) rotate(' + (s.r || 0) + 'deg) scale(' + sc * (s.sx ?? 1) + ',' + sc + ')';
  }
  if ('o' in s) el.style.opacity = s.o;
  if ('b' in s) el.style.filter = s.b > 0.05 ? 'blur(' + s.b + 'px)' : 'none';
  if ('w' in s) el.style.width = s.w + '%';
  if ('dash' in s) el.style.strokeDashoffset = s.dash;
  if ('ct' in s || 'cr' in s || 'cb' in s || 'cl' in s) el.style.clipPath = 'inset(' + (s.ct || 0) + '% ' + (s.cr || 0) + '% ' + (s.cb || 0) + '% ' + (s.cl || 0) + '%)';
  if ('rad' in s) el.style.clipPath = 'circle(' + s.rad + 'px at ' + el.dataset.cx + 'px ' + el.dataset.cy + 'px)';
}
window.__frame = (t) => {
  for (const sc of SCENES) {
    const el = document.getElementById(sc.id);
    el.style.display = t >= sc.a && t < sc.b ? 'block' : 'none';
  }
  for (const [id, list] of G) {
    const st = {};
    for (const tw of list) {
      const q = t < tw.t0 ? 0 : Math.min(1, (t - tw.t0) / tw.d);
      const k = EASE[tw.e](q);
      if (tw.c) {
        if (t >= tw.t0 || !('txt' in st)) st.txt = fmt(tw.c[0] + (tw.c[1] - tw.c[0]) * k) + tw.suffix;
        continue;
      }
      for (const p in tw.p) {
        if (t < tw.t0) { if (!(p in st)) st[p] = tw.p[p][0]; }
        else st[p] = tw.p[p][0] + (tw.p[p][1] - tw.p[p][0]) * k;
      }
    }
    const el = EL.get(id);
    if ('txt' in st && el) el.textContent = st.txt;
    apply(el, st);
  }
};
function fit() {
  for (const el of document.querySelectorAll('[data-fit]')) {
    let fs = parseFloat(el.style.fontSize);
    const tooWide = () => [...el.querySelectorAll('.ln')].some((ln) => ln.scrollWidth > el.clientWidth + 1);
    while (tooWide() && fs > 24) { fs -= 2; el.style.fontSize = fs + 'px'; }
  }
}
window.__ready = (async () => {
  await document.fonts.ready;
  await Promise.all([...document.images].map((i) => (i.decode ? i.decode().catch(() => {}) : null)));
  for (const sc of SCENES) document.getElementById(sc.id).style.display = 'block';
  fit();
  window.__frame(0);
})();
`;

// ------------------------------------------------------------------ pub BTP
const BTP = {
  id: 'konadata-pub-btp',
  beats: [
    { k: 'hook', say: 'Et si vous saviez, chaque soir, ce qui se passe sur vos chantiers ?', pre: 0.45, post: 0.45 },
    { k: 'logo', say: 'Kona Data. Le suivi de chantier, dans votre poche.', pre: 0.75, post: 0.45 },
    { k: 'f1', say: 'Remplissez la fiche du jour, directement depuis le chantier.', pre: 0.65, post: 0.3 },
    { k: 'f2', say: 'Suivez le carburant, engin par engin.', pre: 0.3, post: 0.3 },
    { k: 'f3', say: 'Contrôlez chaque livraison : ciment, fer, agglos.', pre: 0.3, post: 0.35 },
    { k: 'f4', say: 'Chiffrez vos devis au métré, en quelques minutes.', pre: 0.3, post: 0.55 },
    { k: 'report', say: 'Et chaque semaine, votre rapport est prêt, avec photos et chiffres.', pre: 0.6, post: 0.45 },
    { k: 'offer', say: 'Pour démarrer : six mois gratuits.', pre: 0.55, post: 0.8 },
    { k: 'all', say: 'Tout cela, dans une seule application. Sur téléphone et ordinateur.', pre: 0.55, post: 0.45 },
    { k: 'end', say: 'Kona Data. Pilotez vos chantiers, même à distance. Écrivez-nous sur WhatsApp.', pre: 0.7, post: 2.6 },
  ],
  features: [
    {
      beat: 'f1',
      title: ['Remplissez', 'la fiche du jour.'],
      card: {
        tile: 0,
        title: 'Fiche du jour',
        sub: 'Immeuble R+4 · Kipé · 27 sept.',
        rows: [
          { label: 'Avancement R+2', value: '62 %', count: [54, 62, ' %'] },
          { label: 'Ouvriers présents', value: '18', count: [0, 18, ''] },
        ],
        photos: true,
      },
    },
    {
      beat: 'f2',
      title: ['Suivez', 'le carburant.'],
      card: {
        tile: 1,
        title: 'Carburant',
        sub: 'Pelle CAT 320 · Chantier Kipé',
        rows: [
          { label: 'Gasoil reçu', value: '120 L', count: [0, 120, ' L'] },
          { label: 'Compteur', value: '4 512 h' },
          { label: 'Coût', value: '1 440 000 GNF', count: [0, 1440000, ' GNF'], accent: true },
        ],
      },
    },
    {
      beat: 'f3',
      title: ['Contrôlez', 'les livraisons.'],
      card: {
        tile: 2,
        title: 'Bon de livraison',
        sub: 'BL-2026-0042 · Immeuble R+4',
        rows: [
          { label: 'Ciment CPJ 42.5', value: '300 sacs' },
          { label: 'Fer HA 12', value: '80 barres' },
          { label: 'Agglos de 15', value: '2 000' },
        ],
        stamp: 'Conforme',
      },
    },
    {
      beat: 'f4',
      title: ['Chiffrez', 'vos devis.'],
      card: {
        tile: 3,
        title: 'Devis au métré',
        sub: 'DEV-2026-0003 · Villa R+1',
        rows: [
          { label: 'Béton dosé à 350', value: '42 m³' },
          { label: 'Agglos de 15', value: '3 150' },
          { label: 'Total', value: '48 750 000 GNF', count: [0, 48750000, ' GNF'], accent: true },
        ],
      },
    },
  ],
};

function layout(F) {
  const { W, H, V } = F;
  return V
    ? {
        cp: '56px 64px',
        hook: { x: 90, y: 420, w: 900, size: 108 },
        ring: { cx: 540, cy: 1300, r: 170 },
        mark: { cx: 540, cy: 760, size: 250 },
        wm: { y: 960, size: 150 },
        tag: { x: 90, y: 1190, w: 900, size: 62 },
        phone: { x: (W - 460) / 2, y: 130, k: 1.15 },
        idx: { x: 90, y: 1135 },
        title: { x: 90, y: 1175, w: 900, size: 112 },
        sub: { size: 62 },
        cardX: 90,
        cardY: 1430,
        cardW: 900,
        dashes: { x: 640, y: 1147 },
        report: { x: 90, y: 230, w: 900, size: 104, chipsY: 590, pages: [{ x: 120, y: 790, w: 520, r: -6 }, { x: 440, y: 730, w: 520, r: 6 }] },
        offer: { kx: 90, ky: 330, bigX: 90, bigY: 470, bigSize: 640, txt: { x: 90, y: 1130, w: 900, size: 150 }, ruleY: 1840 },
        all: { x: 90, y: 260, w: 900, size: 104, devY: 640, icon: { cx: 540, cy: 1300, size: 250 }, R: 330 },
        end: { cx: 540, markY: 560, markSize: 220, wmY: 830, wmSize: 140, tagY: 1050, tagSize: 66, pillY: 1330, siteY: 1490 },
      }
    : {
        cp: '48px 80px',
        hook: { x: 120, y: 280, w: 1150, size: 108 },
        ring: { cx: 1520, cy: 560, r: 170 },
        mark: { cx: 960, cy: 400, size: 220 },
        wm: { y: 560, size: 140 },
        tag: { x: 260, y: 770, w: 1400, size: 58 },
        phone: { x: 250, y: 120, k: 1 },
        idx: { x: 820, y: 210 },
        title: { x: 820, y: 255, w: 1000, size: 120 },
        sub: { size: 68 },
        cardX: 820,
        cardY: 560,
        cardW: 640,
        dashes: { x: 1500, y: 222 },
        report: { x: 120, y: 280, w: 900, size: 104, chipsY: 680, pages: [{ x: 1060, y: 130, w: 520, r: -6 }, { x: 1330, y: 170, w: 500, r: 6 }] },
        offer: { kx: 140, ky: 200, bigX: 140, bigY: 290, bigSize: 640, txt: { x: 640, y: 450, w: 780, size: 140 }, ruleY: 960 },
        all: { x: 120, y: 300, w: 960, size: 104, devY: 690, icon: { cx: 1480, cy: 560, size: 230 }, R: 300 },
        end: { cx: 960, markY: 170, markSize: 180, wmY: 390, wmSize: 130, tagY: 590, tagSize: 60, pillY: 790, siteY: 935 },
      };
}

/** Construit la page HTML et la timeline de la pub BTP pour un format. */
function buildBtp(F, beats, assets) {
  const { W, H, V } = F;
  const L = layout(F);
  const tl = new Timeline();
  const B = Object.fromEntries(beats.map((b) => [b.k, b]));
  const scenes = [];
  const html = [];
  const scene = (id, cls, from, to, inner) => {
    scenes.push({ id, a: from, b: to });
    html.push(`<div class="sc ${cls}" id="${id}">${inner}</div>`);
  };
  const mark = url(path.join(ASSETS, 'mark.png'));
  const total = beats.at(-1).e;

  // 1. Accroche ----------------------------------------------------------------
  {
    const b = B.hook;
    const tb = textBlock('hk', ['Et si vous saviez,', '*chaque soir,*', 'ce qui se passe', 'sur vos chantiers ?'], L.hook);
    const R = L.ring;
    scene('s-hook', 'dark', 0, B.logo.s + 0.9, `${chrome('hk-c', 'dark', '01 — LE CONSTAT')}${tb.html}
      <div class="dash" id="hk-d" style="left:${R.cx - R.r - 40}px;top:${R.cy - R.r - 40}px;width:${2 * R.r + 80}px;height:${2 * R.r + 80}px"></div>
      <div class="ring" id="hk-r" style="left:${R.cx - R.r}px;top:${R.cy - R.r}px;width:${2 * R.r}px;height:${2 * R.r}px">${svgIcon('btp', 120, '#fff', 1.8)}</div>`);
    tl.to('hk-c', 0.1, 0.6, { o: [0, 1], y: [-20, 0] });
    revealWords(tl, tb, syncTimes(b, tb.words));
    tl.to('hk-r', 0.15, 0.7, { s: [0, 1], o: [0, 1] }, 'back');
    tl.to('hk-d', 0.3, 0.7, { s: [0.6, 1], o: [0, 1] });
    tl.to('hk-d', 0.3, b.e + 1, { r: [0, 120] }, 'lin');
    tl.to('hk-r', b.e - 0.35, 0.35, { s: [1, 1.12] }, 'in');
    tl.play('whoosh', b.e - 0.3, 0.8);
  }

  // 2. Logo (révélé en cercle depuis l'anneau) ------------------------------------
  {
    const b = B.logo;
    const M = L.mark;
    const R = L.ring;
    const tag = textBlock('lg-t', ['Le suivi de chantier,', '*dans votre poche.*'], { ...L.tag, align: 'center', color: C.navy, em: C.blue, weight: 800 });
    scene('s-logo', 'light', b.s, B.f1.s + 0.9, `${chrome('lg-c', 'light', '02 — LA SOLUTION', { logo: false })}
      <div class="mark" id="lg-m" style="left:${M.cx - M.size / 2}px;top:${M.cy - M.size / 2}px;width:${M.size}px;height:${M.size}px"><img src="${mark}"></div>
      <div class="wm" id="lg-w" style="left:0;width:${W}px;text-align:center;top:${L.wm.y}px;font-size:${L.wm.size}px;color:${C.navy}">Kona<span style="color:${C.blue}">Data</span></div>
      <div class="a" id="lg-u" style="left:${W / 2 - 160}px;top:${L.wm.y + L.wm.size * 1.12}px;width:320px;height:8px;border-radius:4px;background:linear-gradient(90deg,${C.blue},${C.sky})"></div>
      ${tag.html}`);
    const sEl = html.length - 1;
    html[sEl] = html[sEl].replace(`id="s-logo"`, `id="s-logo" data-cx="${R.cx}" data-cy="${R.cy}"`);
    tl.to('s-logo', b.s, 0.7, { rad: [0, Math.hypot(W, H)] }, 'inout');
    tl.to('lg-c', b.s + 0.4, 0.5, { o: [0, 1] });
    const [tKona] = syncTimes(b, ['Kona']);
    tl.to('lg-m', b.s + 0.3, 0.7, { s: [0, 1], r: [-25, 0], o: [0, 1] }, 'back');
    tl.to('lg-w', tKona - 0.1, 0.6, { cr: [100, 0], o: [0, 1], y: [30, 0] }, 'expo');
    tl.to('lg-u', tKona + 0.35, 0.6, { sx: [0, 1], o: [0, 1] }, 'expo');
    revealWords(tl, tag, syncTimes(b, tag.words));
    tl.play('pop', b.s + 0.35, 0.7);
  }

  // 3-6. Fonctionnalités : téléphone + titres + cartes ---------------------------
  {
    const P = L.phone;
    const feats = BTP.features;
    const first = B[feats[0].beat];
    const last = B[feats.at(-1).beat];
    const titles = [];
    const cards = [];
    feats.forEach((f, i) => {
      const tb = textBlock(`ft${i}`, [f.title[0]], { ...L.title, weight: 900 });
      const sb = textBlock(`fs${i}`, [f.title[1]], { x: L.title.x, y: L.title.y + L.title.size * 1.08, w: L.title.w, size: L.sub.size, weight: 600, color: 'rgba(255,255,255,.62)' });
      titles.push({ tb, sb });
      const card = { ...f.card, photos: f.card.photos ? assets.photos : undefined };
      cards.push(cardHtml(`cd${i}`, card, L));
    });
    const dashes = `<div class="dashes" id="ft-d" style="left:${L.dashes.x}px;top:${L.dashes.y}px">${feats.map((_, i) => `<div><i id="dsh${i}"></i></div>`).join('')}</div>`;
    scene('s-feat', 'dark', first.s, B.report.s + 0.9, `${chrome('ft-c', 'dark', '03 — SUR LE TERRAIN')}
      <div class="a" id="ph" style="left:${P.x}px;top:${P.y}px;transform-origin:50% 50%"><div style="transform:scale(${P.k});transform-origin:0 0">${phoneHtml()}</div></div>
      ${feats.map((_, i) => `<div class="idx" id="ix${i}" style="left:${L.idx.x}px;top:${L.idx.y}px;opacity:0">0${i + 1} / 0${feats.length}</div>`).join('')}
      ${titles.map((t) => `<div id="tg${titles.indexOf(t)}" class="a" style="left:0;top:0">${t.tb.html}${t.sb.html}</div>`).join('')}
      ${dashes}${cards.join('')}`);
    tl.to('s-feat', first.s, 0.6, { ct: [100, 0] }, 'inout');
    tl.to('s-logo', first.s, 0.6, { y: [0, -H * 0.25] }, 'inout');
    tl.play('whoosh', first.s - 0.05, 0.9);
    tl.to('ft-c', first.s + 0.3, 0.5, { o: [0, 1] });
    tl.to('ph', first.s + 0.15, 0.8, { y: [H * 0.5, 0], r: [8, 0] }, 'expo');
    tl.to('ph-bar', first.s + 0.7, 1.2, { w: [0, 62] });
    tl.count('ph-pct', first.s + 0.7, 1.2, 0, 62, ' %');
    tl.to('ft-d', first.s + 0.5, 0.5, { o: [0, 1] });
    feats.forEach((f, i) => {
      const b = B[f.beat];
      const next = i < feats.length - 1 ? B[feats[i + 1].beat].s : B.report.s + 0.6;
      const p = tilePos(f.card.tile);
      const p0 = tilePos(0);
      const prev = i ? tilePos(feats[i - 1].card.tile) : p0;
      // surlignage de la tuile + « tap »
      if (i === 0) tl.to('hl', b.v - 0.2, 0.4, { o: [0, 1], s: [1.15, 1], x: [0, 0], y: [0, 0] }, 'back');
      else tl.to('hl', b.s, 0.45, { x: [prev.x - p0.x, p.x - p0.x], y: [prev.y - p0.y, p.y - p0.y] }, 'inout');
      tl.to(`tap${f.card.tile}`, b.s + 0.4, 0.6, { s: [0.2, 1.8], o: [0.9, 0] });
      tl.play('pop', b.s + 0.4, 0.6);
      // index, titre, sous-titre
      tl.to(`ix${i}`, b.s + 0.15, 0.4, { o: [0, 1], y: [20, 0] });
      tl.to(`ix${i}`, next - 0.05, 0.3, { o: [1, 0], y: [0, -20] }, 'in');
      const { tb, sb } = titles[i];
      revealWords(tl, tb, syncTimes(b, tb.words));
      revealWords(tl, sb, syncTimes(b, sb.words));
      tl.to(`tg${i}`, next - 0.05, 0.35, { y: [0, -60], o: [1, 0] }, 'in');
      tl.to(`dsh${i}`, b.s, next - b.s, { w: [0, 100] }, 'lin');
      // carte de détail
      const cid = `cd${i}`;
      tl.to(cid, b.s + 0.35, 0.6, { o: [0, 1], y: [80, 0], s: [0.96, 1] }, 'expo');
      f.card.rows.forEach((r, k) => {
        tl.to(`${cid}-r${k}`, b.s + 0.5 + k * 0.12, 0.45, { o: [0, 1], x: [30, 0] });
        if (r.count) tl.count(`${cid}-v${k}`, b.s + 0.6 + k * 0.12, 1.1, r.count[0], r.count[1], r.count[2]);
      });
      if (f.card.photos) tl.to(`${cid}-x`, b.s + 0.9, 0.5, { o: [0, 1], y: [20, 0] });
      if (f.card.stamp) {
        const [tLiv] = syncTimes(b, ['agglos']);
        tl.to(`${cid}-x`, tLiv + 0.2, 0.35, { s: [2.2, 1], o: [0, 1], r: [-14, -6] }, 'back');
        tl.play('thump', tLiv + 0.35, 0.8);
        tl.play('ding', tLiv + 0.4, 0.45);
      }
      tl.to(cid, next - 0.05, 0.3, { o: [1, 0], y: [0, -40] }, 'in');
    });
    // vers les rapports : surlignage sur « Rapports »
    const pr = tilePos(TILES.length - 2);
    const pl = tilePos(feats.at(-1).card.tile);
    const p0 = tilePos(0);
    tl.to('hl', last.e - 0.5, 0.4, { x: [pl.x - p0.x, pr.x - p0.x], y: [pl.y - p0.y, pr.y - p0.y] }, 'inout');
    tl.to('tap4', last.e - 0.15, 0.6, { s: [0.2, 1.8], o: [0.9, 0] });
    tl.play('pop', last.e - 0.15, 0.6);
  }

  // 7. Rapport (balayage depuis la droite) -----------------------------------------
  {
    const b = B.report;
    const R = L.report;
    const tb = textBlock('rp', ['Chaque semaine,', '*votre rapport*', '*est prêt.*'], { x: R.x, y: R.y, w: R.w, size: R.size, color: C.navy, em: C.blue });
    const chips = ['PDF', 'Photos', 'Chiffres'];
    const chipX = (i) => R.x + [0, 150, 330][i];
    scene('s-rep', 'light', b.s, B.offer.s + 0.9, `${chrome('rp-c', 'light', '04 — LE RAPPORT')}${tb.html}
      ${chips.map((c, i) => `<div class="chip${i ? ' light' : ''}" id="rc${i}" style="left:${chipX(i)}px;top:${R.chipsY}px;opacity:0">${c}</div>`).join('')}
      ${R.pages.map((p, i) => `<div class="page" id="pg${i}" style="left:${p.x}px;top:${p.y}px;width:${p.w}px;opacity:0"><img src="${url(assets.pages[1 - i])}"></div>`).join('')}
      <div class="edge" id="rp-e" style="left:0"></div>`);
    tl.to('s-rep', b.s, 0.6, { cl: [100, 0] }, 'inout');
    tl.to('rp-e', b.s, 0.6, { x: [W, -40] }, 'inout');
    tl.play('whoosh', b.s - 0.05, 0.9);
    tl.to('rp-c', b.s + 0.3, 0.5, { o: [0, 1] });
    revealWords(tl, tb, syncTimes(b, tb.words));
    const tChips = syncTimes(b, ['est', 'photos', 'chiffres']);
    chips.forEach((_, i) => tl.to(`rc${i}`, tChips[i] - 0.05, 0.45, { o: [0, 1], s: [0.6, 1], y: [20, 0] }, 'back'));
    R.pages.forEach((p, i) => {
      const t = b.s + 0.45 + (1 - i) * 0.25;
      tl.to(`pg${i}`, t, 0.9, { o: [0, 1], x: [V ? 300 : 600, 0], y: [V ? 200 : 0, 0], r: [p.r + (i ? 18 : -14), p.r] }, 'expo');
      tl.to(`pg${i}`, t + 0.9, b.e - t, { y: [0, i ? -24 : 24] }, 'lin');
    });
  }

  // 8. Offre : compteur géant ------------------------------------------------------
  {
    const b = B.offer;
    const O = L.offer;
    const tb = textBlock('of', ['mois', '*gratuits.*'], { ...O.txt, weight: 900 });
    const pins = V
      ? [[180, 1500], [420, 1620], [760, 1540], [900, 1700], [300, 1780], [640, 1800]]
      : [[1500, 230], [1710, 170], [1830, 390], [1640, 540], [1490, 720], [1770, 830]];
    const links = [[0, 1], [1, 2], [2, 3], [3, 4], [1, 3], [4, 5], [3, 5]];
    const svg = `<svg class="a" style="left:0;top:0" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      ${links.map(([a, c], i) => {
        const len = Math.hypot(pins[c][0] - pins[a][0], pins[c][1] - pins[a][1]);
        return `<line id="ln${i}" x1="${pins[a][0]}" y1="${pins[a][1]}" x2="${pins[c][0]}" y2="${pins[c][1]}" stroke="${C.sky}" stroke-opacity=".45" stroke-width="2" stroke-dasharray="${len}" stroke-dashoffset="${len}" data-len="${len}"/>`;
      }).join('')}
    </svg>`;
    const dots = pins.map(([x, y], i) => `<div class="a" id="pn${i}" style="left:${x - 11}px;top:${y - 11}px;width:22px;height:22px;border-radius:50%;background:${C.sky};box-shadow:0 0 0 8px rgba(56,189,248,.18),0 0 30px ${C.sky};opacity:0"></div>`).join('');
    scene('s-off', 'dark', b.s, B.all.s + 0.9, `${chrome('of-c', 'dark', '05 — L’OFFRE')}
      <div class="a" style="inset:0;background-image:radial-gradient(rgba(148,163,184,.22) 2px,transparent 2.5px);background-size:44px 44px;-webkit-mask-image:radial-gradient(70% 60% at ${V ? '50% 85%' : '85% 50%'},#000,transparent)"></div>
      ${svg}${dots}
      <div class="idx" id="of-k" style="left:${O.kx}px;top:${O.ky}px;opacity:0">OFFRE DE LANCEMENT · BTP</div>
      <div class="big" id="of-n" style="left:${O.bigX}px;top:${O.bigY}px;font-size:${O.bigSize}px">0</div>
      ${tb.html}
      <div class="a" id="of-r" style="left:${O.kx}px;top:${O.ruleY}px;font-size:24px;color:rgba(255,255,255,.55);opacity:0">${esc(OFFER.rule)}</div>`);
    tl.to('s-off', b.s, 0.6, { y: [H, 0] }, 'inout');
    tl.to('s-rep', b.s, 0.6, { y: [0, -H * 0.3] }, 'inout');
    tl.play('whoosh', b.s - 0.05, 0.9);
    tl.to('of-c', b.s + 0.3, 0.5, { o: [0, 1] });
    tl.to('of-k', b.s + 0.4, 0.5, { o: [0, 1], x: [-30, 0] });
    const [tSix] = syncTimes(b, ['six']);
    tl.count('of-n', tSix - 0.35, 0.6, 0, 6);
    tl.to('of-n', tSix - 0.35, 0.6, { s: [0.7, 1], o: [0, 1] }, 'back');
    tl.play('thump', tSix + 0.2, 1);
    revealWords(tl, tb, syncTimes(b, tb.words));
    pins.forEach((_, i) => tl.to(`pn${i}`, b.s + 0.5 + i * 0.12, 0.4, { o: [0, 1], s: [0, 1] }, 'back'));
    links.forEach(([a, c], i) => {
      const len = Math.hypot(pins[c][0] - pins[a][0], pins[c][1] - pins[a][1]);
      tl.to(`ln${i}`, b.s + 0.7 + i * 0.15, 0.8, { dash: [len, 0] });
    });
    tl.to('of-r', b.v + 1.2, 0.6, { o: [0, 1] });
  }

  // 9. Tout dans une seule appli ---------------------------------------------------
  {
    const b = B.all;
    const A = L.all;
    const tb = textBlock('al', ['Tout cela, dans', '*une seule*', '*application.*'], { x: A.x, y: A.y, w: A.w, size: A.size, color: C.navy, em: C.blue });
    const devs = [
      { icon: 'smartphone', label: 'Téléphone' },
      { icon: 'laptop', label: 'Ordinateur' },
    ];
    const I = A.icon;
    const bubbles = TILES.map((t, i) => {
      const ang = (-90 + i * 60) * (Math.PI / 180);
      return { ...t, x: I.cx + A.R * Math.cos(ang) - 65, y: I.cy + A.R * Math.sin(ang) - 65, dx: -A.R * Math.cos(ang), dy: -A.R * Math.sin(ang) };
    });
    scene('s-all', 'light', b.s, B.end.s + 0.9, `${chrome('al-c', 'light', '06 — TOUT-EN-UN')}${tb.html}
      ${devs.map((d, i) => `<div class="chip light" id="dv${i}" style="left:${A.x + i * 290}px;top:${A.devY}px;opacity:0">${svgIcon(d.icon, 30, C.blue)}${d.label}</div>`).join('')}
      ${bubbles.map((u, i) => `<div class="bub" id="bb${i}" style="left:${u.x}px;top:${u.y}px;opacity:0">${svgIcon(u.icon, 58, u.fg)}</div>`).join('')}
      <div class="mark" id="al-m" style="left:${I.cx - I.size / 2}px;top:${I.cy - I.size / 2}px;width:${I.size}px;height:${I.size}px"><img src="${mark}"></div>`);
    tl.to('s-all', b.s, 0.6, { x: [W, 0] }, 'inout');
    tl.to('s-off', b.s, 0.6, { x: [0, -W * 0.3] }, 'inout');
    tl.play('whoosh', b.s - 0.05, 0.9);
    tl.to('al-c', b.s + 0.3, 0.5, { o: [0, 1] });
    tl.to('al-m', b.s + 0.3, 0.6, { s: [0, 1], o: [0, 1] }, 'back');
    const times = syncTimes(b, tb.words);
    revealWords(tl, tb, times);
    bubbles.forEach((u, i) => {
      const t = b.v + 0.05 + i * 0.1;
      tl.to(`bb${i}`, t, 0.5, { o: [0, 1], s: [0, 1], x: [u.dx, 0], y: [u.dy, 0] }, 'back');
      tl.play('tick', t + 0.1, 0.5);
    });
    const [tSeule] = syncTimes(b, ['seule']);
    bubbles.forEach((u, i) => tl.to(`bb${i}`, tSeule + i * 0.03, 0.45, { x: [0, u.dx], y: [0, u.dy], s: [1, 0.2], o: [1, 0] }, 'in'));
    tl.to('al-m', tSeule + 0.4, 0.25, { s: [1, 1.14] }, 'out');
    tl.to('al-m', tSeule + 0.65, 0.35, { s: [1.14, 1] }, 'out');
    tl.play('pop', tSeule + 0.45, 0.8);
    const tDev = syncTimes(b, ['telephone', 'ordinateur']);
    devs.forEach((_, i) => tl.to(`dv${i}`, tDev[i] - 0.05, 0.45, { o: [0, 1], y: [30, 0], s: [0.8, 1] }, 'back'));
  }

  // 10. Fin : logo, slogan, WhatsApp -------------------------------------------------
  {
    const b = B.end;
    const E = L.end;
    const tag = textBlock('en-t', ['Pilotez vos chantiers,', '*même à distance.*'], { x: 60, y: E.tagY, w: W - 120, size: E.tagSize, align: 'center', weight: 800 });
    const pillSize = V ? 44 : 40;
    scene('s-end', 'dark', b.s, total + 1, `
      <div class="mark" id="en-m" style="left:${E.cx - E.markSize / 2}px;top:${E.markY}px;width:${E.markSize}px;height:${E.markSize}px"><img src="${mark}"></div>
      <div class="wm" id="en-w" style="left:0;width:${W}px;text-align:center;top:${E.wmY}px;font-size:${E.wmSize}px;color:#fff">Kona<span style="color:${C.sky}">Data</span></div>
      ${tag.html}
      <div class="a" id="en-pw" style="left:0;width:${W}px;top:${E.pillY}px;display:flex;justify-content:center"><div class="pill" id="en-p" style="position:relative;font-size:${pillSize}px">${svgIcon('msg', pillSize * 1.2, '#fff', 2.4)}${esc(CONTACT.whatsapp)}</div></div>
      <div class="a" id="en-s" style="left:0;width:${W}px;text-align:center;top:${E.siteY}px;font-size:${V ? 40 : 34}px;font-weight:700;color:rgba(255,255,255,.75);letter-spacing:.02em">${esc(CONTACT.site)} · ${esc(OFFER.autres)}</div>`);
    const sEl = html.length - 1;
    html[sEl] = html[sEl].replace(`id="s-end"`, `id="s-end" data-cx="${W / 2}" data-cy="${H / 2}"`);
    tl.to('s-end', b.s, 0.7, { rad: [0, Math.hypot(W, H) / 2 + 40] }, 'inout');
    tl.play('whoosh', b.s - 0.05, 0.9);
    const [tKona] = syncTimes(b, ['Kona']);
    tl.to('en-m', b.s + 0.3, 0.7, { s: [0, 1], r: [-25, 0], o: [0, 1] }, 'back');
    tl.to('en-w', tKona, 0.6, { cr: [100, 0], o: [0, 1], y: [30, 0] }, 'expo');
    revealWords(tl, tag, syncTimes(b, tag.words));
    const [tWa] = syncTimes(b, ['WhatsApp']);
    tl.to('en-p', tWa - 0.35, 0.55, { o: [0, 1], s: [0.5, 1] }, 'back');
    tl.to('en-p', tWa + 0.6, 0.3, { s: [1, 1.06] }, 'out');
    tl.to('en-p', tWa + 0.9, 0.3, { s: [1.06, 1] }, 'out');
    tl.to('en-s', tWa, 0.6, { o: [0, 1], y: [20, 0] });
    tl.play('chime', tWa - 0.3, 0.6);
  }

  const page = `<!doctype html><html><head><meta charset="utf-8"><style>:root{--W:${W}px;--H:${H}px;--cp:${L.cp}}${PAGE_CSS}</style></head>
<body>${html.join('\n')}
<script>const TL=${JSON.stringify(tl.tw)};const SCENES=${JSON.stringify(scenes)};${PAGE_JS}</script></body></html>`;
  return { page, total, sfx: tl.sfx };
}

// ------------------------------------------------------------------ musique + bruitages
const BPM = 112;

function buildMusic(total, out) {
  const B = 60 / BPM;
  const BAR = 4 * B;
  const idx = `mod(floor(t/${BAR}),4)`;
  const pick = (vals) => vals.map((v, i) => `${v}*eq(${idx},${i})`).join('+');
  const gate = `min(1,mod(t,${BAR})*30)*min(1,(${BAR}-mod(t,${BAR}))*30)`;
  const kick = `0.95*sin(2*PI*(45*mod(t,${B})+4.4*(1-exp(-25*mod(t,${B})))))*exp(-7*mod(t,${B}))`;
  const hat = `0.5*(random(0)*2-1)*exp(-55*mod(t+${B / 2},${B}))`;
  const snare = `0.55*(random(0)*2-1)*exp(-16*mod(t+${B},${2 * B}))`;
  const e = `mod(t,${B / 2})`;
  const root = pick([55, 43.65, 65.41, 49]);
  const bass = `(0.55*sin(2*PI*(${root})*t)+0.2*sin(4*PI*(${root})*t))*(0.35+0.65*exp(-${e}*7))*min(1,${e}*300)*min(1,(${B / 2}-${e})*60)`;
  const chord = [pick([220, 174.61, 196, 196]), pick([261.63, 220, 261.63, 246.94]), pick([329.63, 261.63, 329.63, 293.66])];
  const pad = `0.12*(${chord.map((f) => `sin(2*PI*(${f})*t)`).join('+')})*(0.55+0.45*min(1,mod(t,${B})*5))*${gate}`;
  const layers = [
    [kick, 'lowpass=f=900'],
    [hat, 'highpass=f=7000'],
    [snare, 'highpass=f=1500,lowpass=f=7000'],
    [bass, 'lowpass=f=450'],
    [pad, 'lowpass=f=2200,aecho=0.8:0.6:250:0.25'],
  ];
  const args = [];
  layers.forEach(([expr]) => args.push('-f', 'lavfi', '-i', `aevalsrc='${expr}':s=44100:d=${total.toFixed(2)}`));
  const fade = Math.max(0, total - 2.5);
  const chains = layers.map(([, af], i) => `[${i}:a]${af},aformat=channel_layouts=stereo[l${i}]`);
  const mix = `${layers.map((_, i) => `[l${i}]`).join('')}amix=inputs=${layers.length}:weights='1 0.16 0.22 0.9 0.8',volume=${layers.length},afade=t=in:st=0:d=0.4,afade=t=out:st=${fade}:d=2.5,alimiter=limit=0.9[m]`;
  ff([...args, '-filter_complex', `${chains.join(';')};${mix}`, '-map', '[m]', '-ar', '44100', '-y', out], 'musique');
}

const SFX = {
  whoosh: { d: 0.9, e: '0.5*(random(0)*2-1)*pow(sin(PI*t/0.9),3)', af: 'highpass=f=400,lowpass=f=5000' },
  pop: { d: 0.18, e: '0.7*sin(2*PI*(1100-2600*t)*t)*exp(-t*28)' },
  tick: { d: 0.08, e: '0.45*sin(2*PI*2600*t)*exp(-t*80)' },
  thump: { d: 0.8, e: '(0.9*sin(2*PI*(48+60*exp(-t*20))*t)+0.25*(random(0)*2-1)*exp(-t*30))*exp(-t*6)' },
  ding: { d: 1.6, e: '0.3*(sin(2*PI*1318*t)+0.6*sin(2*PI*1760*t))*exp(-t*3.2)' },
  chime: {
    d: 2.4,
    e: '0.22*(sin(2*PI*523.25*t)*exp(-t*2.5)+gte(t,0.09)*sin(2*PI*659.25*t)*exp(-(t-0.09)*2.5)+gte(t,0.18)*sin(2*PI*783.99*t)*exp(-(t-0.18)*2.5)+gte(t,0.27)*sin(2*PI*1046.5*t)*exp(-(t-0.27)*2.2))',
  },
};

function sfxFile(name) {
  const s = SFX[name];
  const out = path.join(SFX_DIR, `${name}-${createHash('md5').update(s.e + (s.af || '')).digest('hex').slice(0, 8)}.wav`);
  if (!existsSync(out)) {
    ff(['-f', 'lavfi', '-i', `aevalsrc='${s.e}':s=44100:d=${s.d}`, ...(s.af ? ['-af', s.af] : []), '-ac', '2', '-y', out], `bruitage ${name}`);
  }
  return out;
}

const AF = 'aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo';
/** Voix Edge ≈ −26 dB de moyenne, musique ≈ −10 dB : la voix est remontée, la musique reste ~12 dB dessous. */
const VOICE_GAIN = 2.5;
const MUSIC_GAIN = 0.1;

function mixAudio(total, voices, sfx, music, out) {
  const n = Math.round(total * 44100);
  const inputs = [music, ...voices.map((v) => v.wav), ...sfx.map((s) => sfxFile(s.name))];
  const args = inputs.flatMap((f) => ['-i', f]);
  // amix (ffmpeg 2018) divise par le nombre d'entrées encore actives : toutes sont prolongées jusqu'à la fin.
  const pad = `apad=whole_len=${n},atrim=0:${total.toFixed(3)}`;
  const delay = (t) => `adelay=${Math.round(t * 1000)}|${Math.round(t * 1000)}`;
  const vo = voices.map((v, i) => `[${i + 1}:a]aformat=channel_layouts=stereo,${delay(v.t)},${pad}[v${i}]`);
  const fx = sfx.map((s, i) => `[${i + 1 + voices.length}:a]volume=${s.vol},${delay(s.t)},${pad}[f${i}]`);
  const graph = [
    ...vo,
    `${voices.map((_, i) => `[v${i}]`).join('')}amix=inputs=${voices.length}:duration=first,volume=${voices.length * VOICE_GAIN},asplit[vo][key]`,
    ...fx,
    `${sfx.map((_, i) => `[f${i}]`).join('')}amix=inputs=${sfx.length}:duration=first,volume=${sfx.length * 0.35}[fx]`,
    `[0:a]volume=${MUSIC_GAIN},${AF}[mu]`,
    `[key]${AF}[k]`,
    `[mu][k]sidechaincompress=threshold=0.03:ratio=5:attack=20:release=350[md]`,
    `[vo][md][fx]amix=inputs=3:duration=first,volume=3,loudnorm=I=-15:TP=-1.5:LRA=11,${AF}[out]`,
  ].join(';');
  ff([...args, '-filter_complex', graph, '-map', '[out]', '-c:a', 'aac', '-b:a', '192k', '-y', out], 'mixage');
}

// ------------------------------------------------------------------ rendu
async function prepareAssets() {
  await mkdir(ASSETS, { recursive: true });
  const markOut = path.join(ASSETS, 'mark.png');
  await sharp(path.join(ROOT, 'public', 'brand', 'konadata-mark.png')).resize(512).png().toFile(markOut);
  const seed = path.join(ROOT, 'scripts', 'tutorials', 'seed', 'assets', 'btp');
  const photos = [];
  for (const f of ['Coulage_dalle_R+2.jpg', 'Ferraillage_poutres_R+3.jpg', 'Elevation_murs_agglos_R+3.jpg']) {
    const out = path.join(ASSETS, `photo-${photos.length}.jpg`);
    await sharp(path.join(seed, f)).resize(330, 240, { fit: 'cover' }).jpeg({ quality: 85 }).toFile(out);
    photos.push(out);
  }
  const crops = path.join(WORK, 'story', 'crops');
  const pages = [];
  for (const f of ['rapport-page1.png', 'rapport-page2.png']) {
    const out = path.join(ASSETS, f);
    await sharp(path.join(crops, f)).resize(1040).png().toFile(out);
    pages.push(out);
  }
  return { photos, pages };
}

async function openPage(browser, F, page, htmlFile) {
  await writeFile(htmlFile, page, 'utf8');
  const ctx = await browser.newContext({ viewport: { width: F.W, height: F.H }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto(url(htmlFile), { waitUntil: 'load' });
  await p.evaluate(() => window.__ready);
  return { ctx, p };
}

async function renderVideo(browser, F, page, htmlFile, total, audio, out) {
  const { ctx, p } = await openPage(browser, F, page, htmlFile);
  const enc = spawn(
    FFMPEG,
    [
      '-hide_banner', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-i', audio,
      '-map', '0:v', '-map', '1:a',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', String(FPS),
      '-c:a', 'copy', '-shortest', '-movflags', '+faststart', '-y', out,
    ],
    { stdio: ['pipe', 'inherit', 'inherit'] },
  );
  const frames = Math.ceil(total * FPS);
  for (let i = 0; i < frames; i++) {
    await p.evaluate((t) => window.__frame(t), i / FPS);
    const buf = await p.screenshot({ type: 'jpeg', quality: 92 });
    if (!enc.stdin.write(buf)) await once(enc.stdin, 'drain');
    if (i % 150 === 0) process.stdout.write(`  ${Math.round((i / frames) * 100)} %\r`);
  }
  enc.stdin.end();
  const [code] = await once(enc, 'close');
  await ctx.close();
  if (code !== 0) throw new Error(`ffmpeg a échoué (${code}) pour ${out}`);
}

async function renderStills(browser, F, page, htmlFile, times, out) {
  const { ctx, p } = await openPage(browser, F, page, htmlFile);
  const tiles = [];
  const tw = Number(process.argv.find((a) => a.startsWith('--still-width='))?.split('=')[1]) || (F.V ? 360 : 640);
  const th = Math.round((tw * F.H) / F.W);
  for (const t of times) {
    await p.evaluate((x) => window.__frame(x), t);
    const buf = await p.screenshot({ type: 'png' });
    const img = await sharp(buf).resize(tw, th).png().toBuffer();
    const lbl = Buffer.from(`<svg width="${tw}" height="34"><rect width="90" height="34" fill="#000" opacity=".6"/><text x="8" y="24" font-size="20" font-family="Arial" fill="#ff0">${t.toFixed(1)}s</text></svg>`);
    tiles.push(await sharp(img).composite([{ input: lbl, left: 0, top: 0 }]).png().toBuffer());
  }
  await ctx.close();
  const cols = Math.min(tiles.length, F.V ? 6 : 4);
  const rows = Math.ceil(tiles.length / cols);
  await sharp({ create: { width: cols * (tw + 10), height: rows * (th + 10), channels: 3, background: '#111' } })
    .composite(tiles.map((input, i) => ({ input, left: (i % cols) * (tw + 10), top: Math.floor(i / cols) * (th + 10) })))
    .png()
    .toFile(out);
  console.log(`  planche : ${out}`);
}

const ADS = { btp: { def: BTP, build: buildBtp } };

async function main() {
  const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
  const only = arg('only')?.split(',');
  const formats = arg('format')?.split(',') ?? Object.keys(FORMATS);
  const stills = arg('stills');
  await Promise.all([OUT_DIR, DIR, TTS_DIR, SFX_DIR].map((d) => mkdir(d, { recursive: true })));
  const assets = await prepareAssets();
  const browser = await launchBrowser();
  try {
    for (const [key, ad] of Object.entries(ADS)) {
      if (only && !only.includes(key)) continue;
      console.log(`▶ ${ad.def.id}`);
      // Voix : une prise par « temps », placées bout à bout.
      let t = 0;
      const beats = [];
      for (const b of ad.def.beats) {
        const v = await speak(b.say);
        const beat = { ...b, ...v, s: t, v: t + b.pre };
        beat.e = beat.v + v.dur + b.post;
        t = beat.e;
        beats.push(beat);
      }
      console.log(`  ${beats.map((b) => `${b.k} ${b.s.toFixed(1)}`).join(' · ')} · fin ${t.toFixed(1)} s`);
      for (const fk of formats) {
        const F = FORMATS[fk];
        const { page, total, sfx } = ad.build(F, beats, assets);
        const htmlFile = path.join(DIR, `${ad.def.id}-${fk}.html`);
        if (stills) {
          const times =
            stills === 'auto'
              ? beats.flatMap((b) => [b.s + 0.35, b.v + b.dur * 0.6, b.e - 0.1])
              : stills.split(',').map(Number);
          await renderStills(browser, F, page, htmlFile, times, path.join(DIR, `${ad.def.id}-${fk}-stills.png`));
          continue;
        }
        const music = path.join(DIR, `${ad.def.id}-music.wav`);
        buildMusic(total, music);
        const audio = path.join(DIR, `${ad.def.id}-audio.m4a`);
        mixAudio(total, beats.map((b) => ({ wav: b.wav, t: b.v })), sfx, music, audio);
        if (process.argv.includes('--audio-only')) {
          console.log(`  son : ${audio}`);
          continue;
        }
        const out = path.join(OUT_DIR, `${ad.def.id}-${fk}.mp4`);
        console.log(`  ${fk} · ${total.toFixed(1)} s`);
        await renderVideo(browser, F, page, htmlFile, total, audio, out);
        if (F.V) {
          ff(['-i', out, '-vf', 'scale=720:1280:flags=lanczos', '-c:v', 'libx264', '-crf', '24', '-preset', 'medium', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-y', out.replace('.mp4', '-whatsapp.mp4')], 'whatsapp');
        }
        console.log(`  ✓ ${out}`);
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
