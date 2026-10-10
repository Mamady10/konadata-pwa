/**
 * Publicités KonaData en « motion design » : typographie animée calée mot à mot sur la voix off,
 * maquettes d'appli dessinées en HTML, transitions rapides, musique rythmée et bruitages synthétisés.
 *
 * Les pubs sont décrites dans motion-ads-content.mjs (voix, scènes, style) ; ce fichier contient
 * le moteur : bibliothèque de scènes, thèmes, synchronisation voix, rendu image par image.
 * Chaque image est calculée par un moteur de tweens dans la page (window.__frame(t)),
 * capturée par Playwright puis encodée par ffmpeg.
 *
 * Usage :
 *   node scripts/marketing/build-motion-ads.mjs                         # toutes les pubs, 9:16 et 16:9
 *   node scripts/marketing/build-motion-ads.mjs --only=btp,ecole-parents --format=9x16
 *   node scripts/marketing/build-motion-ads.mjs --only=btp --stills=auto [--still-width=540]
 *   node scripts/marketing/build-motion-ads.mjs --only=btp --audio-only
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
import { CONTACT } from './campaign-content.mjs';
import { ADS } from './motion-ads-content.mjs';

const OUT_DIR = path.join(CAMPAIGN, 'videos');
const DIR = path.join(WORK, 'motion');
const TTS_DIR = path.join(DIR, 'tts');
const SFX_DIR = path.join(DIR, 'sfx');
const ASSETS = path.join(DIR, 'assets');

const FORMATS = {
  '9x16': { W: 1080, H: 1920, V: true },
  '16x9': { W: 1920, H: 1080, V: false },
};

const C = { navy: '#0A192F', blue: '#2563EB', sky: '#38BDF8', slate: '#64748B', whatsapp: '#25D366' };

// ------------------------------------------------------------------ icônes (lucide)
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
  cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
  package:
    '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7"/>',
  wallet:
    '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  pen: '<path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>',
  calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  pin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  qr: '<rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  sparkles:
    '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>',
  trending: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  plane:
    '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  heart: ICON_PATHS.ong,
  store: ICON_PATHS.pme,
  school: ICON_PATHS.ecole,
  helmet: ICON_PATHS.btp,
};
const svgIcon = (name, size, color, sw = 2.2) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;

// ------------------------------------------------------------------ thèmes
/** Palettes par secteur : accent sur fond sombre (em), sur fond clair (emL), dégradé, fonds profonds. */
const PALETTES = {
  blue: { em: '#38BDF8', emL: '#2563EB', glow: '#0F2A4D', deep: ['#0B1F3F', '#123A73'], blobs: ['#93C5FD', '#C4B5FD'], grad: 'linear-gradient(90deg,#38BDF8,#2563EB)' },
  indigo: { em: '#FDBA74', emL: '#EA580C', glow: '#312E81', deep: ['#1E1B4B', '#3B0764'], blobs: ['#FDBA74', '#C4B5FD'], grad: 'linear-gradient(90deg,#F97316,#EC4899)' },
  emerald: { em: '#6EE7B7', emL: '#059669', glow: '#064E3B', deep: ['#022C22', '#065F46'], blobs: ['#6EE7B7', '#FDE68A'], grad: 'linear-gradient(90deg,#059669,#65A30D)' },
  violet: { em: '#C4B5FD', emL: '#7C3AED', glow: '#3B0764', deep: ['#2E1065', '#5B21B6'], blobs: ['#C4B5FD', '#FCD34D'], grad: 'linear-gradient(90deg,#7C3AED,#F59E0B)' },
  amber: { em: '#FBBF24', emL: '#EA580C', glow: '#431407', deep: ['#1C0F05', '#7C2D12'], blobs: ['#FDBA74', '#FDE68A'], grad: 'linear-gradient(90deg,#EA580C,#F59E0B)' },
};

function makeTheme(style, palette) {
  const p = PALETTES[palette];
  if (style === 'aurora') {
    return {
      font: "'Plus Jakarta Sans'",
      music: 'bright',
      accent: p.emL,
      dark: {
        bg: `radial-gradient(60% 50% at 90% 0%,${p.blobs[0]}55,transparent 70%),radial-gradient(60% 50% at 0% 100%,${p.blobs[1]}44,transparent 70%),linear-gradient(160deg,${p.deep[0]},${p.deep[1]})`,
        fg: '#FFFFFF', em: p.grad.replace('90deg', '90deg'), sub: 'rgba(255,255,255,.7)', line: 'rgba(255,255,255,.2)', accent: p.em,
      },
      light: {
        bg: `radial-gradient(45% 40% at 95% 5%,${p.blobs[0]}AA,transparent 70%),radial-gradient(50% 45% at 0% 100%,${p.blobs[1]}99,transparent 70%),#FBF8F4`,
        fg: '#1E1B4B', em: p.grad, sub: '#64607D', line: 'rgba(30,27,75,.12)', accent: p.emL,
      },
    };
  }
  if (style === 'clean') {
    return {
      font: "'Sora'",
      music: 'groove',
      accent: p.emL,
      dark: {
        bg: `radial-gradient(70% 60% at 80% 10%,${p.deep[1]},${p.deep[0]})`,
        fg: '#FFFFFF', em: p.em, sub: 'rgba(255,255,255,.68)', line: 'rgba(255,255,255,.18)', accent: p.em,
      },
      light: {
        bg: `linear-gradient(rgba(15,23,42,.035) 1px,transparent 1px) 0 0/64px 64px,linear-gradient(90deg,rgba(15,23,42,.035) 1px,transparent 1px) 0 0/64px 64px,#FFFFFF`,
        fg: '#0F172A', em: p.emL, sub: '#64748B', line: 'rgba(15,23,42,.1)', accent: p.emL,
      },
    };
  }
  return {
    font: "'Inter'",
    music: 'drive',
    accent: p.em,
    dark: {
      bg: `radial-gradient(120% 70% at 85% 0%,${p.glow} 0%,#07111F 60%)`,
      fg: '#FFFFFF', em: p.em, sub: 'rgba(255,255,255,.62)', line: 'rgba(255,255,255,.18)', accent: p.em,
    },
    light: {
      bg: 'radial-gradient(120% 80% at 20% 0%,#FFFFFF 0%,#EEF3FA 100%)',
      fg: C.navy, em: p.emL, sub: C.slate, line: 'rgba(15,23,42,.1)', accent: p.emL,
    },
  };
}

// ------------------------------------------------------------------ voix off (mot à mot)
const norm = (s) =>
  String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

async function speak(text, voice) {
  const key = createHash('md5').update(`${voice.name}|${voice.rate}|${voice.pitch}|${text}`).digest('hex').slice(0, 16);
  const mp3 = path.join(TTS_DIR, `${key}.mp3`);
  const wav = path.join(TTS_DIR, `${key}.wav`);
  const json = `${mp3}.json`;
  if (!existsSync(wav) || !existsSync(json)) {
    for (let attempt = 1; ; attempt++) {
      try {
        const tts = new EdgeTTS({
          voice: voice.name,
          lang: 'fr-FR',
          outputFormat: 'audio-24khz-96kbitrate-mono-mp3',
          rate: voice.rate,
          pitch: voice.pitch,
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
  count(id, t0, d, from, to, suffix = '', dec = 0) {
    this.tw.push({ id, t0, d, c: [from, to], suffix, dec, e: 'out' });
    return this;
  }
  play(name, t, vol = 1) {
    this.sfx.push({ name, t: Math.max(0, t), vol });
    return this;
  }
}

// ------------------------------------------------------------------ fragments HTML
const px = (n) => `${Math.round(n)}px`;
const isGrad = (c) => String(c).includes('gradient');

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
    const parts = line
      .split(/\s+/)
      .filter(Boolean)
      .map((tok) => {
        const open = tok.startsWith('*');
        const close = tok.endsWith('*') && (tok.length > 1 || !open);
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
  const em = o.em ?? C.sky;
  const style = [
    `left:${px(o.x)}`,
    `top:${px(o.y)}`,
    `width:${px(o.w)}`,
    `font-size:${px(o.size)}`,
    `font-weight:${o.weight ?? 800}`,
    `line-height:${o.lh ?? 1.06}`,
    `color:${o.color ?? '#fff'}`,
    isGrad(em) ? `--emg:${em}` : `--em:${em}`,
    `text-align:${o.align ?? 'left'}`,
    `letter-spacing:${o.ls ?? -0.035}em`,
  ].join(';');
  return { html: `<div class="tb${isGrad(em) ? ' g' : ''}" id="${id}" data-fit="1" style="${style}">${htmlLines.join('')}</div>`, ids, words };
}

function revealWords(tl, block, times, { lead = 0.06, dur = 0.5 } = {}) {
  block.ids.forEach((id, i) => tl.to(id, times[i] - lead, dur, { ye: [1.1, 0], o: [0, 1] }, 'expo'));
}

const markImg = () => url(path.join(ASSETS, 'mark.png'));

function chrome(id, t, label) {
  return `<div class="chrome" id="${id}" style="color:${t.fg}">
    <div class="cl"><img src="${markImg()}"><b>Kona<span style="color:${t.dark ? C.sky : C.blue}">Data</span></b></div>
    <div class="cr">${esc(label)}</div>
  </div>`;
}

const STAMP_TONES = {
  green: ['#059669', '#ECFDF5'],
  red: ['#DC2626', '#FEF2F2'],
  amber: ['#D97706', '#FFFBEB'],
  blue: ['#2563EB', '#EFF6FF'],
};

/** Carte blanche de détail : en-tête (icône, titre, sous-titre), lignes, photos ou tampon. */
function cardHtml(id, o, pos) {
  const rows = (o.rows || [])
    .map((r, k) => {
      const bar = r.bar != null ? `<div class="rbar"><i id="${id}-b${k}" style="background:${r.barColor || C.blue}"></i></div>` : '';
      const badge = r.badge ? `<em class="bdg" style="color:${STAMP_TONES[r.badge.tone][0]};background:${STAMP_TONES[r.badge.tone][1]}">${esc(r.badge.text)}</em>` : '';
      return `<div class="row" id="${id}-r${k}"><div class="rl"><span>${esc(r.label)}</span>${r.sub ? `<small>${esc(r.sub)}</small>` : ''}${bar}</div><div class="rv">${badge}<b id="${id}-v${k}"${r.accent ? ` style="color:${o.accentColor || C.blue}"` : ''}>${esc(r.value)}</b></div></div>`;
    })
    .join('');
  const extra = o.photos
    ? `<div class="thumbs" id="${id}-x">${o.photos.map((p) => `<img src="${url(p)}">`).join('')}</div>`
    : o.stamp
      ? `<div class="stamp" id="${id}-x" style="color:${STAMP_TONES[o.stamp.tone || 'green'][0]};border-color:${STAMP_TONES[o.stamp.tone || 'green'][0]};background:${STAMP_TONES[o.stamp.tone || 'green'][1]}">${svgIcon(o.stamp.icon || 'check', 28, STAMP_TONES[o.stamp.tone || 'green'][0], 3)}${esc(o.stamp.text)}</div>`
      : '';
  return `<div class="card${pos.xl ? ' xl' : ''}" id="${id}" style="left:${px(pos.x)};top:${px(pos.y)};width:${px(pos.w)}">
    <div class="ch"><i style="background:${o.bg}">${svgIcon(o.icon, pos.xl ? 42 : 30, o.fg)}</i><div><b>${esc(o.title)}</b>${o.sub ? `<span>${esc(o.sub)}</span>` : ''}</div></div>
    ${rows}${extra}
  </div>`;
}

/** Anime l'apparition d'une carte (lignes en cascade, compteurs, barres, tampon). */
function animateCard(ctx, id, o, t0, { stampAt } = {}) {
  const { tl } = ctx;
  tl.to(id, t0, 0.6, { o: [0, 1], y: [80, 0], s: [0.96, 1] }, 'expo');
  (o.rows || []).forEach((r, k) => {
    const t = t0 + 0.15 + k * 0.12;
    tl.to(`${id}-r${k}`, t, 0.45, { o: [0, 1], x: [30, 0] });
    if (r.count) tl.count(`${id}-v${k}`, t + 0.1, 1.1, r.count[0], r.count[1], r.count[2] ?? '', r.count[3] ?? 0);
    if (r.bar != null) tl.to(`${id}-b${k}`, t + 0.2, 1, { w: [0, r.bar] });
  });
  if (o.photos) tl.to(`${id}-x`, t0 + 0.55, 0.5, { o: [0, 1], y: [20, 0] });
  if (o.stamp) {
    const t = stampAt ?? t0 + 0.9;
    tl.to(`${id}-x`, t, 0.35, { s: [2.2, 1], o: [0, 1], r: [-14, -6] }, 'back');
    tl.play('thump', t + 0.15, 0.7);
    tl.play('ding', t + 0.2, 0.4);
  }
}

// ------------------------------------------------------------------ téléphone (maquette d'appli)
const TILE = { w: 164, h: 112, x0: 16, y0: 296, gx: 180, gy: 126 };
const tilePos = (i) => ({ x: TILE.x0 + (i % 2) * TILE.gx, y: TILE.y0 + Math.floor(i / 2) * TILE.gy });

function phoneShell(inner, { dark = false } = {}) {
  return `<div class="phone"><div class="scr${dark ? ' dk' : ''}">${inner}</div></div>`;
}

/** Accueil d'un module : en-tête, carte de synthèse, 6 tuiles, surlignage. */
function phoneHome(prefix, ph) {
  const tiles = ph.tiles
    .map((t, i) => {
      const p = tilePos(i);
      return `<div class="tile" style="left:${p.x}px;top:${p.y}px"><i style="background:${t.bg}">${svgIcon(t.icon, 26, t.fg)}</i><span>${esc(t.label)}</span></div>
      <div class="tap" id="${prefix}tap${i}" style="left:${p.x + TILE.w / 2 - 40}px;top:${p.y + TILE.h / 2 - 40}px"></div>`;
    })
    .join('');
  const p0 = tilePos(0);
  return phoneShell(`
    <div class="ph-top">
      <div class="ph-status"><b>9:41</b><span>4G ▮▮▮ 82%</span></div>
      <div class="ph-brand"><img src="${markImg()}"><b>Kona<span>Data</span></b>${svgIcon('bell', 24, '#fff')}</div>
      <div class="ph-org">${esc(ph.org)}</div>
    </div>
    <div class="ph-site">
      <b>${esc(ph.site.title)}</b>
      <div class="ph-row"><span>${esc(ph.site.label)}</span><em id="${prefix}pct">0 %</em></div>
      <div class="ph-track"><div class="ph-fill" id="${prefix}bar"></div></div>
    </div>
    ${tiles}
    <div class="hl" id="${prefix}hl" style="left:${p0.x}px;top:${p0.y}px"></div>
    <div class="ph-nav">${['home', 'chart', 'file', 'user'].map((n, i) => svgIcon(n, 26, i === 0 ? C.blue : '#94A3B8')).join('')}</div>`);
}

/** Écrans du parcours « parent » (suivi scolarité) : formulaire, code, situation. */
function flowScreen(id, s) {
  const head = (title) => `<div class="fs-head"><div class="ph-status" style="color:#fff"><b>9:41</b><span>4G ▮▮▮</span></div><div class="fs-title">${svgIcon('school', 26, '#fff')}${esc(title)}</div></div>`;
  if (s.kind === 'form') {
    return `<div class="fs" id="${id}">${head('Suivi scolarité')}
      <div class="fs-body">
        ${s.fields.map((f, i) => `<label>${esc(f.label)}</label><div class="fld">${f.typed ? `<span id="${id}-ty${i}">${esc(f.value)}</span><i class="caret" id="${id}-cr${i}"></i>` : esc(f.value)}</div>`).join('')}
        <div class="btn" id="${id}-btn">${esc(s.button)}</div>
      </div></div>`;
  }
  if (s.kind === 'code') {
    return `<div class="fs" id="${id}">${head('Confirmation')}
      <div class="fs-body"><p class="fs-p">${esc(s.text)}</p>
        <div class="digits">${s.digits.split('').map((d, i) => `<div><span id="${id}-d${i}">${d}</span></div>`).join('')}</div>
        <div class="btn" id="${id}-btn">${esc(s.button)}</div>
      </div></div>`;
  }
  // balance
  return `<div class="fs" id="${id}">${head('Suivi scolarité')}
    <div class="fs-body">
      <div class="who"><div class="av">${esc(s.initials)}</div><div><b>${esc(s.name)}</b><span>${esc(s.klass)}</span></div></div>
      <div class="bal">
        <span>${esc(s.year)}</span>
        <div class="bal-r"><small>Payé</small><b id="${id}-paid">0</b></div>
        <div class="ph-track" style="margin:10px 0 8px"><div class="ph-fill" id="${id}-bar"></div></div>
        <div class="bal-r"><small>Reste à payer</small><b id="${id}-rest" style="color:#EA580C">${esc(s.rest)}</b></div>
      </div>
      ${s.docs.map((d, i) => `<div class="doc" id="${id}-doc${i}">${svgIcon('file', 24, C.blue)}<span>${esc(d)}</span>${svgIcon('download', 22, '#94A3B8')}</div>`).join('')}
    </div></div>`;
}

/** Écran verrouillé avec notifications WhatsApp. */
function lockScreen(prefix, sc, theme) {
  const notifs = sc.notifs
    .map(
      (n, i) => `<div class="nt" id="${prefix}n${i}"><i>${svgIcon('msg', 22, '#fff', 2.4)}</i><div><div class="nt-h"><b>WhatsApp</b><span>${esc(n.time || 'maintenant')}</span></div><b>${esc(n.title)}</b><p>${esc(n.text)}</p></div></div>`,
    )
    .join('');
  return phoneShell(
    `<div class="lock" style="background:radial-gradient(80% 60% at 30% 10%,${PALETTES[sc.palette || 'blue'].blobs[0]}88,transparent 70%),linear-gradient(170deg,${PALETTES[sc.palette || 'blue'].deep[1]},${PALETTES[sc.palette || 'blue'].deep[0]})">
      <div class="ph-status" style="color:#fff;padding:16px 24px"><b>9:41</b><span>4G ▮▮▮</span></div>
      <div class="lk-t">${svgIcon('lock', 22, '#fff')}<b>${esc(sc.clock || '18:42')}</b><span>${esc(sc.date || 'mardi 14 octobre')}</span></div>
      ${notifs}
    </div>`,
    { dark: true },
  );
}

// ------------------------------------------------------------------ bibliothèque de scènes
/**
 * Chaque scène reçoit le contexte (format, timeline, thème, temps de voix) et sa description ;
 * elle renvoie son HTML (et éventuellement un point d'origine pour la transition suivante).
 */
/** Contour simplifié de la Guinée (lon, lat), suffisant pour une silhouette. */
const GUINEA = [
  [-15.08, 10.88], [-14.68, 11.51], [-13.75, 11.81], [-13.7, 12.59], [-13.1, 12.6], [-12.35, 12.3], [-11.5, 12.4],
  [-11.37, 12.08], [-10.65, 11.92], [-10.17, 11.84], [-9.7, 12.03], [-9.33, 12.33], [-8.9, 12.19], [-8.79, 11.81],
  [-8.38, 11.39], [-8.67, 10.95], [-8.28, 10.79], [-8.23, 10.13], [-7.97, 10.17], [-7.9, 9.4], [-7.83, 8.58],
  [-8.2, 8.46], [-8.3, 8.0], [-8.44, 7.69], [-8.72, 7.71], [-8.93, 7.31], [-9.21, 7.31], [-9.4, 7.53], [-9.33, 7.93],
  [-9.75, 8.54], [-10.02, 8.43], [-10.5, 8.35], [-10.49, 8.72], [-10.62, 9.06], [-11.12, 9.89], [-12.15, 9.86],
  [-12.43, 9.84], [-12.6, 9.62], [-12.71, 9.34], [-13.25, 8.9], [-13.69, 9.49], [-14.07, 9.89], [-14.33, 10.02],
  [-14.58, 10.21], [-14.69, 10.66], [-14.84, 10.88],
];

const SCENES = {
  hook(ctx, sc, R) {
    const { W, V, M, tl } = ctx;
    const t = R.t;
    const b = ctx.beat(sc.beats[0]);
    const style = sc.style || 'ring';
    const wide = style === 'ring';
    const tb = textBlock(`${R.id}t`, sc.lines, {
      x: M,
      y: V ? (style === 'ring' ? 420 : 300) : 280,
      w: V ? W - 2 * M : wide ? 1150 : 920,
      size: V ? 108 : 104,
      color: t.fg,
      em: t.em,
    });
    revealWords(tl, tb, ctx.times(b, tb.words));
    let html = tb.html;
    let origin;
    const span = [b.v + 0.2, b.e - 0.5];
    const stagger = (n, i) => span[0] + ((span[1] - span[0]) * i) / Math.max(1, n);

    if (style === 'ring') {
      const P = V ? { cx: 540, cy: 1300, r: 170 } : { cx: 1520, cy: 560, r: 170 };
      origin = { x: P.cx, y: P.cy };
      html += `<div class="dash" id="${R.id}d" style="border-color:${t.accent}AA;left:${P.cx - P.r - 40}px;top:${P.cy - P.r - 40}px;width:${2 * P.r + 80}px;height:${2 * P.r + 80}px"></div>
        <div class="ring" id="${R.id}r" style="border-color:${t.fg};color:${t.fg};left:${P.cx - P.r}px;top:${P.cy - P.r}px;width:${2 * P.r}px;height:${2 * P.r}px">${svgIcon(sc.icon || 'helmet', 120, t.fg, 1.8)}</div>`;
      tl.to(`${R.id}r`, R.s + 0.15, 0.7, { s: [0, 1], o: [0, 1] }, 'back');
      tl.to(`${R.id}d`, R.s + 0.3, 0.7, { s: [0.6, 1], o: [0, 1] });
      tl.to(`${R.id}d`, R.s + 0.3, b.e - R.s + 1, { r: [0, 120] }, 'lin');
      tl.to(`${R.id}r`, b.e - 0.35, 0.35, { s: [1, 1.12] }, 'in');
    } else if (style === 'menu') {
      const P = V ? { x: M, y: 1010, w: W - 2 * M } : { x: 1130, y: 250, w: 660 };
      origin = { x: P.x + P.w - 30, y: P.y + 30 };
      html += `<div class="menu" id="${R.id}m" style="left:${P.x}px;top:${P.y}px;width:${P.w}px">
        <div class="mh">${svgIcon(sc.menu.icon || 'clipboard', 30, t.accent)}<b>${esc(sc.menu.title)}</b></div>
        ${sc.menu.items.map((it, i) => `<div class="mi" id="${R.id}i${i}"><i></i><span>${esc(it)}</span></div>`).join('')}
        <div class="qb" id="${R.id}q">?</div>
      </div>`;
      tl.to(`${R.id}m`, R.s + 0.2, 0.7, { o: [0, 1], y: [60, 0], s: [0.95, 1] }, 'expo');
      sc.menu.items.forEach((_, i) => {
        const at = stagger(sc.menu.items.length, i);
        tl.to(`${R.id}i${i}`, at, 0.45, { o: [0, 1], x: [40, 0] }, 'expo');
        tl.play('tick', at, 0.6);
      });
      tl.to(`${R.id}q`, b.e - 0.75, 0.5, { s: [0, 1], o: [0, 1] }, 'back');
      tl.to(`${R.id}q`, b.e - 0.25, 0.25, { r: [0, 14] }, 'out');
      tl.play('pop', b.e - 0.7, 0.8);
    } else if (style === 'chat') {
      const P = V ? { x: M, y: 860, w: W - 2 * M, h: 900 } : { x: 1100, y: 150, w: 700, h: 800 };
      origin = { x: P.x + P.w / 2, y: P.y + P.h / 2 };
      html += `<div class="chat" id="${R.id}c" style="left:${P.x}px;top:${P.y}px;width:${P.w}px;height:${P.h}px">
        <div class="chh"><div class="av">${esc(sc.chat.initials || 'GS')}</div><div><b>${esc(sc.chat.name)}</b><span>en ligne</span></div></div>
        <div class="chb">${sc.chat.messages.map((m, i) => `<div class="bub2 ${m.out ? 'out' : 'in'}" id="${R.id}b${i}">${esc(m.text)}<small>${esc(m.time || '')}${m.out ? ' ✓✓' : ''}</small></div>`).join('')}</div>
      </div>`;
      tl.to(`${R.id}c`, R.s + 0.2, 0.7, { o: [0, 1], y: [60, 0] }, 'expo');
      sc.chat.messages.forEach((m, i) => {
        const at = stagger(sc.chat.messages.length, i);
        tl.to(`${R.id}b${i}`, at, 0.45, { o: [0, 1], s: [0.6, 1], y: [20, 0] }, 'back');
        tl.play('pop', at, 0.5);
      });
    } else if (style === 'papers') {
      const P = V ? { cx: 540, cy: 1330 } : { cx: 1450, cy: 560 };
      origin = { x: P.cx, y: P.cy };
      const rots = [-9, 6, -4, 10, -2];
      html += sc.papers
        .map(
          (lines, i) => `<div class="paper" id="${R.id}p${i}" style="left:${P.cx - 190 + (i % 2 ? 26 : -26)}px;top:${P.cy - 240 + i * 8}px">
            ${lines.map((l) => `<div>${esc(l)}</div>`).join('')}</div>`,
        )
        .join('');
      html += `<div class="qb big" id="${R.id}q" style="left:${P.cx + 120}px;top:${P.cy - 300}px">?</div>`;
      sc.papers.forEach((_, i) => {
        const at = stagger(sc.papers.length, i) - 0.2;
        tl.to(`${R.id}p${i}`, at, 0.6, { y: [-1400, 0], r: [rots[i] * 4, rots[i]], o: [1, 1] }, 'expo');
        tl.play('thump', at + 0.25, 0.35);
      });
      tl.to(`${R.id}q`, b.e - 0.7, 0.5, { s: [0, 1], o: [0, 1], r: [-30, 8] }, 'back');
      tl.play('pop', b.e - 0.65, 0.8);
    }
    return { html, origin };
  },

  logo(ctx, sc, R) {
    const { W, V, tl } = ctx;
    const t = R.t;
    const b = ctx.beat(sc.beats[0]);
    const M = V ? { cx: 540, cy: 760, size: 250 } : { cx: 960, cy: 400, size: 220 };
    const wm = V ? { y: 960, size: 150 } : { y: 560, size: 140 };
    const tag = textBlock(`${R.id}g`, sc.tagline, {
      x: V ? 90 : 200,
      y: V ? 1190 : 770,
      w: V ? 900 : 1520,
      size: V ? 64 : 58,
      align: 'center',
      color: t.fg,
      em: t.em,
    });
    const html = `<div class="mark" id="${R.id}m" style="left:${M.cx - M.size / 2}px;top:${M.cy - M.size / 2}px;width:${M.size}px;height:${M.size}px"><img src="${markImg()}"></div>
      <div class="wm" id="${R.id}w" style="left:0;width:${W}px;text-align:center;top:${wm.y}px;font-size:${wm.size}px;color:${t.fg}">Kona<span style="color:${t.dark ? C.sky : C.blue}">Data</span></div>
      <div class="a" id="${R.id}u" style="left:${W / 2 - 160}px;top:${wm.y + wm.size * 1.14}px;width:320px;height:8px;border-radius:4px;background:${isGrad(t.em) ? t.em : `linear-gradient(90deg,${C.blue},${C.sky})`}"></div>
      ${tag.html}`;
    const [tKona] = ctx.times(b, ['Kona']);
    tl.to(`${R.id}m`, R.s + 0.3, 0.7, { s: [0, 1], r: [-25, 0], o: [0, 1] }, 'back');
    tl.to(`${R.id}w`, tKona - 0.1, 0.6, { cr: [100, 0], o: [0, 1], y: [30, 0] }, 'expo');
    tl.to(`${R.id}u`, tKona + 0.35, 0.6, { sx: [0, 1], o: [0, 1] }, 'expo');
    revealWords(tl, tag, ctx.times(b, tag.words));
    tl.play('pop', R.s + 0.35, 0.7);
    return { html };
  },

  /** Téléphone + titres + cartes de détail (une « fonction » par temps de voix). */
  phone(ctx, sc, R) {
    const { W, H, V, M, tl } = ctx;
    const t = R.t;
    const L = V
      ? { phone: { x: (W - 460) / 2, y: 130, k: 1.15 }, idx: { x: M, y: 1135 }, title: { x: M, y: 1175, w: W - 2 * M, size: 112 }, sub: 62, card: { x: M, y: 1430, w: W - 2 * M }, dashes: { x: 640, y: 1147 } }
      : { phone: { x: 250, y: 120, k: 1 }, idx: { x: 820, y: 210 }, title: { x: 820, y: 255, w: 1000, size: 116 }, sub: 66, card: { x: 820, y: 560, w: 640 }, dashes: { x: 1500, y: 222 } };
    const feats = sc.features;
    const flow = !!sc.screens;
    const pre = `${R.id}`;
    let phoneInner;
    if (flow) {
      phoneInner = phoneShell(sc.screens.map((s, i) => flowScreen(`${pre}fs${i}`, s)).join(''));
    } else {
      phoneInner = phoneHome(pre, sc.phone);
    }
    const titles = feats.map((f, i) => ({
      tb: textBlock(`${pre}ft${i}`, [f.title[0]], { ...L.title, weight: 800, color: t.fg, em: t.em }),
      sb: textBlock(`${pre}fs${i}t`, [f.title[1]], { x: L.title.x, y: L.title.y + L.title.size * 1.1, w: L.title.w, size: L.sub, weight: 600, color: t.sub, em: t.em }),
    }));
    const cards = feats.map((f, i) => (f.card ? cardHtml(`${pre}cd${i}`, cardStyle(f.card, sc), L.card) : '')).join('');
    const html = `<div class="a" id="${pre}ph" style="left:${L.phone.x}px;top:${L.phone.y}px"><div style="transform:scale(${L.phone.k});transform-origin:0 0">${phoneInner}</div></div>
      ${feats.map((_, i) => `<div class="idx" id="${pre}ix${i}" style="color:${t.accent};left:${L.idx.x}px;top:${L.idx.y}px;opacity:0">0${i + 1} / 0${feats.length}</div>`).join('')}
      ${titles.map((x, i) => `<div id="${pre}tg${i}" class="a" style="left:0;top:0">${x.tb.html}${x.sb.html}</div>`).join('')}
      <div class="dashes" id="${pre}dd" style="left:${L.dashes.x}px;top:${L.dashes.y}px">${feats.map((_, i) => `<div style="background:${t.line}"><i id="${pre}dh${i}" style="background:${t.accent}"></i></div>`).join('')}</div>
      ${cards}`;
    const first = ctx.beat(feats[0].beat);
    tl.to(`${pre}ph`, R.s + 0.15, 0.8, { y: [H * 0.5, 0], r: [8, 0] }, 'expo');
    tl.to(`${pre}dd`, R.s + 0.5, 0.5, { o: [0, 1] });
    if (!flow) {
      tl.to(`${pre}bar`, R.s + 0.7, 1.2, { w: [0, sc.phone.site.pct] });
      tl.count(`${pre}pct`, R.s + 0.7, 1.2, 0, sc.phone.site.pct, ' %');
    }
    const p0 = tilePos(0);
    feats.forEach((f, i) => {
      const b = ctx.beat(f.beat);
      const next = i < feats.length - 1 ? ctx.beat(feats[i + 1].beat).s : R.end + 0.6;
      if (flow) {
        const sid = `${pre}fs${f.screen}`;
        const prev = i ? `${pre}fs${feats[i - 1].screen}` : null;
        if (prev && prev !== sid) {
          tl.to(prev, b.s, 0.5, { x: [0, -376] }, 'inout');
          tl.to(sid, b.s, 0.5, { x: [376, 0] }, 'inout');
        } else if (!prev) {
          tl.to(sid, 0, 0.001, { x: [0, 0] });
        }
        animateScreen(ctx, sid, sc.screens[f.screen], b);
      } else {
        const p = tilePos(f.tile);
        const prev = i ? tilePos(feats[i - 1].tile) : p0;
        if (i === 0) tl.to(`${pre}hl`, b.v - 0.2, 0.4, { o: [0, 1], s: [1.15, 1], x: [p.x - p0.x, p.x - p0.x], y: [p.y - p0.y, p.y - p0.y] }, 'back');
        else tl.to(`${pre}hl`, b.s, 0.45, { x: [prev.x - p0.x, p.x - p0.x], y: [prev.y - p0.y, p.y - p0.y] }, 'inout');
        tl.to(`${pre}tap${f.tile}`, b.s + 0.4, 0.6, { s: [0.2, 1.8], o: [0.9, 0] });
        tl.play('pop', b.s + 0.4, 0.6);
      }
      tl.to(`${pre}ix${i}`, b.s + 0.15, 0.4, { o: [0, 1], y: [20, 0] });
      tl.to(`${pre}ix${i}`, next - 0.05, 0.3, { o: [1, 0], y: [0, -20] }, 'in');
      const { tb, sb } = titles[i];
      revealWords(tl, tb, ctx.times(b, tb.words));
      revealWords(tl, sb, ctx.times(b, sb.words));
      tl.to(`${pre}tg${i}`, next - 0.05, 0.35, { y: [0, -60], o: [1, 0] }, 'in');
      tl.to(`${pre}dh${i}`, b.s, next - b.s, { w: [0, 100] }, 'lin');
      if (f.card) {
        const cid = `${pre}cd${i}`;
        const stampAt = f.card.stampWord ? ctx.times(b, [f.card.stampWord])[0] + 0.2 : undefined;
        animateCard(ctx, cid, f.card, b.s + 0.35, { stampAt });
        tl.to(cid, next - 0.05, 0.3, { o: [1, 0], y: [0, -40] }, 'in');
      }
    });
    if (!flow && sc.finalTile != null) {
      const last = feats.at(-1);
      const pl = tilePos(last.tile);
      const pr = tilePos(sc.finalTile);
      tl.to(`${pre}hl`, R.end - 0.5, 0.4, { x: [pl.x - p0.x, pr.x - p0.x], y: [pl.y - p0.y, pr.y - p0.y] }, 'inout');
      tl.to(`${pre}tap${sc.finalTile}`, R.end - 0.15, 0.6, { s: [0.2, 1.8], o: [0.9, 0] });
      tl.play('pop', R.end - 0.15, 0.6);
    }
    void first;
    return { html };
  },

  /** Étapes façon « parcours » : barre de progression, titre, carte par étape. */
  steps(ctx, sc, R) {
    const { W, V, M, tl } = ctx;
    const t = R.t;
    const n = sc.steps.length;
    const L = V
      ? { bar: { x: M, y: 250, w: W - 2 * M }, title: { x: M, y: 420, w: W - 2 * M, size: 110 }, sub: 64, card: { x: M, y: 800, w: W - 2 * M, xl: true }, num: { x: W - M - 150, y: 1560 } }
      : { bar: { x: M, y: 200, w: W - 2 * M }, title: { x: M, y: 360, w: 860, size: 112 }, sub: 64, card: { x: 1060, y: 330, w: 740 }, num: { x: M, y: 760 } };
    const pre = R.id;
    const seg = L.bar.w / (n - 1);
    const dots = sc.steps
      .map((s, i) => `<div class="sd" id="${pre}sd${i}" style="left:${L.bar.x + i * seg - 14}px;top:${L.bar.y - 14}px;border-color:${t.accent}"></div>
        <div class="sl" style="left:${L.bar.x + i * seg - 110}px;top:${L.bar.y + 26}px;color:${t.sub}">${esc(s.label)}</div>`)
      .join('');
    const titles = sc.steps.map((s, i) => ({
      tb: textBlock(`${pre}st${i}`, [s.title[0]], { ...L.title, color: t.fg, em: t.em }),
      sb: textBlock(`${pre}ss${i}`, [s.title[1]], { x: L.title.x, y: L.title.y + L.title.size * 1.1, w: L.title.w, size: L.sub, weight: 700, color: t.fg, em: t.em }),
    }));
    const html = `<div class="a" style="left:${L.bar.x}px;top:${L.bar.y - 3}px;width:${L.bar.w}px;height:6px;border-radius:3px;background:${t.line}"></div>
      <div class="a" id="${pre}sf" style="left:${L.bar.x}px;top:${L.bar.y - 3}px;width:${L.bar.w}px;height:6px;border-radius:3px;background:${isGrad(t.em) ? t.em : t.accent};transform-origin:0 50%"></div>
      ${dots}
      ${titles.map((x, i) => `<div id="${pre}tg${i}" class="a" style="left:0;top:0">${x.tb.html}${x.sb.html}</div>`).join('')}
      ${sc.steps.map((s, i) => `<div class="stepn" id="${pre}n${i}" style="left:${L.num.x}px;top:${L.num.y}px;background:${isGrad(t.em) ? t.em : t.accent}">${i + 1}</div>`).join('')}
      ${sc.steps.map((s, i) => (s.card ? cardHtml(`${pre}cd${i}`, cardStyle(s.card, sc), L.card) : '')).join('')}`;
    tl.to(`${pre}sf`, R.s, 0.001, { sx: [0, 0] });
    sc.steps.forEach((s, i) => {
      const b = ctx.beat(s.beat);
      const next = i < n - 1 ? ctx.beat(sc.steps[i + 1].beat).s : R.end + 0.6;
      tl.to(`${pre}sf`, b.s + 0.1, 0.6, { sx: [i ? (i - 1) / (n - 1) : 0, i / (n - 1)] }, 'inout');
      tl.to(`${pre}sd${i}`, b.s + 0.4, 0.4, { s: [0.4, 1], o: [0.4, 1] }, 'back');
      tl.play('tick', b.s + 0.45, 0.6);
      const { tb, sb } = titles[i];
      revealWords(tl, tb, ctx.times(b, tb.words));
      revealWords(tl, sb, ctx.times(b, sb.words));
      tl.to(`${pre}tg${i}`, next - 0.05, 0.35, { y: [0, -60], o: [1, 0] }, 'in');
      tl.to(`${pre}n${i}`, b.s + 0.3, 0.5, { s: [0, 1], o: [0, 1], r: [-40, 0] }, 'back');
      tl.to(`${pre}n${i}`, next - 0.05, 0.3, { s: [1, 0.6], o: [1, 0] }, 'in');
      if (s.card) {
        const cid = `${pre}cd${i}`;
        const stampAt = s.card.stampWord ? ctx.times(b, [s.card.stampWord])[0] + 0.2 : undefined;
        animateCard(ctx, cid, s.card, b.s + 0.4, { stampAt });
        tl.to(cid, next - 0.05, 0.3, { o: [1, 0], y: [0, -40] }, 'in');
      }
    });
    return { html };
  },

  /** Indicateurs + histogramme animé. */
  chart(ctx, sc, R) {
    const { W, V, M, tl } = ctx;
    const t = R.t;
    const b = ctx.beat(sc.beats[0]);
    const pre = R.id;
    const L = V
      ? { title: { x: M, y: 250, w: W - 2 * M, size: 104 }, kpi: { x: M, y: 560, w: W - 2 * M }, chart: { x: M, y: 820, w: W - 2 * M, h: 860 } }
      : { title: { x: M, y: 230, w: 800, size: 100 }, kpi: { x: M, y: 560, w: 800 }, chart: { x: 1000, y: 170, w: 800, h: 760 } };
    const tb = textBlock(`${pre}t`, sc.lines, { ...L.title, color: t.fg, em: t.em });
    const kw = (L.kpi.w - (sc.kpis.length - 1) * 20) / sc.kpis.length;
    const kpis = sc.kpis
      .map((k, i) => `<div class="kpi" id="${pre}k${i}" style="left:${L.kpi.x + i * (kw + 20)}px;top:${L.kpi.y}px;width:${kw}px"><span>${esc(k.label)}</span><b id="${pre}kv${i}" style="color:${k.color || '#0F172A'}">${esc(k.value)}</b></div>`)
      .join('');
    const g = sc.bars;
    const max = g.max ?? Math.max(...g.series.flatMap((s) => s.values));
    const inner = { x: 40, y: 110, w: L.chart.w - 80, h: L.chart.h - 200 };
    const gw = inner.w / g.labels.length;
    const bw = Math.min(70, (gw - 30) / g.series.length);
    const bars = g.labels
      .map((lab, j) => {
        const cols = g.series
          .map((s, k) => {
            const hpx = (s.values[j] / max) * inner.h;
            const x = inner.x + j * gw + (gw - bw * g.series.length - 8 * (g.series.length - 1)) / 2 + k * (bw + 8);
            return `<div class="bar" id="${pre}b${j}-${k}" style="left:${x}px;top:${inner.y + inner.h - hpx}px;width:${bw}px;height:${hpx}px;background:${s.color}"></div>`;
          })
          .join('');
        return `${cols}<div class="blab" style="left:${inner.x + j * gw}px;top:${inner.y + inner.h + 16}px;width:${gw}px">${esc(lab)}</div>`;
      })
      .join('');
    const legend = g.series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('');
    const html = `${tb.html}${kpis}
      <div class="chartc" id="${pre}c" style="left:${L.chart.x}px;top:${L.chart.y}px;width:${L.chart.w}px;height:${L.chart.h}px">
        <div class="cht"><b>${esc(g.title)}</b><div class="lg">${legend}</div></div>
        ${[0, 0.25, 0.5, 0.75, 1].map((q) => `<div class="gl" style="left:${inner.x}px;width:${inner.w}px;top:${inner.y + inner.h * (1 - q)}px"></div>`).join('')}
        ${bars}
      </div>`;
    revealWords(tl, tb, ctx.times(b, tb.words));
    tl.to(`${pre}c`, R.s + 0.3, 0.7, { o: [0, 1], y: [80, 0] }, 'expo');
    g.labels.forEach((_, j) =>
      g.series.forEach((s, k) => tl.to(`${pre}b${j}-${k}`, R.s + 0.7 + j * 0.12 + k * 0.05, 0.8, { sy: [0, 1] }, 'expo')),
    );
    sc.kpis.forEach((k, i) => {
      const at = k.word ? ctx.times(b, [k.word])[0] - 0.1 : b.v + 0.4 + i * 0.25;
      tl.to(`${pre}k${i}`, at, 0.5, { o: [0, 1], y: [30, 0], s: [0.9, 1] }, 'back');
      if (k.count) tl.count(`${pre}kv${i}`, at + 0.1, 1.1, k.count[0], k.count[1], k.count[2] ?? '', k.count[3] ?? 0);
      tl.play('tick', at, 0.6);
    });
    return { html };
  },

  /** Liste dans une carte : lignes avec barres de progression et pastilles. */
  list(ctx, sc, R) {
    const { W, V, M, tl } = ctx;
    const t = R.t;
    const b = ctx.beat(sc.beats[0]);
    const pre = R.id;
    const L = V
      ? { title: { x: M, y: 260, w: W - 2 * M, size: 108 }, card: { x: M, y: 640, w: W - 2 * M, xl: true } }
      : { title: { x: M, y: 300, w: 820, size: 104 }, card: { x: 1000, y: 170, w: 800 } };
    const tb = textBlock(`${pre}t`, sc.lines, { ...L.title, color: t.fg, em: t.em });
    const card = cardHtml(`${pre}cd`, cardStyle(sc.card, sc), L.card);
    revealWords(tl, tb, ctx.times(b, tb.words));
    const t0 = sc.card.at ? ctx.times(b, [sc.card.at])[0] - 0.3 : R.s + 0.4;
    animateCard(ctx, `${pre}cd`, sc.card, t0, { stampAt: sc.card.stampWord ? ctx.times(b, [sc.card.stampWord])[0] + 0.2 : undefined });
    (sc.card.rows || []).forEach((r, k) => {
      if (r.badge) tl.to(`${pre}cd-r${k}`, t0 + 0.9 + k * 0.15, 0.3, { s: [1, 1.03] }, 'out').to(`${pre}cd-r${k}`, t0 + 1.2 + k * 0.15, 0.3, { s: [1.03, 1] }, 'out');
    });
    return { html: tb.html + card };
  },

  /** Carte stylisée de la Guinée : points de collecte qui apparaissent. */
  map(ctx, sc, R) {
    const { W, H, V, M, tl } = ctx;
    const t = R.t;
    const b = ctx.beat(sc.beats[0]);
    const pre = R.id;
    const L = V
      ? { title: { x: M, y: 240, w: W - 2 * M, size: 108 }, map: { x: 60, y: 620, w: W - 120, h: 900 }, badge: { x: M, y: 1600 } }
      : { title: { x: M, y: 280, w: 760, size: 104 }, map: { x: 880, y: 120, w: 960, h: 840 }, badge: { x: M, y: 620 } };
    const tb = textBlock(`${pre}t`, sc.lines, { ...L.title, color: t.fg, em: t.em });
    const bounds = { lon: [-15.2, -7.5], lat: [7.0, 12.8] };
    const k = Math.min((L.map.w - 80) / (bounds.lon[1] - bounds.lon[0]), (L.map.h - 80) / (bounds.lat[1] - bounds.lat[0]));
    const ox = L.map.x + (L.map.w - k * (bounds.lon[1] - bounds.lon[0])) / 2;
    const oy = L.map.y + (L.map.h - k * (bounds.lat[1] - bounds.lat[0])) / 2;
    const proj = (lon, lat) => ({ x: ox + (lon - bounds.lon[0]) * k, y: oy + (bounds.lat[1] - lat) * k });
    const outline = GUINEA.map(([lon, lat]) => proj(lon, lat)).map((p) => `${(p.x - L.map.x).toFixed(1)},${(p.y - L.map.y).toFixed(1)}`).join(' ');
    // Points de réponses : nuages autour des localités, pseudo-aléatoires mais stables.
    let seed = 7;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const dots = [];
    sc.places.forEach((pl, i) => {
      for (let k = 0; k < pl.n; k++) {
        const a = rnd() * Math.PI * 2;
        const r = Math.sqrt(rnd()) * 0.45;
        dots.push({ ...proj(pl.lon + Math.cos(a) * r, pl.lat + Math.sin(a) * r * 0.8), i, k });
      }
    });
    const colors = sc.legend ? [t.accent, '#F59E0B', '#3B82F6', '#EC4899'] : [t.accent];
    const html = `${tb.html}
      <svg class="a" id="${pre}gn" width="${L.map.w}" height="${L.map.h}" style="left:${L.map.x}px;top:${L.map.y}px;overflow:visible"><polygon points="${outline}" fill="${t.dark ? 'rgba(255,255,255,.06)' : 'rgba(15,23,42,.05)'}" stroke="${t.accent}" stroke-width="4" stroke-linejoin="round" stroke-opacity=".55"/></svg>
      ${dots.map((d, j) => `<div class="a dot" id="${pre}d${j}" style="left:${d.x - 7}px;top:${d.y - 7}px;background:${colors[d.k % colors.length]}"></div>`).join('')}
      ${sc.places.map((pl, i) => {
        const p = proj(pl.lon, pl.lat);
        const left = pl.side === 'left' || p.x > L.map.x + L.map.w * 0.68 ? p.x - 16 - (60 + pl.name.length * 17) : p.x + 16;
        return `<div class="a plab" id="${pre}l${i}" style="left:${left}px;top:${p.y - 44}px;color:${t.fg}">${svgIcon('pin', 26, t.accent)}${esc(pl.name)}</div>`;
      }).join('')}
      <div class="kpi" id="${pre}k" style="left:${L.badge.x}px;top:${L.badge.y}px;width:${V ? 420 : 380}px"><span>${esc(sc.counter.label)}</span><b id="${pre}kv" style="color:${t.accent}">0</b></div>
      <div class="a legend" style="left:${L.map.x + 30}px;top:${L.map.y + L.map.h - 70}px;color:${t.sub}">${(sc.legend || []).map((x, i) => `<span><i style="background:${colors[i]}"></i>${esc(x)}</span>`).join('')}</div>`;
    revealWords(tl, tb, ctx.times(b, tb.words));
    tl.to(`${pre}gn`, R.s + 0.2, 0.8, { o: [0, 1], s: [0.92, 1] }, 'expo');
    const span = [R.s + 0.6, b.e - 0.6];
    dots.forEach((d, j) => {
      const at = span[0] + ((span[1] - span[0]) * j) / dots.length;
      tl.to(`${pre}d${j}`, at, 0.4, { s: [0, 1], o: [0, 0.95] }, 'back');
    });
    sc.places.forEach((_, i) => {
      const at = span[0] + ((span[1] - span[0]) * i) / sc.places.length;
      tl.to(`${pre}l${i}`, at, 0.4, { o: [0, 1], y: [15, 0] });
      tl.play('tick', at, 0.5);
    });
    tl.to(`${pre}k`, R.s + 0.6, 0.5, { o: [0, 1], s: [0.85, 1] }, 'back');
    tl.count(`${pre}kv`, R.s + 0.6, span[1] - span[0], 0, sc.counter.to);
    void H;
    return { html };
  },

  /** Écran verrouillé : notifications WhatsApp qui tombent. */
  notif(ctx, sc, R) {
    const { W, H, V, M, tl } = ctx;
    const t = R.t;
    const b = ctx.beat(sc.beats[0]);
    const pre = R.id;
    const L = V
      ? { title: { x: M, y: 230, w: W - 2 * M, size: 104 }, phone: { x: (W - 580) / 2, y: 640, k: 1.45 } }
      : { title: { x: M, y: 300, w: 820, size: 104 }, phone: { x: 1150, y: 100, k: 1 } };
    const tb = textBlock(`${pre}t`, sc.lines, { ...L.title, color: t.fg, em: t.em });
    const html = `${tb.html}<div class="a" id="${pre}ph" style="left:${L.phone.x}px;top:${L.phone.y}px"><div style="transform:scale(${L.phone.k});transform-origin:0 0">${lockScreen(pre, sc, ctx.theme)}</div></div>`;
    revealWords(tl, tb, ctx.times(b, tb.words));
    tl.to(`${pre}ph`, R.s + 0.15, 0.8, { y: [H * 0.4, 0] }, 'expo');
    sc.notifs.forEach((n, i) => {
      const at = n.at ? ctx.times(b, [n.at])[0] - 0.1 : b.v + 0.5 + i * 0.9;
      tl.to(`${pre}n${i}`, at, 0.55, { o: [0, 1], y: [-120, 0], s: [0.9, 1] }, 'back');
      tl.play('ding', at + 0.05, 0.35);
    });
    return { html };
  },

  /** Documents PDF en éventail + pastilles. */
  docs(ctx, sc, R) {
    const { W, V, M, tl } = ctx;
    const t = R.t;
    const b = ctx.beat(sc.beats[0]);
    const pre = R.id;
    const L = V
      ? { title: { x: M, y: 230, w: W - 2 * M, size: 104 }, chipsY: 590, pages: [{ x: 120, y: 790, w: 520, r: -6 }, { x: 440, y: 730, w: 520, r: 6 }] }
      : { title: { x: M, y: 280, w: 900, size: 104 }, chipsY: 680, pages: [{ x: 1060, y: 130, w: 520, r: -6 }, { x: 1330, y: 170, w: 500, r: 6 }] };
    const pages = sc.pages.slice(0, 2);
    const one = pages.length === 1;
    const tb = textBlock(`${pre}t`, sc.lines, { ...L.title, color: t.fg, em: t.em });
    let x = L.title.x;
    const chips = sc.chips
      .map((c, i) => {
        const w = 60 + c.length * 17;
        const h = `<div class="chip${i ? ' light' : ''}" id="${pre}c${i}" style="left:${x}px;top:${L.chipsY}px;opacity:0;${i ? '' : `background:${isGrad(t.em) ? t.em : t.accent}`}">${esc(c)}</div>`;
        x += w + 18;
        return h;
      })
      .join('');
    const pos = one ? [{ ...L.pages[1], x: V ? 250 : 1250, w: V ? 580 : 560, r: 3 }] : L.pages;
    const html = `${tb.html}${chips}
      ${pages.map((p, i) => `<div class="page" id="${pre}p${i}" style="left:${pos[i].x}px;top:${pos[i].y}px;width:${pos[i].w}px;opacity:0"><img src="${url(p)}"></div>`).join('')}`;
    revealWords(tl, tb, ctx.times(b, tb.words));
    const tChips = ctx.times(b, sc.chipWords || sc.chips);
    sc.chips.forEach((_, i) => tl.to(`${pre}c${i}`, tChips[i] - 0.05, 0.45, { o: [0, 1], s: [0.6, 1], y: [20, 0] }, 'back'));
    pages.forEach((_, i) => {
      const p = pos[i];
      const at = R.s + 0.45 + (pages.length - 1 - i) * 0.25;
      tl.to(`${pre}p${i}`, at, 0.9, { o: [0, 1], x: [V ? 300 : 600, 0], y: [V ? 200 : 0, 0], r: [p.r + (i ? 18 : -14), p.r] }, 'expo');
      tl.to(`${pre}p${i}`, at + 0.9, Math.max(0.5, R.end - at), { y: [0, i ? -24 : 24] }, 'lin');
    });
    tl.play('whoosh', R.s + 0.5, 0.4);
    return { html };
  },

  /** Compteur géant (offre de lancement). */
  counter(ctx, sc, R) {
    const { W, H, V, M, tl } = ctx;
    const t = R.t;
    const b = ctx.beat(sc.beats[0]);
    const pre = R.id;
    const big = String(sc.to).length > 1;
    const O = V
      ? { k: { x: M, y: 330 }, n: { x: M - 10, y: 450, size: big ? 520 : 640 }, txt: { x: M, y: 1130, w: W - 2 * M, size: 150 }, rule: 1840 }
      : { k: { x: 140, y: 200 }, n: { x: 130, y: 290, size: big ? 560 : 640 }, txt: { x: big ? 840 : 640, y: 450, w: big ? 660 : 780, size: 140 }, rule: 960 };
    const tb = textBlock(`${pre}t`, sc.unit, { ...O.txt, weight: 800, color: t.fg, em: t.em });
    const pins = V
      ? [[180, 1500], [420, 1620], [760, 1540], [900, 1700], [300, 1780], [640, 1800]]
      : [[1560, 230], [1730, 170], [1840, 390], [1660, 540], [1560, 720], [1790, 830]];
    const links = [[0, 1], [1, 2], [2, 3], [3, 4], [1, 3], [4, 5], [3, 5]];
    const svg = `<svg class="a" style="left:0;top:0" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      ${links.map(([a, c], i) => {
        const len = Math.hypot(pins[c][0] - pins[a][0], pins[c][1] - pins[a][1]);
        return `<line id="${pre}ln${i}" x1="${pins[a][0]}" y1="${pins[a][1]}" x2="${pins[c][0]}" y2="${pins[c][1]}" stroke="${t.accent}" stroke-opacity=".5" stroke-width="2" stroke-dasharray="${len}" stroke-dashoffset="${len}"/>`;
      }).join('')}</svg>`;
    const dots = pins.map(([x, y], i) => `<div class="a" id="${pre}pn${i}" style="left:${x - 11}px;top:${y - 11}px;width:22px;height:22px;border-radius:50%;background:${t.accent};box-shadow:0 0 0 8px ${t.accent}2E,0 0 30px ${t.accent};opacity:0"></div>`).join('');
    const numStyle = isGrad(t.em) ? `background:${t.em};-webkit-background-clip:text;background-clip:text;color:transparent` : `color:${t.fg}`;
    const html = `<div class="a" style="inset:0;background-image:radial-gradient(${t.line} 2px,transparent 2.5px);background-size:44px 44px;-webkit-mask-image:radial-gradient(70% 60% at ${V ? '50% 85%' : '85% 50%'},#000,transparent)"></div>
      ${svg}${dots}
      <div class="idx" id="${pre}k" style="color:${t.accent};left:${O.k.x}px;top:${O.k.y}px;opacity:0">${esc(sc.kicker)}</div>
      <div class="big" id="${pre}n" style="left:${O.n.x}px;top:${O.n.y}px;font-size:${O.n.size}px;${numStyle}">0</div>
      ${tb.html}
      <div class="a" id="${pre}r" style="left:${O.k.x}px;top:${O.rule}px;width:${W - 2 * O.k.x}px;font-size:24px;color:${t.sub};opacity:0">${esc(sc.rule)}</div>`;
    tl.to(`${pre}k`, R.s + 0.4, 0.5, { o: [0, 1], x: [-30, 0] });
    const [tNum] = ctx.times(b, [sc.word]);
    tl.count(`${pre}n`, tNum - 0.35, 0.7, 0, sc.to);
    tl.to(`${pre}n`, tNum - 0.35, 0.6, { s: [0.7, 1], o: [0, 1] }, 'back');
    tl.play('thump', tNum + 0.25, 1);
    revealWords(tl, tb, ctx.times(b, tb.words));
    pins.forEach((_, i) => tl.to(`${pre}pn${i}`, R.s + 0.5 + i * 0.12, 0.4, { o: [0, 1], s: [0, 1] }, 'back'));
    links.forEach(([a, c], i) => {
      const len = Math.hypot(pins[c][0] - pins[a][0], pins[c][1] - pins[a][1]);
      tl.to(`${pre}ln${i}`, R.s + 0.7 + i * 0.15, 0.8, { dash: [len, 0] });
    });
    tl.to(`${pre}r`, b.v + 1.2, 0.6, { o: [0, 1] });
    return { html };
  },

  /** Les fonctions viennent se fondre dans l'icône KonaData. */
  all(ctx, sc, R) {
    const { W, V, M, tl } = ctx;
    const t = R.t;
    const b = ctx.beat(sc.beats[0]);
    const pre = R.id;
    const A = V
      ? { x: M, y: 260, w: W - 2 * M, size: 104, devY: 640, icon: { cx: 540, cy: 1300, size: 250 }, R: 330 }
      : { x: M, y: 300, w: 960, size: 104, devY: 690, icon: { cx: 1480, cy: 560, size: 230 }, R: 300 };
    const tb = textBlock(`${pre}t`, sc.lines, { x: A.x, y: A.y, w: A.w, size: A.size, color: t.fg, em: t.em });
    const I = A.icon;
    const bubbles = sc.icons.map((ic, i) => {
      const ang = (-90 + (i * 360) / sc.icons.length) * (Math.PI / 180);
      return { ...ic, x: I.cx + A.R * Math.cos(ang) - 65, y: I.cy + A.R * Math.sin(ang) - 65, dx: -A.R * Math.cos(ang), dy: -A.R * Math.sin(ang) };
    });
    const chipW = (d) => (V ? 150 + d.label.length * 22 : 110 + d.label.length * 17);
    const devList = sc.chips || [];
    let cx = V ? (W - devList.reduce((s, d) => s + chipW(d), 0) + 30) / 2 : A.x;
    const devs = devList
      .map((d, i) => {
        const top = V ? I.cy + I.size / 2 + 150 : A.devY;
        const h = `<div class="chip light${V ? ' big' : ''}" id="${pre}dv${i}" style="left:${cx}px;top:${top}px;opacity:0">${svgIcon(d.icon, V ? 40 : 30, t.accent)}${esc(d.label)}</div>`;
        cx += chipW(d);
        return h;
      })
      .join('');
    const html = `${tb.html}${devs}
      ${bubbles.map((u, i) => `<div class="bub" id="${pre}bb${i}" style="left:${u.x}px;top:${u.y}px;opacity:0">${svgIcon(u.icon, 58, u.fg)}</div>`).join('')}
      <div class="mark" id="${pre}m" style="left:${I.cx - I.size / 2}px;top:${I.cy - I.size / 2}px;width:${I.size}px;height:${I.size}px"><img src="${markImg()}"></div>`;
    tl.to(`${pre}m`, R.s + 0.3, 0.6, { s: [0, 1], o: [0, 1] }, 'back');
    revealWords(tl, tb, ctx.times(b, tb.words));
    bubbles.forEach((u, i) => {
      const at = b.v + 0.05 + i * 0.1;
      tl.to(`${pre}bb${i}`, at, 0.5, { o: [0, 1], s: [0, 1], x: [u.dx, 0], y: [u.dy, 0] }, 'back');
      tl.play('tick', at + 0.1, 0.5);
    });
    const [tMerge] = ctx.times(b, [sc.mergeWord || 'seule']);
    bubbles.forEach((u, i) => tl.to(`${pre}bb${i}`, tMerge + i * 0.03, 0.45, { x: [0, u.dx], y: [0, u.dy], s: [1, 0.2], o: [1, 0] }, 'in'));
    tl.to(`${pre}m`, tMerge + 0.4, 0.25, { s: [1, 1.14] }, 'out');
    tl.to(`${pre}m`, tMerge + 0.65, 0.35, { s: [1.14, 1] }, 'out');
    tl.play('pop', tMerge + 0.45, 0.8);
    const tDev = ctx.times(b, (sc.chips || []).map((d) => d.word || d.label));
    (sc.chips || []).forEach((_, i) => tl.to(`${pre}dv${i}`, tDev[i] - 0.05, 0.45, { o: [0, 1], y: [30, 0], s: [0.8, 1] }, 'back'));
    return { html };
  },

  /** Fin : logo, slogan, WhatsApp, site + offre. */
  end(ctx, sc, R) {
    const { W, H, V, tl } = ctx;
    const t = R.t;
    const b = ctx.beat(sc.beats[0]);
    const pre = R.id;
    const E = V
      ? { cx: 540, markY: 560, markSize: 220, wmY: 830, wmSize: 140, tagY: 1050, tagSize: 66, pillY: 1330, siteY: 1490 }
      : { cx: 960, markY: 170, markSize: 180, wmY: 390, wmSize: 130, tagY: 590, tagSize: 60, pillY: 790, siteY: 935 };
    const tag = textBlock(`${pre}g`, sc.tagline, { x: 60, y: E.tagY, w: W - 120, size: E.tagSize, align: 'center', color: t.fg, em: t.em });
    const pillSize = V ? 44 : 40;
    const html = `<div class="mark" id="${pre}m" style="left:${E.cx - E.markSize / 2}px;top:${E.markY}px;width:${E.markSize}px;height:${E.markSize}px"><img src="${markImg()}"></div>
      <div class="wm" id="${pre}w" style="left:0;width:${W}px;text-align:center;top:${E.wmY}px;font-size:${E.wmSize}px;color:${t.fg}">Kona<span style="color:${t.dark ? C.sky : C.blue}">Data</span></div>
      ${tag.html}
      <div class="a" style="left:0;width:${W}px;top:${E.pillY}px;display:flex;justify-content:center"><div class="pill" id="${pre}p" style="position:relative;font-size:${pillSize}px">${svgIcon('msg', pillSize * 1.2, '#fff', 2.4)}${esc(CONTACT.whatsapp)}</div></div>
      <div class="a" id="${pre}s" style="left:0;width:${W}px;text-align:center;top:${E.siteY}px;font-size:${V ? 40 : 34}px;font-weight:700;color:${t.sub};letter-spacing:.02em">${esc(CONTACT.site)} · ${esc(sc.offer)}</div>`;
    const [tKona] = ctx.times(b, ['Kona']);
    tl.to(`${pre}m`, R.s + 0.3, 0.7, { s: [0, 1], r: [-25, 0], o: [0, 1] }, 'back');
    tl.to(`${pre}w`, tKona, 0.6, { cr: [100, 0], o: [0, 1], y: [30, 0] }, 'expo');
    revealWords(tl, tag, ctx.times(b, tag.words));
    const [tWa] = ctx.times(b, ['WhatsApp']);
    tl.to(`${pre}p`, tWa - 0.35, 0.55, { o: [0, 1], s: [0.5, 1] }, 'back');
    tl.to(`${pre}p`, tWa + 0.6, 0.3, { s: [1, 1.06] }, 'out');
    tl.to(`${pre}p`, tWa + 0.9, 0.3, { s: [1.06, 1] }, 'out');
    tl.to(`${pre}s`, tWa, 0.6, { o: [0, 1], y: [20, 0] });
    tl.play('chime', tWa - 0.3, 0.6);
    void H;
    return { html };
  },
};

/** Couleurs d'une carte : celles de la tuile référencée, ou explicites. */
function cardStyle(card, sc) {
  const tile = card.tile != null && sc.phone ? sc.phone.tiles[card.tile] : null;
  return { ...card, icon: card.icon ?? tile?.icon ?? 'file', fg: card.fg ?? tile?.fg ?? C.blue, bg: card.bg ?? tile?.bg ?? '#DBEAFE' };
}

function animateScreen(ctx, sid, s, b) {
  const { tl } = ctx;
  if (s.kind === 'form') {
    s.fields.forEach((f, i) => {
      if (!f.typed) return;
      const at = f.word ? ctx.times(b, [f.word])[0] : b.v + 0.4 + i * 0.6;
      tl.to(`${sid}-ty${i}`, at, 0.7, { cr: [100, 0] }, 'lin');
      tl.to(`${sid}-cr${i}`, at, 0.7, { o: [1, 1], x: [-200, 0] }, 'lin');
      tl.to(`${sid}-cr${i}`, at + 0.75, 0.2, { o: [1, 0] });
    });
    tl.to(`${sid}-btn`, b.e - 0.6, 0.2, { s: [1, 0.94] }, 'out');
    tl.to(`${sid}-btn`, b.e - 0.4, 0.2, { s: [0.94, 1] }, 'out');
  } else if (s.kind === 'code') {
    s.digits.split('').forEach((_, i) => {
      const at = b.v + 0.5 + i * 0.16;
      tl.to(`${sid}-d${i}`, at, 0.35, { o: [0, 1], s: [1.6, 1] }, 'back');
      tl.play('tick', at, 0.5);
    });
  } else {
    tl.count(`${sid}-paid`, b.v + 0.3, 1.3, 0, s.paid, ' GNF');
    tl.to(`${sid}-bar`, b.v + 0.3, 1.3, { w: [0, s.pct] });
    s.docs.forEach((_, i) => tl.to(`${sid}-doc${i}`, b.v + 1 + i * 0.2, 0.45, { o: [0, 1], x: [40, 0] }));
  }
}

// ------------------------------------------------------------------ CSS + moteur de la page
const PAGE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Sora:wght@400;500;600;700;800&family=Caveat:wght@500;700&display=block');
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:var(--W);height:var(--H);overflow:hidden;background:#07111F;font-family:var(--font),Inter,'Segoe UI',Arial,sans-serif;-webkit-font-smoothing:antialiased}
.sc{position:absolute;inset:0;overflow:hidden;display:none}
.tb{position:absolute}
.tb .ln{white-space:nowrap}
.m{display:inline-block;overflow:hidden;vertical-align:top;padding:0 .05em .14em;margin:0 -.05em -.14em}
.w{display:inline-block;opacity:0}
.w.em{color:var(--em)}
.tb.g .w.em{background:var(--emg);-webkit-background-clip:text;background-clip:text;color:transparent}
.a{position:absolute}
.chrome{position:absolute;left:0;right:0;top:0;display:flex;justify-content:space-between;align-items:center;padding:var(--cp)}
.chrome .cl{display:flex;align-items:center;gap:12px;font-size:30px;letter-spacing:-.02em;font-family:Inter}
.chrome .cl img{width:44px;height:44px;margin-right:4px}
.chrome .cr{font-size:20px;font-weight:700;letter-spacing:.22em;opacity:.6}
.ring{position:absolute;border-radius:50%;border:6px solid #fff;display:grid;place-items:center}
.dash{position:absolute;border-radius:50%;border:3px dashed}
.menu{position:absolute;background:#fff;color:#1E1B4B;border-radius:34px;padding:34px 36px 26px;box-shadow:0 40px 90px -30px rgba(30,27,75,.55);opacity:0}
.menu .mh{display:flex;align-items:center;gap:16px;font-size:34px;margin-bottom:12px}
.menu .mi{display:flex;align-items:center;gap:18px;padding:18px 0;border-top:1px solid #EEE;font-size:32px;font-weight:600;opacity:0}
.menu .mi i{width:30px;height:30px;border-radius:9px;border:3px solid #CBD5E1;flex:none}
.qb{position:absolute;right:-26px;top:-26px;width:84px;height:84px;border-radius:50%;background:#EF4444;color:#fff;font-size:56px;font-weight:900;display:grid;place-items:center;box-shadow:0 12px 30px -8px rgba(239,68,68,.7);opacity:0}
.qb.big{right:auto;width:130px;height:130px;font-size:90px}
.chat{position:absolute;border-radius:34px;overflow:hidden;background:#EFEAE2;box-shadow:0 40px 90px -30px rgba(0,0,0,.6);opacity:0}
.chh{display:flex;align-items:center;gap:16px;padding:22px 26px;background:#075E54;color:#fff}
.chh b{display:block;font-size:30px}.chh span{font-size:20px;opacity:.8}
.av{width:62px;height:62px;border-radius:50%;background:#25D366;color:#fff;display:grid;place-items:center;font-weight:800;font-size:24px;flex:none}
.chb{display:flex;flex-direction:column;gap:18px;padding:28px}
.bub2{max-width:78%;padding:16px 22px 12px;border-radius:22px;font-size:30px;line-height:1.3;color:#111B21;background:#fff;box-shadow:0 2px 2px rgba(0,0,0,.08);opacity:0}
.bub2 small{display:block;text-align:right;font-size:18px;color:#667781;margin-top:4px}
.bub2.in{align-self:flex-start;border-top-left-radius:6px;transform-origin:0 0}
.bub2.out{align-self:flex-end;background:#D9FDD3;border-top-right-radius:6px;transform-origin:100% 0}
.paper{position:absolute;width:380px;height:480px;background:#FFFDF5;border-radius:6px;padding:46px 34px 30px 64px;font-family:Caveat,cursive;font-size:42px;line-height:56px;color:#1E3A8A;box-shadow:0 30px 60px -20px rgba(0,0,0,.45);background-image:linear-gradient(90deg,transparent 46px,#FCA5A5 46px,#FCA5A5 48px,transparent 48px),repeating-linear-gradient(transparent 0 55px,#BFDBFE 55px 56px);background-position:0 0,0 40px}
.phone{width:400px;height:840px;border-radius:58px;background:#0B1220;padding:12px;box-shadow:0 40px 90px -20px rgba(0,0,0,.6),0 0 0 2px rgba(255,255,255,.08)}
.scr{position:relative;width:376px;height:816px;border-radius:46px;background:#EEF2F7;overflow:hidden;color:${C.navy};font-family:Inter}
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
.fs{position:absolute;inset:0;background:#F1F5F9;transform:translateX(376px)}
.fs-head{background:linear-gradient(160deg,#0F2A4D,${C.navy});padding:16px 24px 26px;color:#fff}
.fs-title{display:flex;align-items:center;gap:12px;margin-top:26px;font-size:26px;font-weight:800}
.fs-body{padding:22px 22px}
.fs-body label{display:block;font-size:15px;font-weight:700;color:${C.slate};margin:14px 0 6px}
.fld{position:relative;height:54px;border-radius:14px;background:#fff;border:2px solid #E2E8F0;padding:0 16px;display:flex;align-items:center;font-size:19px;font-weight:600;overflow:hidden;white-space:nowrap}
.fld span{display:inline-block}
.caret{display:inline-block;width:2px;height:24px;background:${C.blue};margin-left:2px;opacity:0}
.btn{margin-top:26px;height:58px;border-radius:16px;background:${C.blue};color:#fff;display:grid;place-items:center;font-size:19px;font-weight:800}
.fs-p{font-size:18px;color:${C.slate};line-height:1.4;margin:10px 0 20px}
.digits{display:flex;gap:10px}
.digits div{flex:1;height:66px;border-radius:14px;background:#fff;border:2px solid #CBD5E1;display:grid;place-items:center;font-size:32px;font-weight:800}
.digits span{opacity:0}
.who{display:flex;align-items:center;gap:14px;margin-bottom:16px}
.who b{display:block;font-size:20px}.who span{font-size:15px;color:${C.slate}}
.who .av{width:54px;height:54px;font-size:20px;background:${C.blue}}
.bal{background:#fff;border-radius:20px;padding:18px 20px;box-shadow:0 8px 24px -14px rgba(10,25,47,.35)}
.bal>span{font-size:14px;font-weight:700;color:${C.slate};text-transform:uppercase;letter-spacing:.08em}
.bal-r{display:flex;justify-content:space-between;align-items:baseline;margin-top:10px}
.bal-r small{font-size:16px;color:${C.slate}}.bal-r b{font-size:24px;font-weight:800;font-variant-numeric:tabular-nums}
.doc{display:flex;align-items:center;gap:12px;margin-top:14px;background:#fff;border-radius:16px;padding:16px 18px;font-size:17px;font-weight:700;opacity:0}
.doc span{flex:1}
.scr.dk{background:#000}
.lock{position:absolute;inset:0;color:#fff}
.lk-t{text-align:center;margin-top:30px}
.lk-t svg{display:block;margin:0 auto 10px}
.lk-t b{display:block;font-size:84px;font-weight:300;letter-spacing:-2px;line-height:1}
.lk-t span{font-size:18px;opacity:.85}
.nt{display:flex;gap:12px;margin:16px 14px 0;padding:16px;border-radius:22px;background:rgba(255,255,255,.88);color:#0F172A;backdrop-filter:blur(10px);opacity:0}
.nt>i{width:40px;height:40px;border-radius:12px;background:${C.whatsapp};display:grid;place-items:center;flex:none}
.nt-h{display:flex;justify-content:space-between;font-size:13px;color:#475569;margin-bottom:2px}
.nt b{font-size:16px}.nt p{font-size:15px;line-height:1.3;margin-top:2px;color:#1E293B}
.card{position:absolute;background:#fff;color:#0F172A;border-radius:30px;padding:28px 32px;box-shadow:0 30px 80px -24px rgba(15,23,42,.45);opacity:0}
.card .ch{display:flex;align-items:center;gap:18px;margin-bottom:14px}
.card .ch i{width:60px;height:60px;border-radius:18px;display:grid;place-items:center;flex:none}
.card .ch b{display:block;font-size:30px;font-weight:800;letter-spacing:-.02em}
.card .ch span{display:block;font-size:20px;color:${C.slate};margin-top:2px}
.card .row{display:flex;justify-content:space-between;align-items:center;gap:18px;padding:13px 0;border-top:1px solid #E2E8F0;font-size:24px;color:${C.slate}}
.card .rl{flex:1;min-width:0}
.card .rl small{display:block;font-size:18px;color:#94A3B8;margin-top:2px}
.rbar{height:8px;border-radius:4px;background:#E2E8F0;margin-top:10px;overflow:hidden}
.rbar i{display:block;height:100%;width:0;border-radius:4px}
.card .rv{display:flex;align-items:center;gap:12px}
.card .rv b{font-size:28px;font-weight:800;color:#0F172A;font-variant-numeric:tabular-nums;white-space:nowrap}
.bdg{font-style:normal;font-size:18px;font-weight:800;padding:6px 12px;border-radius:999px;white-space:nowrap}
.thumbs{display:flex;gap:12px;margin-top:12px}
.thumbs img{width:110px;height:80px;object-fit:cover;border-radius:14px}
.card.xl{padding:40px 44px;border-radius:40px}
.card.xl .ch{gap:24px;margin-bottom:20px}
.card.xl .ch i{width:84px;height:84px;border-radius:24px}
.card.xl .ch b{font-size:42px}
.card.xl .ch span{font-size:28px}
.card.xl .row{font-size:34px;padding:20px 0;gap:24px}
.card.xl .rl small{font-size:25px}
.card.xl .rv b{font-size:40px}
.card.xl .rbar{height:12px;border-radius:6px}
.card.xl .bdg{font-size:25px;padding:8px 16px}
.card.xl .stamp{right:36px;top:40px;font-size:30px;padding:12px 22px}
.stamp{position:absolute;right:28px;top:30px;display:flex;align-items:center;gap:10px;padding:10px 18px;border:3px solid;border-radius:14px;font-size:24px;font-weight:900;letter-spacing:.06em;text-transform:uppercase}
.idx{position:absolute;font-size:24px;font-weight:800;letter-spacing:.2em}
.dashes{position:absolute;display:flex;gap:14px;opacity:0}
.dashes div{width:70px;height:5px;border-radius:3px;overflow:hidden}
.dashes div i{display:block;height:100%;width:0}
.sd{position:absolute;width:28px;height:28px;border-radius:50%;background:#fff;border:6px solid;opacity:.4}
.sl{position:absolute;width:220px;text-align:center;font-size:22px;font-weight:700}
.stepn{position:absolute;width:150px;height:150px;border-radius:44px;color:#fff;display:grid;place-items:center;font-size:84px;font-weight:800;box-shadow:0 24px 50px -16px rgba(0,0,0,.4);opacity:0}
.kpi{position:absolute;background:#fff;border-radius:24px;padding:20px 24px;box-shadow:0 20px 50px -24px rgba(15,23,42,.45);opacity:0}
.kpi span{display:block;font-size:20px;color:${C.slate};font-weight:600}
.kpi b{display:block;font-size:44px;font-weight:800;letter-spacing:-.03em;margin-top:4px;font-variant-numeric:tabular-nums;white-space:nowrap}
.chartc{position:absolute;background:#fff;border-radius:30px;box-shadow:0 30px 80px -24px rgba(15,23,42,.45);opacity:0}
.cht{position:absolute;left:40px;right:40px;top:30px;display:flex;justify-content:space-between;align-items:center;color:#0F172A}
.cht b{font-size:28px;font-weight:800}
.lg{display:flex;gap:18px;font-size:19px;color:${C.slate}}
.lg i,.legend i{display:inline-block;width:14px;height:14px;border-radius:4px;margin-right:8px;vertical-align:-1px}
.gl{position:absolute;height:1px;background:#E2E8F0}
.bar{position:absolute;border-radius:10px 10px 4px 4px;transform-origin:50% 100%}
.blab{position:absolute;text-align:center;font-size:20px;font-weight:600;color:${C.slate}}
.mapbg{border-radius:40px;border:2px solid;background-image:radial-gradient(rgba(148,163,184,.35) 2px,transparent 2.5px);background-size:30px 30px}
.dot{width:14px;height:14px;border-radius:50%;box-shadow:0 0 0 4px rgba(255,255,255,.35);opacity:0}
.plab{display:flex;align-items:center;gap:6px;font-size:28px;font-weight:800;white-space:nowrap;opacity:0}
.legend{display:flex;gap:24px;font-size:22px;font-weight:600}
.page{position:absolute;border-radius:10px;box-shadow:0 40px 80px -24px rgba(10,25,47,.45);overflow:hidden;background:#fff}
.page img{display:block;width:100%}
.chip{position:absolute;display:flex;align-items:center;gap:10px;padding:14px 24px;border-radius:999px;font-size:26px;font-weight:800;background:${C.navy};color:#fff;white-space:nowrap}
.chip.light{background:#fff;color:#0F172A;box-shadow:0 10px 30px -12px rgba(10,25,47,.35)}
.chip.big{font-size:36px;padding:20px 34px;gap:14px}
.big{position:absolute;font-weight:900;letter-spacing:-.06em;line-height:.9;font-variant-numeric:tabular-nums}
.bub{position:absolute;width:130px;height:130px;border-radius:38px;display:grid;place-items:center;background:#fff;box-shadow:0 20px 50px -18px rgba(10,25,47,.45)}
.mark{position:absolute}
.mark img{width:100%;height:100%;display:block}
.wm{position:absolute;font-family:Inter;font-weight:900;letter-spacing:-.045em;white-space:nowrap}
.pill{position:absolute;display:flex;align-items:center;gap:16px;padding:22px 40px;border-radius:999px;background:${C.whatsapp};color:#fff;font-weight:800;white-space:nowrap;font-family:Inter}
.edge{position:absolute;top:0;bottom:0;width:34px}
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
const fmt = (n, dec) => n.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec }).replace(/\\s/g, '\\u202F');
function apply(el, s) {
  if (!el) return;
  if ('x' in s || 'y' in s || 's' in s || 'r' in s || 'ye' in s || 'sx' in s || 'sy' in s) {
    const sc = s.s ?? 1;
    el.style.transform = 'translate(' + (s.x || 0) + 'px,' + (s.y || 0) + 'px) translateY(' + (s.ye || 0) + 'em) rotate(' + (s.r || 0) + 'deg) scale(' + sc * (s.sx ?? 1) + ',' + sc * (s.sy ?? 1) + ')';
  }
  if ('o' in s) el.style.opacity = s.o;
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
        if (t >= tw.t0 || !('txt' in st)) st.txt = fmt(tw.c[0] + (tw.c[1] - tw.c[0]) * k, tw.dec || 0) + tw.suffix;
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

// ------------------------------------------------------------------ assemblage d'une pub
const TRANSITIONS = ['circle', 'up', 'wipe', 'rise', 'slide', 'zoom'];

function buildAd(ad, F, beats) {
  const { W, H, V } = F;
  const theme = makeTheme(ad.style, ad.palette);
  const tl = new Timeline();
  const B = Object.fromEntries(beats.map((b) => [b.k, b]));
  const total = beats.at(-1).e;
  const ctx = {
    F, W, H, V, M: V ? 90 : 120, tl, theme,
    beat: (k) => {
      if (!B[k]) throw new Error(`${ad.id} : temps de voix « ${k} » inconnu`);
      return B[k];
    },
    times: (b, words) => syncTimes(b, words),
  };
  const scenesMeta = [];
  const html = [];
  let origin = null;
  let numbered = 0;
  ad.scenes.forEach((sc, i) => {
    const id = `s${i}`;
    const s = ctx.beat(sc.beats[0]).s;
    const nextSc = ad.scenes[i + 1];
    const end = nextSc ? ctx.beat(nextSc.beats[0]).s : total;
    const tone = sc.tone || (i % 2 ? 'light' : 'dark');
    const t = { ...theme[tone], dark: tone === 'dark' };
    const R = { id, s, end, t };
    const out = SCENES[sc.type](ctx, sc, R);
    const showChrome = sc.chrome ?? !['logo', 'end'].includes(sc.type);
    if (showChrome) numbered++;
    const label = showChrome ? chrome(`${id}ch`, t, `${String(numbered).padStart(2, '0')} — ${sc.label || ''}`) : '';
    const tr = i === 0 ? 'none' : sc.tr || TRANSITIONS[(i + (ad.trOffset || 0)) % TRANSITIONS.length];
    const o = sc.origin || (tr === 'circle' ? origin : null) || { x: W / 2, y: H / 2 };
    const edge = tr === 'wipe' ? `<div class="edge" id="${id}e" style="left:0;background:${isGrad(t.em) ? t.em : t.accent}"></div>` : '';
    html.push(`<div class="sc" id="${id}" data-cx="${o.x}" data-cy="${o.y}" style="background:${t.bg};color:${t.fg}">${out.html}${label}${edge}</div>`);
    scenesMeta.push({ id, a: s, b: nextSc ? end + 0.9 : total + 1 });
    if (showChrome) tl.to(`${id}ch`, s + 0.3, 0.5, { o: [0, 1], y: [-20, 0] });
    const prev = i ? `s${i - 1}` : null;
    if (tr === 'circle') tl.to(id, s, 0.7, { rad: [0, Math.hypot(W, H)] }, 'inout');
    else if (tr === 'up') {
      tl.to(id, s, 0.6, { ct: [100, 0] }, 'inout');
      tl.to(prev, s, 0.6, { y: [0, -H * 0.25] }, 'inout');
    } else if (tr === 'wipe') {
      tl.to(id, s, 0.6, { cl: [100, 0] }, 'inout');
      tl.to(`${id}e`, s, 0.6, { x: [W, -40] }, 'inout');
    } else if (tr === 'rise') {
      tl.to(id, s, 0.6, { y: [H, 0] }, 'inout');
      tl.to(prev, s, 0.6, { y: [0, -H * 0.3] }, 'inout');
    } else if (tr === 'slide') {
      tl.to(id, s, 0.6, { x: [W, 0] }, 'inout');
      tl.to(prev, s, 0.6, { x: [0, -W * 0.3] }, 'inout');
    } else if (tr === 'zoom') {
      tl.to(id, s, 0.55, { s: [1.25, 1], o: [0, 1] }, 'out');
    }
    if (tr !== 'none') tl.play('whoosh', s - 0.05, 0.85);
    origin = out.origin || null;
  });
  const page = `<!doctype html><html><head><meta charset="utf-8"><style>${PAGE_CSS}:root{--W:${W}px;--H:${H}px;--cp:${V ? '56px 64px' : '48px 80px'};--font:${theme.font}}</style></head>
<body>${html.join('\n')}
<script>const TL=${JSON.stringify(tl.tw)};const SCENES=${JSON.stringify(scenesMeta)};${PAGE_JS}</script></body></html>`;
  return { page, total, sfx: tl.sfx, music: ad.music || theme.music };
}

// ------------------------------------------------------------------ musique + bruitages
const MUSIC = {
  /** Nuit : la mineur, pulsé. */
  drive: {
    bpm: 112,
    roots: [55, 43.65, 65.41, 49],
    chords: [[220, 261.63, 329.63], [174.61, 220, 261.63], [196, 261.63, 329.63], [196, 246.94, 293.66]],
    weights: '1 0.16 0.22 0.9 0.8 0',
  },
  /** Aurore : do majeur, arpège lumineux. */
  bright: {
    bpm: 100,
    roots: [65.41, 49, 55, 43.65],
    chords: [[261.63, 329.63, 392], [246.94, 293.66, 392], [220, 261.63, 329.63], [220, 261.63, 349.23]],
    weights: '0.8 0.12 0.16 0.8 0.6 0.55',
  },
  /** Épuré : ré mineur, plus rapide. */
  groove: {
    bpm: 118,
    roots: [73.42, 58.27, 43.65, 65.41],
    chords: [[293.66, 349.23, 440], [233.08, 293.66, 349.23], [261.63, 349.23, 440], [261.63, 329.63, 392]],
    weights: '1 0.2 0.2 0.9 0.65 0.3',
  },
};

function buildMusic(total, out, preset) {
  const P = MUSIC[preset];
  const B = 60 / P.bpm;
  const BAR = 4 * B;
  const idx = `mod(floor(t/${BAR}),4)`;
  const pick = (vals) => vals.map((v, i) => `${v}*eq(${idx},${i})`).join('+');
  const gate = `min(1,mod(t,${BAR})*30)*min(1,(${BAR}-mod(t,${BAR}))*30)`;
  const kick = `0.95*sin(2*PI*(45*mod(t,${B})+4.4*(1-exp(-25*mod(t,${B})))))*exp(-7*mod(t,${B}))`;
  const hat = `0.5*(random(0)*2-1)*exp(-55*mod(t+${B / 2},${B}))`;
  const snare = `0.55*(random(0)*2-1)*exp(-16*mod(t+${B},${2 * B}))`;
  const e = `mod(t,${B / 2})`;
  const root = pick(P.roots);
  const bass = `(0.55*sin(2*PI*(${root})*t)+0.2*sin(4*PI*(${root})*t))*(0.35+0.65*exp(-${e}*7))*min(1,${e}*300)*min(1,(${B / 2}-${e})*60)`;
  const chord = [0, 1, 2].map((n) => pick(P.chords.map((c) => c[n])));
  const pad = `0.12*(${chord.map((f) => `sin(2*PI*(${f})*t)`).join('+')})*(0.55+0.45*min(1,mod(t,${B})*5))*${gate}`;
  const s16 = B / 4;
  const step = `mod(floor(t/${s16}),3)`;
  const arpF = chord.map((f, n) => `(${f})*2*eq(${step},${n})`).join('+');
  const arp = `0.3*sin(2*PI*(${arpF})*t)*exp(-mod(t,${s16})*14)*min(1,mod(t,${s16})*400)*min(1,(${s16}-mod(t,${s16}))*200)`;
  const layers = [
    [kick, 'lowpass=f=900'],
    [hat, 'highpass=f=7000'],
    [snare, 'highpass=f=1500,lowpass=f=7000'],
    [bass, 'lowpass=f=450'],
    [pad, 'lowpass=f=2200,aecho=0.8:0.6:250:0.25'],
    [arp, 'lowpass=f=3500,aecho=0.8:0.5:300:0.3'],
  ];
  const args = [];
  layers.forEach(([expr]) => args.push('-f', 'lavfi', '-i', `aevalsrc='${expr}':s=44100:d=${total.toFixed(2)}`));
  const fade = Math.max(0, total - 2.5);
  const chains = layers.map(([, af], i) => `[${i}:a]${af},aformat=channel_layouts=stereo[l${i}]`);
  const mix = `${layers.map((_, i) => `[l${i}]`).join('')}amix=inputs=${layers.length}:weights='${P.weights}',volume=${layers.length},afade=t=in:st=0:d=0.4,afade=t=out:st=${fade}:d=2.5,alimiter=limit=0.9[m]`;
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
  if (!existsSync(markOut)) await sharp(path.join(ROOT, 'public', 'brand', 'konadata-mark.png')).resize(512).png().toFile(markOut);
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
  }
  enc.stdin.end();
  const [code] = await once(enc, 'close');
  await ctx.close();
  if (code !== 0) throw new Error(`ffmpeg a échoué (${code}) pour ${out}`);
}

async function renderStills(browser, F, page, htmlFile, times, out) {
  const { ctx, p } = await openPage(browser, F, page, htmlFile);
  const tiles = [];
  const tw = Number(process.argv.find((a) => a.startsWith('--still-width='))?.split('=')[1]) || (F.V ? 300 : 480);
  const th = Math.round((tw * F.H) / F.W);
  for (const t of times) {
    await p.evaluate((x) => window.__frame(x), t);
    const buf = await p.screenshot({ type: 'png' });
    const img = await sharp(buf).resize(tw, th).png().toBuffer();
    const lbl = Buffer.from(`<svg width="${tw}" height="34"><rect width="90" height="34" fill="#000" opacity=".6"/><text x="8" y="24" font-size="20" font-family="Arial" fill="#ff0">${t.toFixed(1)}s</text></svg>`);
    tiles.push(await sharp(img).composite([{ input: lbl, left: 0, top: 0 }]).png().toBuffer());
  }
  await ctx.close();
  const cols = Math.min(tiles.length, F.V ? 8 : 5);
  const rows = Math.ceil(tiles.length / cols);
  await sharp({ create: { width: cols * (tw + 10), height: rows * (th + 10), channels: 3, background: '#111' } })
    .composite(tiles.map((input, i) => ({ input, left: (i % cols) * (tw + 10), top: Math.floor(i / cols) * (th + 10) })))
    .png()
    .toFile(out);
  console.log(`  planche : ${out}`);
}

async function main() {
  const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
  const only = arg('only')?.split(',');
  const formats = arg('format')?.split(',') ?? Object.keys(FORMATS);
  const stills = arg('stills');
  await Promise.all([OUT_DIR, DIR, TTS_DIR, SFX_DIR].map((d) => mkdir(d, { recursive: true })));
  await prepareAssets();
  const browser = await launchBrowser();
  try {
    for (const ad of ADS) {
      if (only && !only.includes(ad.key)) continue;
      console.log(`▶ ${ad.id}`);
      let t = 0;
      const beats = [];
      for (const b of ad.beats) {
        const v = await speak(b.say, ad.voice);
        const beat = { ...b, ...v, s: t, v: t + (b.pre ?? 0.5) };
        beat.e = beat.v + v.dur + (b.post ?? 0.4);
        t = beat.e;
        beats.push(beat);
      }
      console.log(`  ${beats.map((b) => `${b.k} ${b.s.toFixed(1)}`).join(' · ')} · fin ${t.toFixed(1)} s`);
      for (const fk of formats) {
        const F = FORMATS[fk];
        const { page, total, sfx, music: preset } = buildAd(ad, F, beats);
        const htmlFile = path.join(DIR, `${ad.id}-${fk}.html`);
        if (stills) {
          const times =
            stills === 'auto' ? beats.flatMap((b) => [b.s + 0.35, b.v + b.dur * 0.6, b.e - 0.1]) : stills.split(',').map(Number);
          await renderStills(browser, F, page, htmlFile, times, path.join(DIR, `${ad.id}-${fk}-stills.png`));
          continue;
        }
        const music = path.join(DIR, `${ad.id}-music.wav`);
        buildMusic(total, music, preset);
        const audio = path.join(DIR, `${ad.id}-audio.m4a`);
        mixAudio(total, beats.map((b) => ({ wav: b.wav, t: b.v })), sfx, music, audio);
        if (process.argv.includes('--audio-only')) {
          console.log(`  son : ${audio}`);
          continue;
        }
        const out = path.join(OUT_DIR, `${ad.id}-${fk}.mp4`);
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
