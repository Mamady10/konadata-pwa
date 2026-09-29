#!/usr/bin/env node
/**
 * Vidéos « histoires » KonaData : scènes illustrées avec personnages, dialogues à plusieurs voix
 * (Edge TTS), bruitages, bulles de dialogue, incrustations et vraies captures de l'application.
 *
 * Images : docs/marketing/campagne/histoires/<histoire>/*.png (720×1280, style illustration)
 * Sorties : docs/marketing/campagne/videos/<id>-9x16.mp4, <id>-9x16-whatsapp.mp4 (720p allégée) et .srt
 *
 * Prérequis : node scripts/tutorials/build-tutorials.mjs --only=btp-08-devis-metre (captures du devis)
 * Usage : node scripts/marketing/build-story-videos.mjs [--only=histoire-ingenieur-marche-perdu] [--stills=2,15,40]
 *         (--stills : planche d'images fixes aux instants donnés, sans rendu vidéo)
 */
import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import sharp from 'sharp';
import { FPS, buildAudio, ff, renderHtmlVideo, toSrt, voiceClip } from './video-kit.mjs';
import { ACCENTS, CONTACT } from './campaign-content.mjs';
import { CAMPAIGN, CSS, ROOT, WORK, esc, glows, icon, launchBrowser, logo, phone, prepareBrandAssets, qrSvg, rich, url } from './campaign-html.mjs';

const OUT = path.join(CAMPAIGN, 'videos');
const STORIES = path.join(CAMPAIGN, 'histoires');
const SWORK = path.join(WORK, 'story');
const TUTO_WORK = path.join(ROOT, 'docs', 'formation', 'tutoriels', '.work');
const W = 1080;
const H = 1920;
const LEAD = 0.2; // silence avant chaque réplique (s)
const XF = 0.35; // fondu entre plans (s)

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const ONLY = arg('only')?.split(',');
const STILLS = arg('stills')?.split(',').map(Number);

// ---------------------------------------------------------------- personnages
const CAST = {
  narr: { voice: 'fr-FR-VivienneMultilingualNeural', rate: '+3%' },
  ibrahima: { name: 'Ibrahima', color: '#EA580C', voice: 'fr-FR-RemyMultilingualNeural', rate: '+2%' },
  camara: { name: 'M. Camara', color: '#2563EB', voice: 'fr-FR-HenriNeural', rate: '-4%', pitch: '-6Hz' },
  accueil: { name: 'Réceptionniste', color: '#DB2777', voice: 'fr-FR-DeniseNeural', rate: '+0%' },
  mamadou: { name: 'Mamadou', color: '#D97706', voice: 'fr-BE-GerardNeural', rate: '+0%' },
  diallo: { name: 'Mme Diallo', color: '#7C3AED', voice: 'fr-FR-DeniseNeural', rate: '-2%' },
  sylla: { name: 'M. Sylla', color: '#0891B2', voice: 'fr-CH-FabriceNeural', rate: '+4%' },
  kourouma: { name: 'Mme Kourouma', color: '#15803D', voice: 'fr-FR-DeniseNeural', rate: '-2%' },
  barry: { name: 'M. Barry', color: '#2563EB', voice: 'fr-FR-RemyMultilingualNeural', rate: '+2%' },
  kaba: { name: 'M. Kaba', color: '#0369A1', voice: 'fr-FR-HenriNeural', rate: '+3%' },
  conde: { name: 'M. Condé', color: '#1D4ED8', voice: 'fr-FR-RemyMultilingualNeural', rate: '+0%' },
  fofana: { name: 'Mme Fofana', color: '#EA580C', voice: 'fr-BE-CharlineNeural', rate: '+2%' },
  soumah: { name: 'M. Soumah', color: '#475569', voice: 'fr-BE-GerardNeural', rate: '-4%' },
  bah: { name: 'M. Bah', color: '#0284C7', voice: 'fr-CH-FabriceNeural', rate: '-2%' },
  keita: { name: 'Mariama', color: '#16A34A', voice: 'fr-CH-ArianeNeural', rate: '+2%' },
  diakite: { name: 'M. Diakité', color: '#92400E', voice: 'fr-BE-GerardNeural', rate: '-6%', pitch: '-4Hz' },
  toure: { name: 'Mme Touré', color: '#7E22CE', voice: 'fr-FR-DeniseNeural', rate: '+4%' },
  sekou: { name: 'Sékou', color: '#DC2626', voice: 'fr-FR-RemyMultilingualNeural', rate: '+8%', pitch: '+4Hz' },
  cliente: { name: 'Cliente', color: '#0F766E', voice: 'fr-CH-ArianeNeural', rate: '+0%' },
  client: { name: 'Client', color: '#15803D', voice: 'fr-CH-FabriceNeural', rate: '+2%' },
};

/** Réplique : `say` est lu par la voix, `text` (optionnel) est affiché en sous-titre. */
const line = (who, say, o = {}) => ({ who, say, text: o.text ?? say.replace(/Kona Data/g, 'KonaData'), ...o });

// ---------------------------------------------------------------- bruitages
const SFX = {
  ring: { d: 2.6, e: '0.22*sin(2*PI*(1250+450*mod(floor(t*22),2))*t)*lt(mod(t,1.3),0.75)' },
  thump: { d: 0.7, e: '(0.9*sin(2*PI*62*t)+0.35*(random(0)*2-1))*exp(-t*9)' },
  tick: { d: 20, e: '0.35*(random(0)*2-1)*exp(-mod(t,1)*260)+0.2*(random(0)*2-1)*exp(-mod(t+0.5,1)*320)' },
  whoosh: { d: 1.4, e: '0.35*(random(0)*2-1)*sin(PI*t/1.4)*sin(PI*t/1.4)', af: 'lowpass=f=2400,highpass=f=300' },
  ding: { d: 1.6, e: '0.3*sin(2*PI*1318*t)*exp(-4*t)+0.25*gte(t,0.14)*sin(2*PI*1760*(t-0.14))*exp(-4*(t-0.14))' },
  chime: {
    d: 2.2,
    e: [523, 659, 784, 1047].map((f, i) => `0.2*gte(t,${i * 0.12})*sin(2*PI*${f}*(t-${i * 0.12}))*exp(-3.2*(t-${i * 0.12}))`).join('+'),
  },
};

function buildSfx(name) {
  const out = path.join(SWORK, 'sfx', `${name}.wav`);
  if (!existsSync(out)) {
    const { d, e, af } = SFX[name];
    ff(['-f', 'lavfi', '-i', `aevalsrc='${e}':s=44100:d=${d}`, ...(af ? ['-af', af] : []), '-ac', '1', '-y', out], `bruitage ${name}`);
  }
  return out;
}

/** Ajoute les bruitages `events` ([{ sfx, t, vol }]) à la piste `audio`. */
function mixSfx(audio, events, total, out) {
  if (!events.length) return audio;
  const inputs = ['-i', audio, ...events.flatMap((e) => ['-i', buildSfx(e.sfx)])];
  const pad = (i, extra) => `[${i}:a]${extra}apad,atrim=0:${total.toFixed(3)}[p${i}]`;
  const trim = (len) => (len ? `atrim=0:${len.toFixed(3)},afade=t=out:st=${Math.max(0, len - 0.6).toFixed(3)}:d=0.6,` : '');
  const chains = [
    pad(0, ''),
    ...events.map((e, k) => pad(k + 1, `${trim(e.len)}adelay=${Math.round(e.t * 1000)},volume=${e.vol ?? 1},`)),
  ];
  const n = events.length + 1;
  ff(
    [
      ...inputs,
      '-filter_complex',
      `${chains.join(';')};${Array.from({ length: n }, (_, i) => `[p${i}]`).join('')}amix=inputs=${n}:duration=first,volume=${n},alimiter=limit=0.97[a]`,
      '-map', '[a]', '-c:a', 'aac', '-b:a', '160k', '-y', out,
    ],
    'bruitages'
  );
  return out;
}

// ---------------------------------------------------------------- ressources
const ICONS = {
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  rewind: '<path d="M11 19 2 12l9-7v14z"/><path d="M22 19l-9-7 9-7v14z"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
};
const svg = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;

/** Agrandit une scène (720×1280) pour le zoom lent, en conservant la netteté du trait. */
async function sceneImage(story, file) {
  const out = path.join(SWORK, story, file.replace(/\.png$/, '.jpg'));
  if (!existsSync(out)) {
    await mkdir(path.dirname(out), { recursive: true });
    await sharp(path.join(STORIES, story, file))
      .resize(Math.round(W * 1.2), Math.round(H * 1.2), { kernel: 'lanczos3' })
      .sharpen({ sigma: 0.6 })
      .jpeg({ quality: 93 })
      .toFile(out);
  }
  return url(out);
}

/** Recadre une capture de tutoriel (coordonnées en pixels de la capture d'origine). */
async function tutoCrop(tutorial, file, box, name) {
  const src = path.join(TUTO_WORK, tutorial, file);
  if (!existsSync(src)) throw new Error(`Capture manquante : ${src} (relancer le tutoriel ${tutorial})`);
  const out = path.join(SWORK, 'crops', `${name}.png`);
  await mkdir(path.dirname(out), { recursive: true });
  await (box ? sharp(src).extract(box) : sharp(src)).png().toFile(out);
  return url(out);
}

// ---------------------------------------------------------------- animation
const EASE = 'cubic-bezier(.2,.8,.2,1)';
const A = (name, delay, dur, ease = EASE, fill = 'both') => `${name} ${dur}s ${ease} ${Math.max(0, delay).toFixed(3)}s ${fill}`;
const OUT_ANIM = (t) => A('out', t, 0.3, 'linear', 'forwards');

const STORY_CSS = `
@keyframes fade{from{opacity:0}to{opacity:1}}
@keyframes hide{from{opacity:1}to{opacity:0}}
@keyframes out{from{opacity:1}to{opacity:0}}
@keyframes down{from{opacity:0;transform:translateY(-60px)}to{opacity:1;transform:none}}
@keyframes up{from{opacity:0;transform:translateY(80px)}to{opacity:1;transform:none}}
@keyframes rise{from{opacity:0;transform:translateY(420px)}to{opacity:1;transform:none}}
@keyframes pop{0%{opacity:0;transform:scale(.5)}65%{opacity:1;transform:scale(1.07)}100%{opacity:1;transform:scale(1)}}
@keyframes stamp{0%{opacity:0;transform:scale(2.8)}55%{opacity:1;transform:scale(.9)}75%{transform:scale(1.04)}100%{opacity:1;transform:scale(1)}}
@keyframes shake{0%,100%{transform:none}20%{transform:translate(-14px,8px)}40%{transform:translate(12px,-10px)}60%{transform:translate(-8px,6px)}80%{transform:translate(6px,-4px)}}
@keyframes buzz{0%,100%{transform:rotate(0)}25%{transform:rotate(-14deg)}75%{transform:rotate(14deg)}}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.7)}100%{box-shadow:0 0 0 34px rgba(34,197,94,0)}}
@keyframes floatq{0%{opacity:0;transform:translateY(60px) scale(.8)}18%{opacity:1;transform:translateY(0) scale(1)}75%{opacity:1}100%{opacity:0;transform:translateY(-160px) scale(1.05)}}
@keyframes lines{from{background-position:0 0}to{background-position:0 -600px}}
@keyframes spinback{from{transform:rotate(0)}to{transform:rotate(-720deg)}}
@keyframes fall{from{transform:translateY(-120px) rotate(0)}to{transform:translateY(2100px) rotate(900deg)}}
@keyframes bars{0%,100%{transform:scaleY(.35)}50%{transform:scaleY(1)}}
.shot{position:absolute;inset:0;overflow:hidden;background:#06111F}
.shot .bg{position:absolute;left:0;top:0;width:${W}px;height:${H}px;object-fit:cover;transform-origin:50% 50%}
.vig{position:absolute;inset:0;background:linear-gradient(180deg,rgba(6,17,31,.42) 0%,rgba(6,17,31,0) 17%,rgba(6,17,31,0) 68%,rgba(6,17,31,.5) 100%)}
.dim{position:absolute;inset:0;background:rgba(6,17,31,.62)}
.chip{position:absolute;left:60px;top:90px;display:inline-flex;align-items:center;gap:18px;padding:18px 32px 18px 24px;border-radius:999px;background:rgba(255,255,255,.96);color:#0A192F;font-weight:800;font-size:44px;letter-spacing:-.01em;box-shadow:0 18px 40px -12px rgba(0,0,0,.55)}
.chip svg{width:48px;height:48px;color:#EA580C}
.chip.red{background:#DC2626;color:#fff}.chip.red svg{color:#fff}
.chip.green{background:#16A34A;color:#fff}.chip.green svg{color:#fff}
.notice{position:absolute;left:60px;right:60px;top:230px;padding:30px 36px;border-radius:28px;background:#fff;color:#0A192F;border-left:16px solid #DC2626;box-shadow:0 24px 50px -16px rgba(0,0,0,.6)}
.notice small{display:flex;align-items:center;gap:12px;color:#DC2626;font-weight:900;font-size:30px;letter-spacing:.12em}
.notice small svg{width:36px;height:36px}
.notice p{font-weight:800;font-size:46px;line-height:1.18;margin-top:12px}
.notice p.due{font-size:42px;color:#DC2626;margin-top:14px}
.call{position:absolute;left:50px;right:50px;top:80px;display:flex;align-items:center;gap:26px;padding:26px 30px;border-radius:40px;background:rgba(15,23,42,.9);box-shadow:0 24px 60px -16px rgba(0,0,0,.7);backdrop-filter:blur(8px)}
.call .av{width:110px;height:110px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#60A5FA,#2563EB);font-weight:900;font-size:44px}
.call b{display:block;font-size:44px}.call span{color:#94A3B8;font-weight:600;font-size:34px}
.call .ok{margin-left:auto;width:110px;height:110px;border-radius:50%;display:grid;place-items:center;background:#22C55E}
.call .ok svg{width:54px;height:54px;color:#fff}
.q{position:absolute;padding:14px 28px;border-radius:22px;background:rgba(255,255,255,.93);color:#0A192F;font-weight:900;font-size:52px;box-shadow:0 14px 34px -10px rgba(0,0,0,.6)}
.q i{font-style:normal;color:#DC2626}
.stampw{position:absolute;left:50%;top:760px;transform:translate(-50%,-50%) rotate(-11deg)}
.stamp{padding:18px 44px;border:12px solid #DC2626;border-radius:26px;color:#DC2626;background:rgba(255,255,255,.88);font-weight:900;font-size:112px;letter-spacing:.03em;line-height:1;white-space:nowrap;text-align:center;box-shadow:0 20px 50px -10px rgba(0,0,0,.5)}
.stamp small{display:block;font-size:40px;letter-spacing:.18em;margin-top:10px}
.stamp.green{border-color:#16A34A;color:#16A34A}
.rew{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 42%,#12305A 0%,#06111F 70%)}
.rew .ln{position:absolute;inset:0;opacity:.35;background:repeating-linear-gradient(0deg,rgba(255,255,255,.08) 0 3px,transparent 3px 9px)}
.rew .ic{width:220px;height:220px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,var(--a1),var(--a2));box-shadow:0 30px 90px -20px var(--a1)}
.rew .ic svg{width:120px;height:120px;color:#06111F;fill:#06111F}
.shotimg{position:absolute;border-radius:26px;overflow:hidden;background:#fff;box-shadow:0 34px 80px -20px rgba(0,0,0,.85),0 0 0 3px rgba(255,255,255,.75)}
.shotimg img{display:block;width:100%}
.stp{position:absolute;left:60px;display:inline-flex;align-items:center;gap:18px;padding:14px 30px 14px 14px;border-radius:999px;background:rgba(6,17,31,.88);border:2px solid rgba(255,255,255,.18);font-weight:800;font-size:40px;color:#fff}
.stp b{width:62px;height:62px;border-radius:50%;display:grid;place-items:center;color:#06111F;background:linear-gradient(135deg,var(--a1),var(--a2));font-size:36px}
.conf{position:absolute;top:0;width:22px;height:36px;border-radius:4px}
.scap{position:absolute;left:56px;right:56px;bottom:190px;display:flex;justify-content:center;z-index:100}
.bub{position:relative;max-width:100%;padding:22px 36px 26px;border-radius:32px;background:#fff;color:#0A192F;font-weight:700;font-size:48px;line-height:1.26;text-align:center;box-shadow:0 18px 44px -8px rgba(0,0,0,.55)}
.bub b{display:flex;align-items:center;justify-content:center;gap:14px;font-size:30px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;margin-bottom:6px}
.bub b u{display:inline-flex;gap:5px;height:28px;align-items:center}
.bub b u i{display:block;width:6px;height:28px;border-radius:3px;background:currentColor}
.bub.talk:after{content:'';position:absolute;top:-26px;left:var(--tx);margin-left:-24px;border:24px solid transparent;border-top:0;border-bottom:28px solid #fff}
.bub.narr{background:rgba(6,17,31,.86);color:#fff;font-weight:600}
.end{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:44px;padding-bottom:330px;text-align:center}
.end h1{font-size:92px;line-height:1.05}
.qrbox{background:#fff;border-radius:24px;padding:16px;display:flex;flex-direction:column;align-items:center;gap:6px;color:#0A192F;font-weight:800;font-size:28px}
*{animation-play-state:paused!important}
`;

/** Pseudo-aléatoire déterministe (confettis identiques à chaque rendu). */
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

// Incrustations : chaque fonction reçoit (o, t0, ctx) et renvoie du HTML ; t0 = instant d'apparition.
const OVERLAYS = {
  chip: (o, t0) => `<div class="chip ${o.tone ?? ''}" style="animation:${A('down', t0, 0.6)}${o.untilT ? `,${OUT_ANIM(o.untilT)}` : ''}">${svg(o.icon ?? 'calendar')}<span>${esc(o.text)}</span></div>`,
  notice: (o, t0) =>
    `<div class="notice" style="top:${o.y ?? 230}px;animation:${A('pop', t0, 0.7)}${o.untilT ? `,${OUT_ANIM(o.untilT)}` : ''}"><small>${svg('alert')}${esc(o.label)}</small><p>${esc(o.title)}</p><p class="due">${esc(o.due)}</p></div>`,
  call: (o, t0) =>
    `<div class="call" style="animation:${A('down', t0, 0.6)}${o.untilT ? `,${OUT_ANIM(o.untilT)}` : ''}"><div class="av">${esc(o.initials)}</div><div><b>${esc(o.name)}</b><span>${esc(o.status)}</span></div><div class="ok" style="animation:${A('pulse', t0 + 0.3, 0.9, 'ease-out', 'none')},${A('pulse', t0 + 1.2, 0.9, 'ease-out', 'none')},${A('pulse', t0 + 2.1, 0.9, 'ease-out', 'none')}"><div style="display:grid;place-items:center;animation:${A('buzz', t0 + 0.3, 0.25, 'linear', 'none')},${A('buzz', t0 + 0.6, 0.25, 'linear', 'none')},${A('buzz', t0 + 1.6, 0.25, 'linear', 'none')},${A('buzz', t0 + 1.9, 0.25, 'linear', 'none')}">${svg('phone')}</div></div></div>`,
  questions: (o, t0) =>
    o.items
      .map(([txt, x, y], i) => `<div class="q" style="left:${x}px;top:${y}px;animation:${A('floatq', t0 + i * (o.step ?? 0.7), 2.8, 'ease-out')}">${esc(txt)} <i>?</i></div>`)
      .join(''),
  stamp: (o, t0) =>
    `<div class="stampw"${o.y ? ` style="top:${o.y}px"` : ''}><div class="stamp ${o.tone ?? ''}" style="font-size:${Math.min(112, Math.floor(1300 / o.text.length))}px;animation:${A('stamp', t0, 0.55)}">${esc(o.text)}${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</div></div>`,
  dim: (o, t0) => `<div class="dim" style="animation:${A('fade', t0, 0.5, 'linear')}${o.untilT ? `,${OUT_ANIM(o.untilT)}` : ''}"></div>`,
  image: (o, t0) =>
    `<div class="abs" style="left:${o.x}px;top:${o.y}px;width:${o.w}px;animation:${A(o.anim ?? 'rise', t0, 0.8)}${o.untilT ? `,${OUT_ANIM(o.untilT)}` : ''}"><div class="shotimg" style="position:relative;${o.rot ? `transform:rotate(${o.rot}deg)` : ''}"><img src="${o.src}"></div></div>`,
  phone: (o, t0) =>
    `<div class="abs" style="left:${o.x}px;top:${o.y}px;animation:${A(o.anim ?? 'rise', t0, 0.8)}${o.untilT ? `,${OUT_ANIM(o.untilT)}` : ''}"><div style="${o.rot ? `transform:rotate(${o.rot}deg)` : ''}">${phone(o.src, o.w)}</div></div>`,
  pages: (o, t0) => {
    const n = o.pages.length;
    return o.pages
      .map((src, i) => {
        const k = i - (n - 1) / 2;
        return `<div class="abs" style="left:${540 - o.w / 2 + k * (o.spread ?? 170)}px;top:${o.y + Math.abs(k) * 30}px;width:${o.w}px;z-index:${i + 1};animation:${A('rise', t0 + i * 0.3, 0.8)}${o.untilT ? `,${OUT_ANIM(o.untilT)}` : ''}"><div class="shotimg" style="position:relative;transform:rotate(${k * 6}deg)"><img src="${src}"></div></div>`;
      })
      .join('');
  },
  step: (o, t0) =>
    `<div class="stp" style="top:${o.y}px;animation:${A('up', t0, 0.6)}${o.untilT ? `,${OUT_ANIM(o.untilT)}` : ''}"><b>${esc(o.n)}</b><span>${esc(o.text)}</span></div>`,
  confetti: (o, t0) => {
    const r = rng(7);
    const colors = ['#FB923C', '#FBBF24', '#38BDF8', '#22C55E', '#F472B6', '#FFFFFF'];
    return Array.from({ length: 46 }, (_, i) => {
      const x = Math.round(r() * W);
      const d = 2.4 + r() * 1.6;
      return `<div class="conf" style="left:${x}px;background:${colors[i % colors.length]};animation:${A('fall', t0 + r() * 1.4, d, 'linear')}"></div>`;
    }).join('');
  },
};

// ---------------------------------------------------------------- histoire
async function storyEngineerLostTender() {
  const S = 'ingenieur-marche-perdu';
  const img = (f) => sceneImage(S, f);
  const QUOTE = 'btp-08-devis-metre';
  const metre = await tutoCrop(QUOTE, 'shots/013-filled.jpg', { left: 600, top: 150, width: 1656, height: 855 }, 'metre');
  const extrait = await tutoCrop(QUOTE, 'shots/016-after.jpg', { left: 600, top: 816, width: 1656, height: 714 }, 'extrait');
  const pdf = await tutoCrop(QUOTE, 'pages-7/page-01.jpg', null, 'devis-page1');

  return {
    id: 'histoire-ingenieur-marche-perdu',
    accent: 'btp',
    music: 0.05,
    shots: [
      {
        img: await img('01-bureau.png'),
        kb: [[1.04, 0, 0], [1.16, 30, -40]],
        pre: 0.5,
        lines: [
          line(
            'narr',
            "Vendredi, dix-sept heures. Ibrahima, ingénieur dans une entreprise de BTP, doit déposer lundi son offre pour la construction d'une école à Coyah.",
            { text: 'Vendredi, 17 h. Ibrahima, ingénieur BTP, doit déposer lundi son offre pour construire une école à Coyah.' }
          ),
        ],
        overlays: [
          { type: 'chip', at: 0.3, icon: 'calendar', text: 'Vendredi · 17 h 00' },
          { type: 'notice', at: 2.2, y: 1120, label: "APPEL D'OFFRES", title: "Construction d'une école primaire à Coyah", due: 'Dépôt des offres : lundi, 10 h 00' },
        ],
      },
      {
        img: await img('03-patron.png'),
        kb: [[1.1, 0, 20], [1.2, 0, 40]],
        pre: 1.3,
        sfx: [{ sfx: 'ring', at: 0, vol: 0.9 }],
        lines: [line('camara', "Allô, Ibrahima ? Le devis de l'école de Coyah, il est prêt ?", { tail: 50 })],
        overlays: [{ type: 'call', at: 0, initials: 'MC', name: 'M. Camara', status: 'Directeur · appel entrant', untilLine: 0, untilAt: 0.2 }],
      },
      {
        img: await img('02-telephone.png'),
        kb: [[1.12, 40, 30], [1.22, 60, 50]],
        cut: true,
        lines: [line('ibrahima', 'Pas encore, patron… Il me reste tout le métré : le béton, le fer, les agglos…', { tail: 45 })],
      },
      {
        img: await img('03-patron.png'),
        kb: [[1.22, 0, 60], [1.3, 0, 80]],
        cut: true,
        lines: [line('camara', 'Lundi, dix heures. Pas une minute de plus. Ce marché, on ne peut pas le rater !', { text: 'Lundi, 10 h. Pas une minute de plus. Ce marché, on ne peut pas le rater !', tail: 50 })],
        post: 0.3,
      },
      {
        img: await img('04-nuit.png'),
        kb: [[1.03, 0, 0], [1.17, -20, -30]],
        pre: 0.4,
        sfx: [{ sfx: 'tick', at: 0, vol: 0.55, len: 'shot' }],
        lines: [
          line('narr', 'Tout le week-end, il calcule à la main. Poteaux, poutres, dalles, murs… chaque sac de ciment, chaque barre de fer.'),
          line('narr', "Une seule erreur, et tout est à refaire."),
        ],
        post: 0.3,
        overlays: [
          { type: 'chip', at: 0.2, icon: 'clock', text: 'Samedi · 23 h 40', untilT: 3.6 },
          { type: 'chip', at: 3.9, icon: 'clock', tone: 'red', text: 'Dimanche · 3 h 10' },
          {
            type: 'questions',
            at: 1.2,
            step: 0.75,
            items: [
              ['Ciment', 60, 420],
              ['Fer HA12', 680, 560],
              ['Agglos', 70, 760],
              ['Sable', 720, 320],
              ['Gravier', 690, 860],
              ['Pertes', 80, 1060],
              ['Dosage', 700, 1120],
            ],
          },
        ],
      },
      {
        img: await img('05-guichet.png'),
        kb: [[1.06, 0, 0], [1.14, -20, 10]],
        pre: 0.5,
        lines: [
          line('accueil', 'Désolée, monsieur. Les dépôts sont clos depuis dix heures.', { text: 'Désolée, monsieur. Les dépôts sont clos depuis 10 h.', tail: 70, gap: 0.9 }),
          line('narr', 'Un marché perdu. Pas faute de compétence… faute de temps.'),
        ],
        post: 0.6,
        overlays: [
          { type: 'chip', at: 0.2, icon: 'clock', tone: 'red', text: 'Lundi · 10 h 15' },
          { type: 'stamp', line: 0, at: 'end', text: 'DÉPÔT CLÔTURÉ', sub: 'OFFRE NON REÇUE', shake: true },
        ],
        sfx: [{ sfx: 'thump', line: 0, at: 'end', vol: 1 }],
      },
      {
        rewind: 'Et si Ibrahima avait utilisé *KonaData* ?',
        pre: 0.6,
        sfx: [{ sfx: 'whoosh', at: 0, vol: 0.9 }],
        lines: [line('narr', 'Et si Ibrahima avait utilisé Kona Data ?')],
        post: 0.5,
      },
      {
        img: await img('06-konadata.png'),
        kb: [[1.04, 0, 0], [1.12, 0, -30]],
        pre: 0.6,
        lines: [
          line('narr', 'Il saisit simplement les dimensions des ouvrages.'),
          line('narr', 'Kona Data calcule aussitôt le ciment, le fer, le sable et les agglos, pertes incluses, puis chiffre tout avec ses prix.', {
            text: 'KonaData calcule aussitôt ciment, fer, sable et agglos, pertes incluses, puis chiffre tout avec ses prix.',
          }),
          line('narr', 'Vingt minutes plus tard, son devis PDF est prêt.', { text: '20 minutes plus tard, son devis PDF est prêt.' }),
          line('ibrahima', 'Patron, le devis de Coyah est dans votre boîte mail !', { tail: 50 }),
        ],
        post: 0.4,
        overlays: [
          { type: 'chip', at: 0.2, icon: 'calendar', text: 'Vendredi · 17 h 00', untilLine: 2, untilAt: 0 },
          { type: 'dim', line: 0, at: 0, untilLine: 3, untilAt: 0 },
          { type: 'step', line: 0, at: 0, y: 300, n: '1', text: 'Dimensions des ouvrages', untilLine: 2, untilAt: 0 },
          { type: 'image', line: 0, at: 0.3, src: metre, x: 50, y: 400, w: 980, untilLine: 2, untilAt: 0 },
          { type: 'step', line: 1, at: 0, y: 950, n: '2', text: 'Extrait des matériaux, chiffré', untilLine: 2, untilAt: 0 },
          { type: 'image', line: 1, at: 0.3, src: extrait, x: 50, y: 1040, w: 980, untilLine: 2, untilAt: 0 },
          { type: 'chip', line: 2, at: 0, icon: 'check', tone: 'green', text: 'Vendredi · 17 h 20', untilLine: 3, untilAt: 0 },
          { type: 'image', line: 2, at: 0.2, src: pdf, x: 250, y: 250, w: 580, rot: -3, anim: 'pop', untilLine: 3, untilAt: 0 },
          { type: 'chip', line: 3, at: 0, icon: 'mail', tone: 'green', text: 'Devis envoyé · 17 h 25' },
        ],
        sfx: [{ sfx: 'ding', line: 2, at: 0.3, vol: 0.9 }],
      },
      {
        img: await img('07-succes.png'),
        kb: [[1.04, 0, 0], [1.14, 0, -20]],
        pre: 0.5,
        lines: [
          line('camara', "Bravo, Ibrahima ! L'école de Coyah, c'est nous qui allons la construire !", { tail: 32, gap: 0.5 }),
          line('ibrahima', 'Merci, patron. Avec Kona Data, un devis avec métré, c’est une affaire de minutes.', { tail: 68 }),
        ],
        post: 0.5,
        overlays: [
          { type: 'chip', at: 0.2, icon: 'check', tone: 'green', text: 'Lundi · 9 h 00 · Offre déposée', untilLine: 0, untilAt: 0.5 },
          { type: 'chip', line: 0, at: 0.8, icon: 'calendar', text: 'Trois semaines plus tard…' },
          { type: 'confetti', line: 0, at: 0.3 },
        ],
        sfx: [{ sfx: 'chime', line: 0, at: 0.2, vol: 0.8 }],
      },
      {
        endCard: { title: ['Le devis avec métré,', '*en quelques minutes.*'], badge: '6 mois gratuits pour le BTP' },
        pre: 0.3,
        lines: [
          line('narr', 'Kona Data. Le devis avec métré, en quelques minutes. Six mois gratuits pour les entreprises du BTP.', {
            text: 'KonaData : le devis avec métré, en quelques minutes. 6 mois gratuits pour les entreprises du BTP.',
          }),
        ],
        post: 2.2,
      },
    ],
  };
}

async function storySiteReport() {
  const S = 'rapport-chantier';
  const img = (f) => sceneImage(S, f);
  const patronPhone = await sceneImage('ingenieur-marche-perdu', '03-patron.png');
  const FICHE = 'btp-03-fiche-journaliere';
  const REPORT = 'btp-06-rapport-periodique';
  const releve = await tutoCrop(FICHE, 'shots/004-after.jpg', null, 'releve-saisie');
  const enregistre = await tutoCrop(FICHE, 'shots/018-after.jpg', null, 'releve-enregistre');
  const dashboard = url(path.join(CAMPAIGN, 'captures', 'btp-dashboard-mobile.png'));
  const pages = [];
  for (const n of [2, 6, 1]) pages.push(await tutoCrop(REPORT, `pages-7/page-0${n}.jpg`, null, `rapport-page${n}`));

  return {
    id: 'histoire-rapport-chantier',
    accent: 'btp',
    music: 0.05,
    shots: [
      {
        img: await img('01-attente.png'),
        kb: [[1.04, 0, 0], [1.16, -20, -40]],
        pre: 0.5,
        lines: [
          line(
            'narr',
            "Lundi, huit heures. À onze heures, monsieur Camara doit présenter l'avancement du chantier au maître d'ouvrage. Mais le rapport du mois… n'est toujours pas arrivé.",
            { text: "Lundi, 8 h. À 11 h, M. Camara doit présenter l'avancement du chantier au maître d'ouvrage. Mais le rapport du mois… n'est toujours pas arrivé." }
          ),
        ],
        overlays: [
          { type: 'chip', at: 0.3, icon: 'calendar', text: 'Lundi · 8 h 00' },
          { type: 'notice', at: 2.2, y: 1120, label: 'RÉUNION DE CHANTIER', title: "Centre de santé de Coyah, avec le maître d'ouvrage", due: "Aujourd'hui, 11 h 00 · rapport mensuel" },
        ],
      },
      {
        img: patronPhone,
        kb: [[1.1, 0, 20], [1.2, 0, 40]],
        pre: 1.2,
        sfx: [{ sfx: 'ring', at: 0, vol: 0.8 }],
        lines: [line('camara', "Mamadou, le rapport du mois, il est où ? J'ai la réunion à onze heures !", { text: "Mamadou, le rapport du mois, il est où ? J'ai la réunion à 11 h !", tail: 50 })],
        overlays: [{ type: 'call', at: 0, initials: 'M', name: 'Mamadou', status: 'Chef de chantier · appel…', untilLine: 0, untilAt: 0.2 }],
      },
      {
        img: await img('02-chantier.png'),
        kb: [[1.1, 0, 60], [1.2, 0, 80]],
        cut: true,
        lines: [
          line('mamadou', "Patron… les fiches sont dans mon cahier, les photos sur mon téléphone, et les bons de carburant, c'est le magasinier qui les a.", { tail: 50 }),
        ],
      },
      {
        img: patronPhone,
        kb: [[1.22, 0, 60], [1.3, 0, 80]],
        cut: true,
        lines: [line('camara', 'Envoie-moi tout. Tout de suite !', { tail: 50 })],
        post: 0.3,
      },
      {
        img: await img('03-chaos.png'),
        kb: [[1.03, 0, 0], [1.16, 0, -30]],
        pre: 0.4,
        sfx: [{ sfx: 'tick', at: 0, vol: 0.55, len: 'shot' }],
        lines: [
          line('narr', 'Photos éparpillées sur WhatsApp, cahiers illisibles, bons de carburant froissés… Il faut tout ressaisir et tout recompter.'),
          line('narr', 'En trois heures.'),
        ],
        post: 0.4,
        overlays: [
          { type: 'chip', at: 0.2, icon: 'clock', text: 'Lundi · 9 h 30', untilT: 4 },
          { type: 'chip', at: 4.3, icon: 'clock', tone: 'red', text: 'Lundi · 10 h 50' },
          {
            type: 'questions',
            at: 1,
            step: 0.75,
            items: [
              ['Photos', 60, 330],
              ['Carburant', 640, 300],
              ['Effectif', 70, 700],
              ['Avancement', 600, 760],
              ['Bons', 90, 1020],
              ['Météo', 720, 1080],
            ],
          },
        ],
      },
      {
        img: await img('04-reunion.png'),
        kb: [[1.06, 0, 0], [1.14, 0, 10]],
        pre: 0.5,
        lines: [
          line('diallo', 'Encore sans rapport, monsieur Camara ? Sans avancement vérifiable, je ne peux pas valider votre décompte.', {
            text: 'Encore sans rapport, M. Camara ? Sans avancement vérifiable, je ne peux pas valider votre décompte.',
            tail: 72,
            gap: 0.9,
          }),
          line('narr', "Le travail est fait sur le chantier… mais sans rapport, pour le client, il n'existe pas."),
        ],
        post: 0.6,
        overlays: [
          { type: 'chip', at: 0.2, icon: 'clock', tone: 'red', text: 'Lundi · 11 h 20' },
          { type: 'stamp', line: 0, at: 'end', text: 'DÉCOMPTE BLOQUÉ', sub: 'PAIEMENT EN ATTENTE', shake: true },
        ],
        sfx: [{ sfx: 'thump', line: 0, at: 'end', vol: 1 }],
      },
      {
        rewind: "Et si l'équipe utilisait *KonaData* ?",
        pre: 0.6,
        sfx: [{ sfx: 'whoosh', at: 0, vol: 0.9 }],
        lines: [line('narr', "Et si l'équipe de monsieur Camara utilisait Kona Data ?", { text: "Et si l'équipe de M. Camara utilisait KonaData ?" })],
        post: 0.5,
      },
      {
        img: await img('05-saisie.png'),
        kb: [[1.04, 0, 0], [1.12, 0, -30]],
        pre: 0.6,
        lines: [
          line('narr', "Chaque soir, depuis le chantier, Mamadou saisit sur son téléphone l'avancement, l'effectif et la météo du jour."),
          line('narr', 'Photos, carburant et bons de livraison sont enregistrés au fil des jours.'),
          line('mamadou', "C'est enregistré. Le patron le voit déjà au bureau !", { tail: 50 }),
        ],
        post: 0.4,
        overlays: [
          { type: 'chip', at: 0.2, icon: 'calendar', text: 'Chaque soir · 17 h 30' },
          { type: 'dim', line: 0, at: 0, untilLine: 2, untilAt: 0 },
          { type: 'phone', line: 0, at: 0.2, src: releve, x: 300, y: 250, w: 480, untilLine: 1, untilAt: 0 },
          { type: 'phone', line: 1, at: 0, src: enregistre, x: 300, y: 250, w: 480, anim: 'fade', untilLine: 2, untilAt: 0 },
        ],
        sfx: [{ sfx: 'ding', line: 1, at: 0.2, vol: 0.8 }],
      },
      {
        img: await img('06-serein.png'),
        kb: [[1.04, 0, 0], [1.12, 0, -20]],
        pre: 0.5,
        lines: [
          line('narr', 'Lundi, huit heures. Monsieur Camara suit déjà tous ses chantiers depuis son téléphone.', {
            text: 'Lundi, 8 h. M. Camara suit déjà tous ses chantiers depuis son téléphone.',
          }),
          line('narr', "Et le rapport du mois ? Il se génère en un clic : planifié contre réalisé, courbe d'avancement, photos datées.", {
            text: "Et le rapport du mois ? Il se génère en 1 clic : planifié vs réalisé, courbe d'avancement, photos datées.",
          }),
        ],
        post: 0.5,
        overlays: [
          { type: 'chip', at: 0.2, icon: 'calendar', text: 'Lundi · 8 h 00', untilLine: 1, untilAt: 0 },
          { type: 'dim', line: 0, at: 0 },
          { type: 'phone', line: 0, at: 0.2, src: dashboard, x: 300, y: 250, w: 480, untilLine: 1, untilAt: 0 },
          { type: 'chip', line: 1, at: 0, icon: 'check', tone: 'green', text: 'Rapport prêt · 8 h 05' },
          { type: 'pages', line: 1, at: 0.3, pages, w: 400, y: 330 },
        ],
        sfx: [{ sfx: 'ding', line: 1, at: 0.4, vol: 0.8 }],
      },
      {
        img: await img('07-validation.png'),
        kb: [[1.04, 0, 0], [1.13, 0, -20]],
        pre: 0.5,
        lines: [
          line('diallo', "Enfin un rapport clair et complet ! Je valide votre décompte dès aujourd'hui.", { tail: 72, gap: 0.6 }),
          line('camara', 'Et avec Kona Data, vous le recevrez chaque mois, à la même date.', { tail: 30 }),
        ],
        post: 0.5,
        overlays: [
          { type: 'chip', at: 0.2, icon: 'clock', text: 'Lundi · 11 h 00' },
          { type: 'stamp', line: 0, at: 'end', tone: 'green', y: 1340, text: 'DÉCOMPTE VALIDÉ', sub: 'PAIEMENT LANCÉ' },
        ],
        sfx: [{ sfx: 'chime', line: 0, at: 'end', vol: 0.8 }],
      },
      {
        endCard: { title: ['Vos rapports de chantier,', '*en un clic.*'], badge: '6 mois gratuits pour le BTP' },
        pre: 0.3,
        lines: [
          line('narr', 'Kona Data. Vos rapports de chantier, en un clic. Six mois gratuits pour les entreprises du BTP.', {
            text: 'KonaData : vos rapports de chantier, en un clic. 6 mois gratuits pour les entreprises du BTP.',
          }),
        ],
        post: 2.2,
      },
    ],
  };
}

async function storyCementDelivery() {
  const S = 'ciment-livre';
  const img = (f) => sceneImage(S, f);
  const patronPhone = await sceneImage('ingenieur-marche-perdu', '03-patron.png');
  const mamadouCahier = await sceneImage('rapport-chantier', '02-chantier.png');
  const patronSerein = await sceneImage('rapport-chantier', '06-serein.png');
  const BL = 'btp-05-bons-livraison';
  const blForm = await tutoCrop(BL, 'shots/015-filled.jpg', { left: 560, top: 350, width: 1860, height: 826 }, 'bl-saisie');
  const blLines = await tutoCrop(BL, 'shots/021-filled.jpg', { left: 530, top: 200, width: 1900, height: 560 }, 'bl-lignes');

  return {
    id: 'histoire-ciment-livre',
    accent: 'btp',
    music: 0.05,
    shots: [
      {
        img: await img('01-facture.png'),
        kb: [[1.04, 0, 0], [1.16, 0, -40]],
        pre: 0.5,
        lines: [
          line('narr', 'Fin du mois. La cimenterie facture deux cent cinquante sacs de ciment livrés sur le chantier de Kipé. Mais monsieur Camara a un doute.', {
            text: 'Fin du mois. La cimenterie facture 250 sacs de ciment livrés sur le chantier de Kipé. Mais M. Camara a un doute.',
          }),
        ],
        overlays: [
          { type: 'chip', at: 0.3, icon: 'calendar', text: 'Fin du mois' },
          { type: 'notice', at: 2, y: 1120, label: 'FACTURE FOURNISSEUR', title: 'Ciment CPJ 42.5 : 250 sacs · chantier de Kipé', due: 'À payer : 23 750 000 GNF' },
        ],
      },
      {
        img: patronPhone,
        kb: [[1.1, 0, 20], [1.2, 0, 40]],
        pre: 1.2,
        sfx: [{ sfx: 'ring', at: 0, vol: 0.8 }],
        lines: [line('camara', 'Mamadou, on a vraiment reçu deux cent cinquante sacs de ciment ?', { text: 'Mamadou, on a vraiment reçu 250 sacs de ciment ?', tail: 50 })],
        overlays: [{ type: 'call', at: 0, initials: 'M', name: 'Mamadou', status: 'Chef de chantier · appel…', untilLine: 0, untilAt: 0.2 }],
      },
      {
        img: mamadouCahier,
        kb: [[1.1, 0, 60], [1.2, 0, 80]],
        cut: true,
        lines: [line('mamadou', "Euh… il y a eu trois ou quatre livraisons, patron. Les bons papier… je ne sais plus où je les ai mis.", { tail: 50 })],
      },
      {
        img: await img('02-fournisseur.png'),
        kb: [[1.08, 0, 40], [1.16, 0, 60]],
        pre: 0.3,
        lines: [line('sylla', 'Monsieur Camara, mes camions ont tout livré ! Réglez la facture, s’il vous plaît.', { text: 'M. Camara, mes camions ont tout livré ! Réglez la facture, s’il vous plaît.', tail: 48 })],
        overlays: [{ type: 'chip', at: 0.1, icon: 'phone', text: 'M. Sylla · Cimenterie' }],
        post: 0.2,
      },
      {
        img: await img('03-magasin.png'),
        kb: [[1.04, 0, 0], [1.14, 20, -20]],
        pre: 0.4,
        lines: [
          line('narr', 'Sans preuve, impossible de contester. Monsieur Camara paie tout…', { text: 'Sans preuve, impossible de contester. M. Camara paie tout…', gap: 0.5 }),
          line('narr', 'Et au magasin, il manque cinquante sacs.', { text: 'Et au magasin, il manque 50 sacs.' }),
        ],
        post: 0.8,
        overlays: [{ type: 'stamp', line: 1, at: 'end', y: 1260, text: '−4 750 000 GNF', sub: '50 SACS JAMAIS REÇUS', shake: true }],
        sfx: [{ sfx: 'thump', line: 1, at: 'end', vol: 1 }],
      },
      {
        rewind: 'Et si chaque livraison était enregistrée dans *KonaData* ?',
        pre: 0.6,
        sfx: [{ sfx: 'whoosh', at: 0, vol: 0.9 }],
        lines: [line('narr', 'Et si chaque livraison était enregistrée dans Kona Data ?')],
        post: 0.5,
      },
      {
        img: await img('04-livraison.png'),
        kb: [[1.25, 80, 40], [1.35, 100, 60]],
        pre: 0.6,
        lines: [
          line('narr', 'À chaque livraison, Mamadou saisit le bon dans Kona Data : le fournisseur, la quantité réellement reçue, et la copie du bon signé.', {
            text: 'À chaque livraison, Mamadou saisit le bon dans KonaData : fournisseur, quantité réellement reçue, copie du bon signé.',
          }),
          line('narr', 'Une fois le bon validé, le stock du chantier est mis à jour.'),
          line('mamadou', 'Deux cents sacs reçus. C’est enregistré !', { text: '200 sacs reçus. C’est enregistré !', tail: 45 }),
        ],
        post: 0.4,
        overlays: [
          { type: 'chip', at: 0.2, icon: 'calendar', text: 'À chaque livraison', untilLine: 1, untilAt: 0 },
          { type: 'dim', line: 0, at: 0, untilLine: 2, untilAt: 0 },
          { type: 'step', line: 0, at: 0, y: 300, n: '1', text: 'Bon de livraison saisi', untilLine: 2, untilAt: 0 },
          { type: 'image', line: 0, at: 0.3, src: blForm, x: 50, y: 400, w: 980, untilLine: 2, untilAt: 0 },
          { type: 'step', line: 0, at: 2.6, y: 900, n: '2', text: 'Quantité réellement reçue', untilLine: 2, untilAt: 0 },
          { type: 'image', line: 0, at: 2.9, src: blLines, x: 50, y: 990, w: 980, untilLine: 2, untilAt: 0 },
          { type: 'chip', line: 1, at: 0, icon: 'check', tone: 'green', text: 'BL validé · stock +200 sacs' },
        ],
        sfx: [{ sfx: 'ding', line: 1, at: 0.2, vol: 0.8 }],
      },
      {
        img: patronSerein,
        kb: [[1.04, 0, 0], [1.12, 0, -20]],
        pre: 0.5,
        lines: [
          line('narr', 'À réception de la facture, monsieur Camara compare avec les bons validés : deux cents sacs reçus, pas deux cent cinquante.', {
            text: 'À réception de la facture, M. Camara compare avec les bons validés : 200 sacs reçus, pas 250.',
          }),
          line('camara', 'Monsieur Sylla, nos bons signés indiquent deux cents sacs. Je paie deux cents sacs.', { text: 'M. Sylla, nos bons signés indiquent 200 sacs. Je paie 200 sacs.', tail: 55 }),
        ],
        post: 0.2,
        overlays: [
          { type: 'chip', at: 0.2, icon: 'check', tone: 'green', text: 'Bons validés dans KonaData' },
          { type: 'notice', line: 0, at: 0.5, y: 1120, label: 'CONTRÔLE DES LIVRAISONS', title: 'Facturé : 250 sacs · Reçu : 200 sacs', due: 'Écart : 50 sacs · 4 750 000 GNF' },
        ],
      },
      {
        img: await img('05-fournisseur-gene.png'),
        kb: [[1.08, 0, 40], [1.16, 0, 60]],
        cut: true,
        lines: [line('sylla', 'Ah… Vous avez raison, monsieur Camara. Je vous envoie une facture corrigée.', { text: 'Ah… Vous avez raison, M. Camara. Je vous envoie une facture corrigée.', tail: 45 })],
        post: 1.2,
        overlays: [{ type: 'stamp', line: 0, at: 'end', tone: 'green', y: 1250, text: 'FACTURE CORRIGÉE', sub: '4 750 000 GNF ÉCONOMISÉS' }],
        sfx: [{ sfx: 'chime', line: 0, at: 'end', vol: 0.8 }],
      },
      {
        endCard: { title: ['Chaque livraison,', '*enregistrée et prouvée.*'], badge: '6 mois gratuits pour le BTP' },
        pre: 0.3,
        lines: [
          line('narr', 'Kona Data. Chaque livraison, enregistrée et prouvée. Six mois gratuits pour les entreprises du BTP.', {
            text: 'KonaData : chaque livraison, enregistrée et prouvée. 6 mois gratuits pour les entreprises du BTP.',
          }),
        ],
        post: 2.2,
      },
    ],
  };
}

async function storyReportCards() {
  const S = 'nuit-bulletins';
  const img = (f) => sceneImage(S, f);
  const night = await img('01-nuit.png');
  const notes = await tutoCrop('ecole-05-saisie-notes', 'shots/016-highlight.jpg', { left: 600, top: 140, width: 2460, height: 1000 }, 'notes-saisie');
  const complet = await tutoCrop('ecole-06-bulletins', 'shots/008-highlight.jpg', { left: 540, top: 520, width: 2500, height: 370 }, 'bulletins-completude');
  const bulletin = await tutoCrop('ecole-06-bulletins', 'pages-5/page-01.jpg', null, 'bulletin-page1');

  return {
    id: 'histoire-nuit-bulletins',
    accent: 'ecole',
    music: 0.05,
    shots: [
      {
        img: night,
        kb: [[1.04, 0, 0], [1.12, 0, -30]],
        pre: 0.5,
        lines: [
          line('narr', 'Fin du premier trimestre. Six cent vingt élèves, dix-huit classes… et tous les bulletins doivent être remis aux parents lundi.', {
            text: 'Fin du 1er trimestre. 620 élèves, 18 classes… et tous les bulletins doivent être remis aux parents lundi.',
          }),
        ],
        overlays: [
          { type: 'chip', at: 0.3, icon: 'clock', text: 'Vendredi · 22 h 00' },
          { type: 'notice', at: 2, y: 1120, label: 'BULLETINS DU 1er TRIMESTRE', title: '620 élèves · 18 classes', due: 'Remise aux parents : lundi' },
        ],
      },
      {
        img: night,
        kb: [[1.6, -300, 220], [1.66, -320, 240]],
        cut: true,
        lines: [line('barry', 'Madame la directrice, il me manque encore les notes de trois collègues. Et je dois tout recalculer à la main !', { tail: 55 })],
      },
      {
        img: night,
        kb: [[1.6, 290, 300], [1.66, 310, 320]],
        cut: true,
        lines: [line('kourouma', "Encore ? Les parents attendent lundi. On y passera la nuit s'il le faut.", { tail: 45 })],
        post: 0.2,
      },
      {
        img: night,
        kb: [[1.08, 0, -10], [1.18, 0, -40]],
        pre: 0.3,
        sfx: [{ sfx: 'tick', at: 0, vol: 0.55, len: 'shot' }],
        lines: [
          line('narr', 'Moyennes, coefficients, rangs… Chaque bulletin est calculé et recopié à la main. Une seule erreur, et tout le classement change.'),
        ],
        post: 0.4,
        overlays: [
          { type: 'chip', at: 0.2, icon: 'clock', tone: 'red', text: 'Dimanche · 2 h 15' },
          {
            type: 'questions',
            at: 0.8,
            step: 0.8,
            items: [
              ['Coefficient', 50, 300],
              ['Moyenne', 700, 420],
              ['Rang', 80, 1120],
              ['Appréciation', 560, 1200],
              ['Absences', 60, 820],
            ],
          },
        ],
      },
      {
        img: await img('02-parent.png'),
        kb: [[1.05, 0, 0], [1.13, 0, 10]],
        pre: 0.5,
        lines: [
          line('kaba', 'Madame, la moyenne de ma fille est fausse ! Elle a eu quinze en maths, pas cinq !', { text: 'Madame, la moyenne de ma fille est fausse ! Elle a eu 15 en maths, pas 5 !', tail: 38, gap: 0.8 }),
          line('kourouma', 'Je suis désolée, monsieur Kaba… Nous allons tout vérifier.', { text: 'Je suis désolée, M. Kaba… Nous allons tout vérifier.', tail: 80, gap: 0.5 }),
          line('narr', "Des nuits de travail… et la confiance des parents qui s'effrite."),
        ],
        post: 0.6,
        overlays: [
          { type: 'chip', at: 0.2, icon: 'clock', tone: 'red', text: 'Lundi · 8 h 30' },
          { type: 'stamp', line: 1, at: 'end', y: 1250, text: 'ERREUR DE CALCUL', sub: '40 BULLETINS À REFAIRE', shake: true },
        ],
        sfx: [{ sfx: 'thump', line: 1, at: 'end', vol: 1 }],
      },
      {
        rewind: "Et si l'école utilisait *KonaData* ?",
        pre: 0.6,
        sfx: [{ sfx: 'whoosh', at: 0, vol: 0.9 }],
        lines: [line('narr', "Et si l'école utilisait Kona Data ?")],
        post: 0.5,
      },
      {
        img: await img('03-saisie.png'),
        kb: [[1.04, 0, 0], [1.12, 0, -30]],
        pre: 0.6,
        lines: [
          line('narr', 'Chaque enseignant saisit ses notes dans Kona Data, classe par classe, depuis son ordinateur ou son téléphone.', {
            text: 'Chaque enseignant saisit ses notes dans KonaData, classe par classe, depuis son ordinateur ou son téléphone.',
          }),
          line('narr', "Moyennes, coefficients et rangs se calculent tout seuls. Et la directrice voit tout de suite s'il manque des notes."),
        ],
        post: 0.3,
        overlays: [
          { type: 'chip', at: 0.2, icon: 'calendar', text: 'Pendant le trimestre' },
          { type: 'dim', line: 0, at: 0 },
          { type: 'step', line: 0, at: 0, y: 300, n: '1', text: 'Notes saisies par classe' },
          { type: 'image', line: 0, at: 0.3, src: notes, x: 50, y: 400, w: 980 },
          { type: 'step', line: 1, at: 0, y: 870, n: '2', text: 'Complétude vérifiée : 100 %' },
          { type: 'image', line: 1, at: 0.3, src: complet, x: 50, y: 960, w: 980 },
        ],
      },
      {
        img: await img('04-directrice.png'),
        kb: [[1.04, 0, 0], [1.12, 0, -20]],
        pre: 0.5,
        lines: [
          line('narr', 'En un clic, les bulletins de toute la classe sont générés… puis publiés, avec un SMS aux parents.'),
          line('kourouma', 'Six cent vingt bulletins… et pas une seule nuit blanche !', { text: '620 bulletins… et pas une seule nuit blanche !', tail: 70 }),
        ],
        post: 0.4,
        overlays: [
          { type: 'dim', line: 0, at: 0, untilLine: 1, untilAt: 0 },
          { type: 'image', line: 0, at: 0.2, src: bulletin, x: 250, y: 230, w: 580, rot: -3, anim: 'pop', untilLine: 1, untilAt: 0 },
          { type: 'chip', line: 0, at: 3, icon: 'check', tone: 'green', text: 'Bulletins publiés · SMS envoyés' },
        ],
        sfx: [{ sfx: 'ding', line: 0, at: 3.1, vol: 0.8 }],
      },
      {
        img: await img('05-famille.png'),
        kb: [[1.04, 0, 0], [1.12, 0, -20]],
        pre: 0.9,
        sfx: [{ sfx: 'ding', at: 0.2, vol: 0.9 }, { sfx: 'chime', line: 0, at: 'end', vol: 0.7 }],
        lines: [
          line('kaba', 'Aminata, ton bulletin est arrivé ! Seize de moyenne… Je suis fier de toi.', { text: 'Aminata, ton bulletin est arrivé ! 16 de moyenne… Je suis fier de toi.', tail: 62 }),
        ],
        post: 1.2,
        overlays: [
          { type: 'chip', at: 0.2, icon: 'mail', tone: 'green', text: "Nouveau message de l'école" },
          { type: 'confetti', line: 0, at: 'end' },
        ],
      },
      {
        endCard: { title: ['Des bulletins justes,', '*sans nuit blanche.*'], badge: '12 mois gratuits pour les écoles' },
        pre: 0.3,
        lines: [
          line('narr', 'Kona Data. Des bulletins justes, sans nuit blanche. Douze mois gratuits pour les écoles.', {
            text: 'KonaData : des bulletins justes, sans nuit blanche. 12 mois gratuits pour les écoles.',
          }),
        ],
        post: 2.2,
      },
    ],
  };
}

async function storyLostReceipt() {
  const S = 'recu-introuvable';
  const img = (f) => sceneImage(S, f);
  const counter = await img('02-guichet.png');
  const directrice = await sceneImage('nuit-bulletins', '04-directrice.png');
  const PAY = 'ecole-04-paiement-recu';
  const form = await tutoCrop(PAY, 'shots/012-after.jpg', { left: 570, top: 300, width: 2440, height: 720 }, 'paiement-saisie');
  const receipt = await tutoCrop(PAY, 'shots/018-after.jpg', { left: 960, top: 180, width: 1190, height: 1548 }, 'recu-officiel');
  const history = await tutoCrop(PAY, 'shots/016-after.jpg', { left: 540, top: 150, width: 2500, height: 1210 }, 'paiements-historique');

  return {
    id: 'histoire-recu-introuvable',
    accent: 'ecole',
    music: 0.05,
    shots: [
      {
        img: await img('01-portail.png'),
        kb: [[1.04, 0, 0], [1.14, 0, -30]],
        pre: 0.5,
        lines: [
          line('narr', "Lundi matin. Au portail de l'école, Mariame est arrêtée : d'après le registre, sa scolarité n'est pas payée."),
          line('conde', "Désolé, Mariame. Tu n'es pas sur la liste. Dis à ta maman de passer à la caisse.", { tail: 30 }),
        ],
        overlays: [{ type: 'chip', at: 0.3, icon: 'clock', text: 'Lundi · 7 h 45' }],
      },
      {
        img: counter,
        kb: [[1.05, 0, 0], [1.12, 0, 10]],
        pre: 0.4,
        lines: [
          line('fofana', "J'ai payé un million quarante mille francs en septembre ! C'est vous-même qui avez encaissé !", {
            text: "J'ai payé 1 040 000 francs en septembre ! C'est vous-même qui avez encaissé !",
            tail: 28,
          }),
          line('soumah', 'Je ne trouve rien dans le cahier, madame… Vous avez gardé votre reçu ?', { tail: 75 }),
          line('fofana', "Le reçu ? C'était un petit bout de papier… Je ne sais plus où il est.", { tail: 28 }),
        ],
        overlays: [{ type: 'chip', at: 0.2, icon: 'clock', text: 'Lundi · 9 h 00' }],
      },
      {
        img: counter,
        kb: [[1.5, -230, -170], [1.6, -250, -210]],
        cut: true,
        pre: 0.3,
        lines: [
          line('narr', 'Un cahier de caisse, des reçus sur papier libre, des ratures… Personne ne peut prouver qui a payé quoi.', { gap: 0.9 }),
          line('narr', "Et pour l'école aussi, c'est de l'argent qui échappe à tout contrôle."),
        ],
        post: 0.6,
        overlays: [
          { type: 'questions', at: 0.6, step: 0.8, items: [['Payé', 60, 330], ['Quand', 720, 420], ['Combien', 80, 1080], ['Reste', 700, 1150]] },
          { type: 'stamp', line: 0, at: 'end', y: 1250, text: 'LITIGE', sub: 'ÉLÈVE RENVOYÉE À TORT', shake: true },
        ],
        sfx: [{ sfx: 'thump', line: 0, at: 'end', vol: 1 }],
      },
      {
        rewind: 'Et si chaque paiement était enregistré dans *KonaData* ?',
        pre: 0.6,
        sfx: [{ sfx: 'whoosh', at: 0, vol: 0.9 }],
        lines: [line('narr', 'Et si chaque paiement était enregistré dans Kona Data ?')],
        post: 0.5,
      },
      {
        img: await img('03-guichet-kona.png'),
        kb: [[1.04, 0, 0], [1.12, 0, -20]],
        pre: 0.6,
        lines: [
          line('narr', "Au guichet, chaque paiement est saisi dans Kona Data : l'élève, le montant, et le mode de paiement, espèces, Orange Money ou MTN MoMo.", {
            text: "Au guichet, chaque paiement est saisi dans KonaData : l'élève, le montant, et le mode de paiement (espèces, Orange Money, MTN MoMo).",
          }),
          line('narr', 'Le reçu officiel est généré aussitôt, avec un code de vérification et le reste à payer.'),
          line('soumah', 'Voilà votre reçu, madame. Je vous l’envoie aussi sur WhatsApp.', { tail: 75 }),
        ],
        post: 0.3,
        overlays: [
          { type: 'dim', line: 0, at: 0, untilLine: 2, untilAt: 0 },
          { type: 'step', line: 0, at: 0, y: 300, n: '1', text: 'Paiement enregistré', untilLine: 1, untilAt: 0 },
          { type: 'image', line: 0, at: 0.3, src: form, x: 50, y: 400, w: 980, untilLine: 1, untilAt: 0 },
          { type: 'image', line: 1, at: 0.1, src: receipt, x: 260, y: 250, w: 560, anim: 'pop', untilLine: 2, untilAt: 0 },
          { type: 'chip', line: 1, at: 0, icon: 'check', tone: 'green', text: 'Reçu REC-2026-000400' },
        ],
        sfx: [{ sfx: 'ding', line: 1, at: 0.2, vol: 0.8 }],
      },
      {
        img: await img('04-portail-ok.png'),
        kb: [[1.04, 0, 0], [1.13, 0, -30]],
        pre: 0.5,
        lines: [
          line('fofana', "Voici le reçu de l'école, avec son code de vérification.", { tail: 22 }),
          line('conde', 'C’est bon, madame, tout est en règle. Allez, Mariame, en classe !', { tail: 42 }),
        ],
        post: 0.5,
        overlays: [{ type: 'chip', at: 0.2, icon: 'check', tone: 'green', text: 'Paiement vérifié' }],
        sfx: [{ sfx: 'chime', line: 1, at: 0.3, vol: 0.7 }],
      },
      {
        img: directrice,
        kb: [[1.04, 0, 0], [1.12, 0, -20]],
        pre: 0.4,
        lines: [
          line('narr', 'Et la directrice suit chaque jour les encaissements et les impayés, élève par élève.'),
          line('kourouma', 'Plus de litiges à la caisse… et des comptes enfin clairs.', { tail: 70 }),
        ],
        post: 0.4,
        overlays: [
          { type: 'dim', line: 0, at: 0, untilLine: 1, untilAt: 0 },
          { type: 'image', line: 0, at: 0.2, src: history, x: 50, y: 360, w: 980, untilLine: 1, untilAt: 0 },
        ],
      },
      {
        endCard: { title: ['Chaque paiement,', '*un reçu vérifiable.*'], badge: '12 mois gratuits pour les écoles' },
        pre: 0.3,
        lines: [
          line('narr', 'Kona Data. Chaque paiement, un reçu vérifiable. Douze mois gratuits pour les écoles.', {
            text: 'KonaData : chaque paiement, un reçu vérifiable. 12 mois gratuits pour les écoles.',
          }),
        ],
        post: 2.2,
      },
    ],
  };
}

async function storyForgottenCredits() {
  const S = 'credits-oublies';
  const img = (f) => sceneImage(S, f);
  const shopKona = await img('04-boutique-kona.png');
  const CRD = 'pme-05-credits-clients';
  const form = await tutoCrop(CRD, 'shots/012-filled.jpg', { left: 560, top: 570, width: 2470, height: 960 }, 'dette-saisie');
  const partial = await tutoCrop(CRD, 'shots/022-scroll.jpg', { left: 560, top: 725, width: 1220, height: 515 }, 'dette-partiel');
  const overview = await tutoCrop(CRD, 'shots/001-highlight.jpg', { left: 555, top: 170, width: 2475, height: 1030 }, 'credits-vue');

  return {
    id: 'histoire-credits-oublies',
    accent: 'pme',
    music: 0.05,
    shots: [
      {
        img: await img('01-boutique.png'),
        kb: [[1.04, 0, 0], [1.14, 0, -30]],
        pre: 0.5,
        lines: [
          line('narr', 'Au marché de Madina, Monsieur Bah fait crédit à ses clients fidèles. Tout est noté… dans un vieux cahier.'),
          line('keita', "Deux sacs de riz et un bidon d'huile. Note-le, Bah, je te paie à la fin du mois !", { tail: 25 }),
          line('bah', "Pas de souci, Mariama. C'est noté.", { tail: 80 }),
        ],
        overlays: [{ type: 'chip', at: 0.3, icon: 'clock', text: 'Marché de Madina' }],
      },
      {
        img: await img('02-grossiste.png'),
        kb: [[1.05, 0, 0], [1.12, 0, 10]],
        pre: 0.4,
        lines: [
          line('diakite', 'Bah, ça fait trois semaines. Mes huit millions, c’est pour aujourd’hui ?', {
            text: 'Bah, ça fait trois semaines. Mes 8 millions, c’est pour aujourd’hui ?',
            tail: 28,
          }),
          line('bah', "Mes clients ne m'ont pas encore payé… Donne-moi encore une semaine.", { tail: 80 }),
          line('diakite', 'Encore une semaine ? Alors plus de marchandise à crédit pour toi.', { tail: 28 }),
        ],
        overlays: [{ type: 'chip', at: 0.2, icon: 'calendar', tone: 'red', text: 'Fin du mois' }],
      },
      {
        img: await img('03-carnet.png'),
        kb: [[1.5, -60, -110], [1.62, -70, -130]],
        cut: true,
        pre: 0.3,
        lines: [
          line('narr', 'Le soir, il reprend son cahier : des dizaines de noms, des montants barrés, des pages arrachées.', { gap: 0.6 }),
          line('bah', "Mariama dit qu'elle m'a déjà donné cinq cent mille… Je ne le vois nulle part.", {
            text: "Mariama dit qu'elle m'a déjà donné 500 000… Je ne le vois nulle part.",
            tail: 45,
          }),
          line('narr', "Qui lui doit combien ? Qui a déjà remboursé ? Impossible de le dire. L'argent est dehors… et la caisse est vide."),
        ],
        post: 0.6,
        overlays: [
          { type: 'questions', at: 0.6, step: 0.8, items: [['Qui', 60, 330], ['Combien', 680, 420], ['Déjà payé', 60, 1060], ['Pour quand', 620, 1150]] },
          { type: 'stamp', line: 2, at: 'end', y: 1250, text: 'CRÉDITS OUBLIÉS', sub: 'ARGENT DEHORS, CAISSE VIDE', shake: true },
        ],
        sfx: [{ sfx: 'thump', line: 2, at: 'end', vol: 1 }],
      },
      {
        rewind: 'Et si chaque crédit était suivi dans *KonaData* ?',
        pre: 0.6,
        sfx: [{ sfx: 'whoosh', at: 0, vol: 0.9 }],
        lines: [line('narr', 'Et si chaque crédit était suivi dans Kona Data ?')],
        post: 0.5,
      },
      {
        img: shopKona,
        kb: [[1.04, 0, 0], [1.12, 0, -20]],
        pre: 0.6,
        lines: [
          line('narr', "Chaque vente à crédit est enregistrée dans Kona Data : le client, les marchandises, le montant dû et l'échéance.", {
            text: "Chaque vente à crédit est enregistrée dans KonaData : le client, les marchandises, le montant dû et l'échéance.",
          }),
          line('keita', 'Bah, je viens de t’envoyer cinq cent mille par Orange Money.', {
            text: 'Bah, je viens de t’envoyer 500 000 par Orange Money.',
            tail: 25,
          }),
          line('narr', 'Le remboursement est saisi : la dette passe à « Partiel », et le reste à payer se calcule tout seul.'),
          line('bah', "Bien reçu, Mariama. Il te reste cinq cent quatre-vingt-dix mille, d'ici le douze octobre.", {
            text: "Bien reçu, Mariama. Il te reste 590 000, d'ici le 12 octobre.",
            tail: 78,
          }),
        ],
        post: 0.3,
        overlays: [
          { type: 'dim', line: 0, at: 0, untilLine: 1, untilAt: 0 },
          { type: 'step', line: 0, at: 0, y: 300, n: '1', text: 'Nouvelle dette', untilLine: 1, untilAt: 0 },
          { type: 'image', line: 0, at: 0.3, src: form, x: 50, y: 400, w: 980, untilLine: 1, untilAt: 0 },
          { type: 'dim', line: 2, at: 0, untilLine: 3, untilAt: 0.8 },
          { type: 'image', line: 2, at: 0.1, src: partial, x: 140, y: 380, w: 800, anim: 'pop', untilLine: 3, untilAt: 0.8 },
          { type: 'chip', line: 2, at: 0, icon: 'check', tone: 'green', text: 'Partiel · reste 590 000 FG' },
        ],
        sfx: [{ sfx: 'ding', line: 2, at: 0.2, vol: 0.8 }],
      },
      {
        img: shopKona,
        kb: [[1.35, -170, -60], [1.42, -190, -70]],
        cut: true,
        pre: 0.3,
        lines: [
          line('narr', "Et d'un coup d'œil, il voit le total accordé à crédit, ce qui est déjà rentré, et ce qui reste dû, client par client."),
          line('bah', 'Maintenant, je sais exactement qui relancer… et quand.', { tail: 60 }),
        ],
        post: 0.4,
        overlays: [
          { type: 'dim', line: 0, at: 0, untilLine: 1, untilAt: 0 },
          { type: 'image', line: 0, at: 0.2, src: overview, x: 50, y: 360, w: 980, untilLine: 1, untilAt: 0 },
        ],
      },
      {
        img: await img('05-grossiste-ok.png'),
        kb: [[1.04, 0, 0], [1.13, 0, -30]],
        pre: 0.5,
        lines: [
          line('diakite', 'Tout est réglé, Bah. Je te relivre dès lundi.', { tail: 28 }),
          line('bah', 'Merci, mon frère. À lundi !', { tail: 80 }),
        ],
        post: 0.5,
        overlays: [{ type: 'chip', at: 0.2, icon: 'check', tone: 'green', text: 'Fournisseur payé' }],
        sfx: [{ sfx: 'chime', line: 0, at: 0.3, vol: 0.7 }],
      },
      {
        endCard: { title: ['Chaque crédit noté,', '*chaque franc suivi.*'], badge: '6 mois gratuits pour les PME' },
        pre: 0.3,
        lines: [
          line('narr', 'Kona Data. Chaque crédit noté, chaque franc suivi. Six mois gratuits pour les PME.', {
            text: 'KonaData : chaque crédit noté, chaque franc suivi. 6 mois gratuits pour les PME.',
          }),
        ],
        post: 2.2,
      },
    ],
  };
}

async function storyStockOut() {
  const S = 'rupture-marche';
  const img = (f) => sceneImage(S, f);
  const STK = 'pme-03-stock-alerte';
  const form = await tutoCrop(STK, 'shots/016-filled.jpg', { left: 560, top: 335, width: 2465, height: 960 }, 'article-seuil');
  const lowList = await tutoCrop(STK, 'shots/020-scroll.jpg', { left: 560, top: 1275, width: 1220, height: 410 }, 'stock-bas-liste');
  const advice = await tutoCrop(STK, 'shots/020-scroll.jpg', { left: 560, top: 130, width: 2465, height: 320 }, 'stock-recommandation');

  return {
    id: 'histoire-rupture-marche',
    accent: 'pme',
    music: 0.05,
    shots: [
      {
        img: await img('01-foule.png'),
        kb: [[1.04, 0, 0], [1.14, 0, -30]],
        pre: 0.5,
        lines: [
          line('narr', 'Veille de Tabaski. Tout Conakry fait ses courses, et la boutique de Madame Touré ne désemplit pas.'),
          line('client', "Deux bidons d'huile de vingt litres, s'il vous plaît !", { text: "Deux bidons d'huile de 20 litres, s'il vous plaît !", tail: 48 }),
          line('toure', 'Tout de suite ! Sékou, apporte deux bidons de la réserve !', { tail: 82 }),
        ],
        overlays: [{ type: 'chip', at: 0.3, icon: 'calendar', text: 'Veille de Tabaski' }],
      },
      {
        img: await img('02-reserve.png'),
        kb: [[1.05, 0, 0], [1.12, 0, 10]],
        pre: 0.4,
        lines: [
          line('sekou', "Patronne… il n'y a plus d'huile. Plus un seul bidon !", { tail: 55 }),
          line('toure', "Comment ça ? J'étais sûre qu'il en restait plein !", { tail: 16 }),
        ],
        sfx: [{ sfx: 'thump', line: 0, at: 'end', vol: 0.8 }],
      },
      {
        img: await img('03-clients-partent.png'),
        kb: [[1.05, 0, 0], [1.14, 20, -20]],
        pre: 0.4,
        lines: [
          line('client', "Pas d'huile, un jour pareil ? On va voir en face.", { tail: 50 }),
          line('narr', "Les clients partent chez la concurrence. Et le grossiste ne peut pas livrer avant trois jours… après la fête.", { gap: 0.6 }),
          line('narr', 'Personne ne savait que le stock baissait. Le cahier, lui, ne prévient pas.'),
        ],
        post: 0.6,
        overlays: [
          { type: 'questions', line: 1, at: 0.2, step: 0.8, items: [['Combien en reste', 60, 330], ['Quand commander', 560, 440]] },
          { type: 'stamp', line: 2, at: 'end', y: 1250, text: 'RUPTURE', sub: 'VENTES PERDUES LE JOUR J', shake: true },
        ],
        sfx: [{ sfx: 'thump', line: 2, at: 'end', vol: 1 }],
      },
      {
        rewind: 'Et si le stock prévenait *avant* la rupture ?',
        pre: 0.6,
        sfx: [{ sfx: 'whoosh', at: 0, vol: 0.9 }],
        lines: [line('narr', 'Et si le stock prévenait avant la rupture ?')],
        post: 0.5,
      },
      {
        img: await img('04-commande.png'),
        kb: [[1.04, 0, 0], [1.12, 0, -20]],
        pre: 0.6,
        lines: [
          line('narr', "Une semaine plus tôt. Dans Kona Data, chaque article a son seuil d'alerte : dès que le stock passe en dessous, il est marqué « Stock bas ».", {
            text: "Une semaine plus tôt. Dans KonaData, chaque article a son seuil d'alerte : dès que le stock passe en dessous, il est marqué « Stock bas ».",
          }),
          line('narr', 'Sur le tableau de bord, Madame Touré voit la liste des stocks bas… et Kona Data lui recommande de réapprovisionner.', {
            text: 'Sur le tableau de bord, Madame Touré voit la liste des stocks bas… et KonaData lui recommande de réapprovisionner.',
          }),
          line('toure', "Allô, Monsieur Diakité ? Dix bidons d'huile et vingt sacs d'oignons, livrés avant jeudi.", {
            text: "Allô, M. Diakité ? 10 bidons d'huile et 20 sacs d'oignons, livrés avant jeudi.",
            tail: 80,
          }),
          line('diakite', "C'est noté, Madame Touré. Vous serez livrée mercredi."),
        ],
        post: 0.3,
        overlays: [
          { type: 'chip', at: 0.2, icon: 'rewind', text: 'Une semaine plus tôt', untilLine: 2, untilAt: 0 },
          { type: 'dim', line: 0, at: 0, untilLine: 2, untilAt: 0 },
          { type: 'step', line: 0, at: 0, y: 300, n: '1', text: "Seuil d'alerte par article", untilLine: 1, untilAt: 0 },
          { type: 'image', line: 0, at: 0.3, src: form, x: 50, y: 400, w: 980, untilLine: 1, untilAt: 0 },
          { type: 'step', line: 1, at: 0, y: 300, n: '2', text: 'Stock bas + recommandation', untilLine: 2, untilAt: 0 },
          { type: 'image', line: 1, at: 0.1, src: lowList, x: 50, y: 400, w: 980, anim: 'pop', untilLine: 2, untilAt: 0 },
          { type: 'image', line: 1, at: 1.6, src: advice, x: 50, y: 760, w: 980, anim: 'pop', untilLine: 2, untilAt: 0 },
          { type: 'call', line: 2, at: 0, initials: 'MD', name: 'M. Diakité', status: 'Grossiste · en ligne' },
        ],
        sfx: [{ sfx: 'ding', line: 1, at: 1.7, vol: 0.7 }],
      },
      {
        img: await img('05-fete-ok.png'),
        kb: [[1.04, 0, 0], [1.13, 0, -30]],
        pre: 0.5,
        lines: [
          line('narr', 'Veille de Tabaski. Cette fois, les rayons sont pleins.'),
          line('cliente', "Enfin une boutique où il y a de l'huile !", { tail: 62 }),
          line('toure', 'Chez nous, on ne tombe plus en rupture.', { tail: 84 }),
        ],
        post: 0.5,
        overlays: [{ type: 'chip', at: 0.2, icon: 'check', tone: 'green', text: 'Stock prêt pour la fête' }],
        sfx: [{ sfx: 'chime', line: 2, at: 0.3, vol: 0.7 }],
      },
      {
        endCard: { title: ['Le bon stock,', '*au bon moment.*'], badge: '6 mois gratuits pour les PME' },
        pre: 0.3,
        lines: [
          line('narr', 'Kona Data. Le bon stock, au bon moment. Six mois gratuits pour les PME.', {
            text: 'KonaData : le bon stock, au bon moment. 6 mois gratuits pour les PME.',
          }),
        ],
        post: 2.2,
      },
    ],
  };
}

async function storyVanishingFuel() {
  const S = 'gasoil-evapore';
  const img = (f) => sceneImage(S, f);
  const FUEL = 'btp-04-carburant';
  const form = await tutoCrop(FUEL, 'shots/013-filled.jpg', { left: 560, top: 335, width: 2465, height: 860 }, 'carburant-releve');
  const history = await tutoCrop(FUEL, 'shots/014-after.jpg', { left: 560, top: 455, width: 2465, height: 1030 }, 'carburant-historique');

  return {
    id: 'histoire-gasoil-evapore',
    accent: 'btp',
    music: 0.05,
    shots: [
      {
        img: await img('01-facture.png'),
        kb: [[1.04, 0, 0], [1.14, 0, -30]],
        pre: 0.5,
        lines: [
          line('narr', 'Chantier de la route Dubréka–Khorira. En fin de semaine, Monsieur Camara reçoit les factures de gasoil.'),
          line('camara', "Mille cent quatre-vingts litres en une semaine ? Quatorze millions de francs ! Mais qu'est-ce qu'on fait de tout ce gasoil ?", {
            text: "1 180 litres en une semaine ? 14 millions de francs ! Mais qu'est-ce qu'on fait de tout ce gasoil ?",
            tail: 50,
          }),
        ],
        overlays: [{ type: 'chip', at: 0.3, icon: 'clock', text: 'Vendredi · 17 h 00' }],
      },
      {
        img: await img('02-chantier.png'),
        kb: [[1.05, 0, 0], [1.12, 0, 10]],
        pre: 1.1,
        sfx: [{ sfx: 'ring', at: 0, vol: 0.9 }],
        lines: [
          line('mamadou', "Patron, les chauffeurs font le plein eux-mêmes, au bidon. J'ai quelques papiers… mais pas tout.", { tail: 55 }),
          line('camara', 'Quelle machine ? Combien de litres ? Personne ne sait ?', { tail: 50 }),
        ],
        overlays: [{ type: 'call', at: 0, initials: 'MC', name: 'M. Camara', status: 'Directeur · en ligne' }],
      },
      {
        img: await img('03-nuit.png'),
        kb: [[1.12, -50, 0], [1.35, -180, 60]],
        cut: true,
        pre: 0.4,
        lines: [
          line('narr', 'Des pleins notés sur des bouts de papier… quand ils sont notés. Et la nuit, certains bidons prennent une autre route.', { gap: 0.6 }),
          line('narr', "Sans relevé, impossible de savoir ce qui est normal… et ce qui ne l'est pas."),
        ],
        post: 0.6,
        overlays: [
          { type: 'questions', at: 0.8, step: 0.8, items: [['Combien de litres', 60, 330], ['Quel chantier', 600, 440], ['Qui a rempli', 80, 1060]] },
          { type: 'stamp', line: 1, at: 'end', y: 1250, text: 'GASOIL ÉVAPORÉ', sub: 'DES MILLIONS SANS TRACE', shake: true },
        ],
        sfx: [{ sfx: 'thump', line: 1, at: 'end', vol: 1 }],
      },
      {
        rewind: 'Et si chaque plein était enregistré dans *KonaData* ?',
        pre: 0.6,
        sfx: [{ sfx: 'whoosh', at: 0, vol: 0.9 }],
        lines: [line('narr', 'Et si chaque plein était enregistré dans Kona Data ?')],
        post: 0.5,
      },
      {
        img: await img('04-releve.png'),
        kb: [[1.04, 0, 0], [1.12, 0, -20]],
        pre: 0.6,
        lines: [
          line('narr', 'À chaque plein, Mamadou fait un relevé dans Kona Data : le chantier, les litres, le coût, et une note, comme « plein niveleuse, tronçon PK 6 ».', {
            text: 'À chaque plein, Mamadou fait un relevé dans KonaData : le chantier, les litres, le coût, et une note (« Plein niveleuse — tronçon PK 6 »).',
          }),
          line('narr', 'Une consommation suspecte ? Il la marque comme anomalie : elle remonte dans les alertes de la direction.'),
          line('mamadou', "Cent quatre-vingts litres pour la niveleuse. C'est enregistré !", { text: "180 litres pour la niveleuse. C'est enregistré !", tail: 70 }),
        ],
        post: 0.3,
        overlays: [
          { type: 'dim', line: 0, at: 0, untilLine: 2, untilAt: 0 },
          { type: 'step', line: 0, at: 0, y: 300, n: '1', text: 'Relevé carburant', untilLine: 1, untilAt: 0 },
          { type: 'step', line: 1, at: 0, y: 300, n: '2', text: 'Anomalie → alerte direction', untilLine: 2, untilAt: 0 },
          { type: 'image', line: 0, at: 0.3, src: form, x: 50, y: 400, w: 980, untilLine: 2, untilAt: 0 },
          { type: 'chip', line: 2, at: 0, icon: 'check', tone: 'green', text: 'Relevé enregistré' },
        ],
        sfx: [{ sfx: 'ding', line: 2, at: 0.2, vol: 0.8 }],
      },
      {
        img: await img('05-bureau.png'),
        kb: [[1.04, 0, 0], [1.12, 0, -20]],
        pre: 0.4,
        lines: [
          line('narr', 'Au bureau, Monsieur Camara suit la consommation de chaque chantier. Les anomalies ressortent en rouge.'),
          line('camara', 'Enfin, je sais où passe chaque litre. Mamadou, demain matin, on vérifie ce relevé en alerte.', { tail: 55 }),
          line('narr', 'Les pleins sont suivis, les écarts vérifiés… et la facture de gasoil redevient normale.'),
        ],
        post: 0.4,
        overlays: [
          { type: 'dim', line: 0, at: 0, untilLine: 1, untilAt: 0 },
          { type: 'image', line: 0, at: 0.2, src: history, x: 50, y: 360, w: 980, untilLine: 1, untilAt: 0 },
          { type: 'chip', line: 0, at: 1.2, icon: 'alert', tone: 'red', text: 'Alerte · 1 180 L', untilLine: 2, untilAt: 0 },
          { type: 'chip', line: 2, at: 0, icon: 'check', tone: 'green', text: 'Consommation sous contrôle' },
        ],
        sfx: [{ sfx: 'chime', line: 2, at: 0.3, vol: 0.7 }],
      },
      {
        endCard: { title: ['Chaque litre de gasoil,', '*une trace.*'], badge: '6 mois gratuits pour le BTP' },
        pre: 0.3,
        lines: [
          line('narr', 'Kona Data. Chaque litre de gasoil, une trace. Six mois gratuits pour les entreprises du BTP.', {
            text: 'KonaData : chaque litre de gasoil, une trace. 6 mois gratuits pour les entreprises du BTP.',
          }),
        ],
        post: 2.2,
      },
    ],
  };
}

const STORIES_BY_ID = {
  'histoire-gasoil-evapore': storyVanishingFuel,
  'histoire-rupture-marche': storyStockOut,
  'histoire-credits-oublies': storyForgottenCredits,
  'histoire-recu-introuvable': storyLostReceipt,
  'histoire-nuit-bulletins': storyReportCards,
  'histoire-ingenieur-marche-perdu': storyEngineerLostTender,
  'histoire-rapport-chantier': storySiteReport,
  'histoire-ciment-livre': storyCementDelivery,
};

// ---------------------------------------------------------------- montage
function endCard(t0, qr, card) {
  return `${glows()}<div class="end">
    <div style="animation:${A('pop', t0 + 0.1, 0.8)}">${logo(96)}</div>
    <h1 style="animation:${A('up', t0 + 0.4, 0.7)}">${card.title.map(rich).join('<br>')}</h1>
    <div class="badge" style="font-size:52px;animation:${A('pop', t0 + 0.9, 0.7)}">${icon('gift')}<span>${esc(card.badge)}</span></div>
    <div style="font-size:70px;font-weight:900;letter-spacing:-.03em;animation:${A('up', t0 + 1.2, 0.7)}"><em>${CONTACT.site}</em></div>
    <div class="foot" style="font-size:42px;color:#CBD5E1;animation:${A('up', t0 + 1.4, 0.7)}"><span>${icon('phone')}WhatsApp ${CONTACT.whatsapp}</span></div>
    <div class="qrbox" style="animation:${A('pop', t0 + 1.6, 0.7)}"><div style="width:220px;height:220px">${qr}</div>Scannez-moi</div>
  </div>`;
}

function rewindCard(sh, t0) {
  return `<div class="rew"><div class="ln" style="animation:${A('lines', t0 - XF, 3, 'linear')}"></div></div>
    <div class="abs col" style="inset:0;align-items:center;justify-content:center;gap:70px;padding:0 90px 300px;text-align:center">
      <div class="ic" style="animation:${A('pop', t0 + 0.1, 0.7)}"><div style="display:grid;place-items:center;animation:${A('spinback', t0 + 0.1, 1.1)}">${svg('rewind')}</div></div>
      <h1 style="font-size:104px;animation:${A('up', t0 + 0.5, 0.8)}">${rich(sh.rewind)}</h1>
    </div>`;
}

/** Découpe une réplique en bulles de longueur voisine, de préférence après une ponctuation. */
function balancedChunks(text, max) {
  if (text.length <= max) return [text];
  const words = text.split(/\s+/);
  const k = Math.ceil(text.length / max);
  const ends = [];
  words.reduce((n, w, i) => (ends[i] = n + (i ? 1 : 0) + w.length), 0);
  const cuts = [];
  let from = 0;
  for (let b = 1; b < k; b++) {
    const ideal = (text.length * b) / k;
    let best = -1;
    let bestScore = Infinity;
    for (let i = from; i < words.length - 1; i++) {
      const bonus = /[.?!…]$/.test(words[i]) ? 18 : /[,;:]$/.test(words[i]) ? 10 : 0;
      const glued = /^(le|la|les|un|une|de|des|du|au|aux|à|en|et|pour|dans|avec|son|sa|ses|votre|il|on)$/i.test(words[i]) ? 15 : 0;
      const score = Math.abs(ends[i] - ideal) - bonus + glued;
      if (score < bestScore) [best, bestScore] = [i, score];
    }
    cuts.push(best);
    from = best + 1;
  }
  return [...cuts, words.length - 1].map((end, j) => words.slice(j ? cuts[j - 1] + 1 : 0, end + 1).join(' '));
}

function bars() {
  return `<u>${[0, 1, 2].map((i) => `<i style="animation:bars .5s ease-in-out ${i * 0.15}s infinite"></i>`).join('')}</u>`;
}

async function renderStory(browser, story, qr) {
  console.log(`\n🎬 ${story.id}`);
  const tts = path.join(SWORK, 'tts');
  const clips = [];
  const durs = [];
  const sfx = [];
  let t = 0;
  const seg = (clip, d) => {
    clips.push(clip);
    durs.push(d);
    t += d;
  };

  // Chronologie : plans → répliques → segments audio.
  for (const sh of story.shots) {
    sh.start = t;
    if (sh.pre) seg(null, sh.pre);
    for (const ln of sh.lines ?? []) {
      const c = CAST[ln.who];
      ln.clip = await voiceClip(ln.say, tts, { voice: c.voice, rate: c.rate, pitch: c.pitch });
      ln.start = t + LEAD;
      ln.end = ln.start + ln.clip.dur;
      seg(ln.clip, LEAD + ln.clip.dur + (ln.gap ?? 0.35));
    }
    if (sh.post) seg(null, sh.post);
    sh.end = t;
  }
  const total = t;

  const when = (sh, o, atKey = 'at', lineKey = 'line') => {
    const at = o[atKey] ?? 0;
    if (o[lineKey] == null) return sh.start + at;
    const ln = sh.lines[o[lineKey]];
    return at === 'end' ? ln.end : ln.start + at;
  };

  for (const sh of story.shots) {
    for (const e of sh.sfx ?? []) {
      const t0 = when(sh, e);
      sfx.push({ sfx: e.sfx, t: t0, vol: e.vol, len: e.len === 'shot' ? sh.end - t0 : e.len });
    }
  }

  // Sous-titres : une bulle par morceau de réplique, avec le nom du personnage.
  const cues = [];
  for (const sh of story.shots) {
    for (const ln of sh.lines ?? []) {
      const chunks = balancedChunks(ln.text, 62);
      const n = chunks.reduce((a, c) => a + c.length, 0);
      let c0 = ln.start;
      for (const chunk of chunks) {
        const d = (ln.clip.dur * chunk.length) / n;
        const text = chunk
          .replace(/ (?=[!?:;»])/g, '\u00A0')
          .replace(/« /g, '«\u00A0')
          .replace(/(\d) (?=\d{3}\b)/g, '$1\u00A0');
        cues.push({ text, start: c0, end: c0 + d, who: ln.who, tail: ln.tail });
        c0 += d;
      }
    }
  }

  const [a1, a2] = ACCENTS[story.accent];
  const n = story.shots.length;
  const kbCss = [];
  const shotsHtml = story.shots
    .map((sh, i) => {
      const s = sh.start;
      const d = sh.end - sh.start;
      const xf = sh.cut ? 0.08 : XF;
      const anims = [];
      if (i > 0) anims.push(A('fade', s - xf, xf, 'linear'));
      if (i < n - 1) anims.push(A('hide', sh.end + (story.shots[i + 1].cut ? 0.08 : XF), 0.001, 'linear', 'forwards'));
      let bg = '';
      if (sh.img) {
        const [[z0, x0, y0], [z1, x1, y1]] = sh.kb;
        kbCss.push(`@keyframes kb${i}{from{transform:translate(${x0}px,${y0}px) scale(${z0})}to{transform:translate(${x1}px,${y1}px) scale(${z1})}}`);
        bg = `<img class="bg" src="${sh.img}" style="animation:${A(`kb${i}`, s - xf, d + xf + 0.4, 'linear')}"><div class="vig"></div>`;
      } else if (sh.rewind) bg = rewindCard(sh, s);
      else if (sh.endCard) bg = endCard(s, qr, sh.endCard);
      const shakeAt = (sh.overlays ?? []).filter((o) => o.shake).map((o) => when(sh, o));
      const overlays = (sh.overlays ?? [])
        .map((o) => {
          const o2 = { ...o };
          if (o.untilLine != null) o2.untilT = when(sh, o, 'untilAt', 'untilLine');
          else if (o.untilT != null) o2.untilT = sh.start + o.untilT;
          return OVERLAYS[o.type](o2, when(sh, o));
        })
        .join('');
      const inner = `<div class="abs" style="inset:0;${shakeAt.length ? `animation:${shakeAt.map((ts) => A('shake', ts, 0.4, 'linear', 'none')).join(',')}` : ''}">${bg}${overlays}</div>`;
      return `<div class="shot" style="z-index:${i + 1};${anims.length ? `animation:${anims.join(',')}` : ''}">${inner}</div>`;
    })
    .join('\n');

  const capsHtml = cues
    .map((c) => {
      const who = CAST[c.who];
      const talk = c.who !== 'narr';
      const head = talk ? `<b style="color:${who.color}">${bars()}${esc(who.name)}</b>` : '';
      return `<div class="scap" style="animation:${A('fade', c.start, 0.12, 'linear')},${A('hide', c.end, 0.001, 'linear', 'forwards')}"><div class="bub ${talk ? 'talk' : 'narr'}" style="--tx:${c.tail ?? 50}%">${head}<span>${esc(c.text)}</span></div></div>`;
    })
    .join('\n');

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>${CSS}${STORY_CSS}${kbCss.join('\n')}
:root{--a1:${a1};--a2:${a2}}</style></head><body>
<div class="cv" style="width:${W}px;height:${H}px">${shotsHtml}${capsHtml}</div></body></html>`;

  const dir = path.join(SWORK, story.id);
  if (STILLS) return renderStills(browser, html, dir);
  const voiceMix = await buildAudio(dir, clips, durs, { lead: LEAD, musicVolume: story.music ?? 0 });
  const audio = mixSfx(voiceMix, sfx, total, path.join(dir, 'audio-sfx.m4a'));
  const out = path.join(OUT, `${story.id}-9x16.mp4`);
  await renderHtmlVideo(browser, { html, htmlFile: path.join(dir, 'video.html'), W, H, total, audio, out });
  const light = out.replace(/\.mp4$/, '-whatsapp.mp4');
  ff(
    [
      '-i', out, '-vf', 'scale=720:1280:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow', '-crf', '24',
      '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-y', light,
    ],
    'version WhatsApp'
  );
  const srt = cues.map((c) => ({ ...c, text: c.who === 'narr' ? c.text : `${CAST[c.who].name} : ${c.text}` }));
  await writeFile(out.replace(/\.mp4$/, '.srt'), toSrt(srt), 'utf8');
  console.log(`  ${cues.length} sous-titres, ${(total).toFixed(1)} s à ${FPS} i/s`);
}

/** Aperçu rapide : quelques images fixes (planche contact) au lieu de la vidéo complète. */
async function renderStills(browser, html, dir) {
  await mkdir(dir, { recursive: true });
  const htmlFile = path.join(dir, 'stills.html');
  await writeFile(htmlFile, html, 'utf8');
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await ctx.newPage();
  await page.goto(url(htmlFile), { waitUntil: 'load' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images).map((i) => i.decode?.().catch(() => {})));
  });
  const tiles = [];
  for (const t of STILLS) {
    await page.evaluate((ms) => document.getAnimations().forEach((a) => ((a.currentTime = ms), a.pause())), t * 1000);
    tiles.push(await sharp(await page.screenshot({ type: 'png' })).resize(360, 640).toBuffer());
  }
  await ctx.close();
  const cols = Math.min(4, tiles.length);
  const out = path.join(dir, 'stills.png');
  await sharp({ create: { width: cols * 365, height: Math.ceil(tiles.length / cols) * 645, channels: 3, background: '#fff' } })
    .composite(tiles.map((input, i) => ({ input, left: (i % cols) * 365, top: Math.floor(i / cols) * 645 })))
    .png()
    .toFile(out);
  console.log('  aperçu :', out);
}

async function main() {
  await mkdir(path.join(SWORK, 'sfx'), { recursive: true });
  await mkdir(OUT, { recursive: true });
  await prepareBrandAssets();
  const qr = await qrSvg();
  const stories = [];
  for (const [id, build] of Object.entries(STORIES_BY_ID)) if (!ONLY || ONLY.includes(id)) stories.push(await build());
  const browser = await launchBrowser();
  try {
    for (const story of stories) {
      await renderStory(browser, story, qr);
    }
  } finally {
    await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]);
  }
  console.log('\n✅ Vidéos :', OUT);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error('❌', e);
    process.exit(1);
  }
);
