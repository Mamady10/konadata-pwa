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

const STORIES_BY_ID = {
  'histoire-ingenieur-marche-perdu': storyEngineerLostTender,
  'histoire-rapport-chantier': storySiteReport,
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
      for (const text of chunks) {
        const d = (ln.clip.dur * text.length) / n;
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
