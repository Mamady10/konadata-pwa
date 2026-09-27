/**
 * Rendu d'un tutoriel capturé : captures réelles + caméra (zoom sur la zone utile),
 * curseur animé, effets de clic, menus déroulants, surlignage, pages PDF,
 * carton d'introduction et de fin, voix off et sous-titres.
 */
import { writeFile } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { ACCENTS, CONTACT, SECTOR_LABELS } from '../../marketing/campaign-content.mjs';
import { CSS, ICON_PATHS, WORK, esc, glows, icon, logo, url } from '../../marketing/campaign-html.mjs';
import { buildAudio, captionTimeline, renderHtmlVideo, toSrt, voiceClip } from '../../marketing/video-kit.mjs';

const LEAD = 0.25;
const FADE = 0.22;
const TTS_DIR = path.join(WORK, 'tutorials', 'tts');

const MIN = { goto: 1.0, scroll: 1.0, click: 1.6, check: 1.4, highlight: 1.9, select: 2.3, download: 1.9, card: 3.2 };

function layoutFor(m) {
  const { width: vw, height: vh } = m.viewport;
  if (m.device === 'mobile') {
    const W = 1080;
    const H = 1920;
    const S = 1480 / vh;
    return { W, H, S, vw, vh, ox: (W - vw * S) / 2, oy: 250, mobile: true, zmax: 1.3 };
  }
  const W = 1920;
  const H = 1080;
  return { W, H, S: W / vw, vw, vh, ox: 0, oy: 0, mobile: false, zmax: 1.55 };
}

class Keyframes {
  constructor(total) {
    this.T = total;
    this.rules = [];
    this.n = 0;
  }
  /** frames : [{ t, css: {prop: value}, ease }] triés par t. */
  anim(frames) {
    const T = this.T;
    const fs = [...frames].sort((a, b) => a.t - b.t);
    if (fs[0].t > 0) fs.unshift({ t: 0, css: fs[0].css });
    if (fs[fs.length - 1].t < T) fs.push({ t: T, css: fs[fs.length - 1].css });
    const name = `k${this.n++}`;
    const seen = new Set();
    const body = fs
      .map((f) => {
        let p = Math.min(100, Math.max(0, (f.t / T) * 100));
        while (seen.has(p.toFixed(4))) p += 0.0001;
        seen.add(p.toFixed(4));
        const decl = Object.entries(f.css).map(([k, v]) => `${k}:${v}`);
        decl.push(`animation-timing-function:${f.ease || 'linear'}`);
        return `${p.toFixed(4)}%{${decl.join(';')}}`;
      })
      .join('');
    this.rules.push(`@keyframes ${name}{${body}}`);
    return `animation:${name} ${T.toFixed(3)}s linear 0s 1 both`;
  }
  /** Visible entre `a` et `b` (fondu `fade`). */
  show(a, b, fade = FADE) {
    return this.anim([
      { t: 0, css: { opacity: 0 } },
      { t: Math.max(0, a), css: { opacity: 0 } },
      { t: a + fade, css: { opacity: 1 } },
      { t: Math.max(a + fade, b), css: { opacity: 1 } },
      { t: Math.max(a + fade, b) + fade, css: { opacity: 0 } },
    ]);
  }
}

const EASE = 'cubic-bezier(.45,0,.2,1)';

function actionMin(a) {
  if (a.type === 'fill') return 1.35 + Math.min(1.1, (a.text?.length ?? 0) * 0.045);
  if (a.type === 'pages') return Math.max(3.5, 2.4 * a.files.length);
  return MIN[a.type] ?? 1.5;
}

function union(boxes) {
  const bs = boxes.filter(Boolean);
  if (!bs.length) return null;
  const x = Math.min(...bs.map((b) => b.x));
  const y = Math.min(...bs.map((b) => b.y));
  const r = Math.max(...bs.map((b) => b.x + b.w));
  const btm = Math.max(...bs.map((b) => b.y + b.h));
  return { x, y, w: r - x, h: btm - y };
}

function cameraFor(L, region, zoom) {
  if (!region || zoom === false || zoom === 1) return { tx: 0, ty: 0, z: 1 };
  const pad = L.mobile ? 60 : 120;
  const r = { x: region.x - pad, y: region.y - pad, w: region.w + pad * 2, h: region.h + pad * 2 };
  let z = typeof zoom === 'number' ? zoom : Math.min((L.W * 0.9) / r.w, (L.H * 0.8) / r.h);
  z = Math.max(1, Math.min(L.zmax, z));
  if (z < 1.08) return { tx: 0, ty: 0, z: 1 };
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  let tx = L.W / 2 - cx * z;
  let ty = L.H * 0.46 - cy * z;
  tx = Math.min(0, Math.max(L.W - L.W * z, tx));
  ty = Math.min(0, Math.max(L.H - L.H * z, ty));
  return { tx, ty, z };
}

const camCss = (c) => ({ transform: `translate(${c.tx.toFixed(1)}px,${c.ty.toFixed(1)}px) scale(${c.z.toFixed(4)})` });

const CURSOR_SVG = `<svg viewBox="0 0 32 32" width="100%" height="100%"><path d="M6 3l19 12.5-8.2 1.6 4.9 9.6-3.7 1.9-4.9-9.7L6.5 25z" fill="#fff" stroke="#0A192F" stroke-width="2" stroke-linejoin="round"/></svg>`;

const TUTO_CSS = `
*{animation-play-state:paused!important}
.stage{position:absolute;left:0;top:0;transform-origin:0 0;will-change:transform}
.screen{position:absolute;overflow:hidden;background:#fff}
.screen img{position:absolute;left:0;top:0;width:100%;height:100%}
.ring{position:absolute;border-radius:14px;border:4px solid var(--a1);box-shadow:0 0 0 6px color-mix(in srgb,var(--a1) 25%,transparent),0 0 40px color-mix(in srgb,var(--a1) 60%,transparent)}
.ring.spot{box-shadow:0 0 0 6px color-mix(in srgb,var(--a1) 25%,transparent),0 0 0 4000px rgba(6,17,31,.42)}
.ripple{position:absolute;width:90px;height:90px;margin:-45px 0 0 -45px;border-radius:50%;background:color-mix(in srgb,var(--a1) 55%,transparent);border:3px solid var(--a1)}
.cursor{position:absolute;left:0;top:0;width:44px;height:44px;margin:-4px 0 0 -6px;filter:drop-shadow(0 4px 8px rgba(0,0,0,.35));z-index:60}
.cursor i{display:block;width:100%;height:100%;transform-origin:20% 15%}
.tap{position:absolute;width:74px;height:74px;margin:-37px 0 0 -37px;border-radius:50%;background:rgba(255,255,255,.55);border:4px solid var(--a1);box-shadow:0 6px 24px rgba(0,0,0,.35);z-index:60}
.menu{position:absolute;background:#fff;border-radius:12px;box-shadow:0 18px 50px rgba(2,8,23,.35),0 0 0 1px rgba(15,23,42,.12);padding:8px 0;color:#0F172A;font-weight:500;z-index:55;overflow:hidden}
.menu div{padding:.42em .9em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.menu .sel{background:#2563EB;color:#fff}
.callout{position:absolute;z-index:58;background:#0A192F;color:#fff;font-weight:700;padding:.5em .9em;border-radius:.6em;box-shadow:0 12px 30px rgba(0,0,0,.35);border:2px solid var(--a1);white-space:nowrap}
.cap{position:absolute;left:0;right:0;display:flex;justify-content:center;z-index:100}
.cap span{background:rgba(6,17,31,.86);color:#fff;font-weight:700;text-align:center;line-height:1.3;padding:.32em .8em;border-radius:.45em;box-shadow:0 8px 30px rgba(0,0,0,.35)}
.card{position:absolute;inset:0;z-index:90;background:#0A192F;overflow:hidden}
.card li svg{flex:none;width:1.25em;height:1.25em;margin-top:.04em;padding:.22em;border-radius:50%;background:linear-gradient(135deg,var(--a1),var(--a2));color:#0A192F;stroke-width:3.4}
.chip{display:inline-flex;align-items:center;gap:.5em;padding:.35em .8em;border-radius:999px;background:rgba(15,32,60,.8);border:1.5px solid color-mix(in srgb,var(--a1) 60%,transparent);color:#E2E8F0;font-weight:700;white-space:nowrap}
.chip svg{width:1.15em;height:1.15em;flex:none;stroke:var(--a1)}
.bar{position:absolute;left:0;bottom:0;height:6px;width:100%;transform-origin:0 50%;background:linear-gradient(90deg,var(--a1),var(--a2));z-index:101}
.viewer{position:absolute;inset:0;z-index:80;background:rgba(6,17,31,.94)}
.viewer img{position:absolute;box-shadow:0 30px 80px rgba(0,0,0,.5);border-radius:6px;background:#fff}
.toast{position:absolute;z-index:70;display:flex;align-items:center;gap:.6em;background:#0A192F;color:#fff;font-weight:700;padding:.6em 1em;border-radius:.7em;border:2px solid var(--a1);box-shadow:0 14px 40px rgba(0,0,0,.4)}
.toast svg{width:1.3em;height:1.3em;stroke:var(--a1)}
.step{position:absolute;z-index:100;font-weight:800;color:#fff;background:rgba(6,17,31,.86);border-radius:999px;padding:.3em .8em;border:1.5px solid color-mix(in srgb,var(--a1) 55%,transparent)}
`;

export async function renderTutorial(browser, manifest, dir, out) {
  const m = manifest;
  const L = layoutFor(m);
  const [a1, a2] = ACCENTS[m.sector] ?? ACCENTS.brand;
  const toStage = (b) => b && { x: L.ox + b.x * L.S, y: L.oy + b.y * L.S, w: b.w * L.S, h: b.h * L.S };

  // --------------------------------------------------------- voix et durées
  const introSay = m.intro;
  const outroSay = m.outro || 'À vous de jouer ! Besoin d’aide ? Écrivez-nous sur WhatsApp.';
  const clips = [await voiceClip(introSay, TTS_DIR)];
  for (const st of m.steps) clips.push(st.say ? await voiceClip(st.say, TTS_DIR) : null);
  clips.push(await voiceClip(outroSay, TTS_DIR));

  const durs = [Math.max(3.4, LEAD + clips[0].dur + 0.7)];
  const slots = [];
  m.steps.forEach((st, i) => {
    const mins = st.actions.map(actionMin);
    const sum = mins.reduce((a, b) => a + b, 0) || 0.5;
    const voice = clips[i + 1]?.dur ?? 0;
    const D = Math.max(LEAD + voice + 0.55, sum + 0.35);
    const k = (D - 0.3) / sum;
    slots.push(mins.map((x) => x * k));
    durs.push(D);
  });
  durs.push(Math.max(4.2, LEAD + clips[clips.length - 1].dur + 0.9));
  const starts = [];
  let total = 0;
  for (const d of durs) {
    starts.push(total);
    total += d;
  }
  const K = new Keyframes(total);
  const introEnd = durs[0];
  const outroStart = starts[starts.length - 1];

  // --------------------------------------------------------- timeline
  const shots = []; // { file, t }
  const pushShot = (file, t) => {
    if (!file) return;
    const last = shots[shots.length - 1];
    if (last && last.file === file) return;
    shots.push({ file, t: Math.max(0, t) });
  };
  const camFrames = [{ t: 0, css: camCss({ tx: 0, ty: 0, z: 1 }) }];
  let cam = { tx: 0, ty: 0, z: 1 };
  const cursorFrames = [];
  const cursorVis = [];
  const pressFrames = [];
  let cur = { x: L.W * 0.62, y: L.H * 0.58 };
  const overlays = [];
  const firstShot = m.steps.flatMap((s) => s.actions).find((a) => a.shots?.length)?.shots[0];
  pushShot(firstShot, 0);

  const pointOf = (a, b) =>
    a.type === 'fill' ? { x: b.x + Math.min(48, b.w / 2), y: b.y + b.h / 2 } : { x: b.x + b.w / 2, y: b.y + b.h / 2 };

  m.steps.forEach((st, si) => {
    const s0 = starts[si + 1];
    const region = st.focus ? toStage(st.focus) : union(st.actions.map((a) => toStage(a.target)));
    const onlyNav = st.actions.every((a) => ['goto', 'scroll', 'pages', 'card'].includes(a.type));
    const next = cameraFor(L, onlyNav && !st.focus ? null : region, st.zoom);
    camFrames.push({ t: s0, css: camCss(cam), ease: EASE }, { t: s0 + 0.9, css: camCss(next) });
    cam = next;

    let t = s0 + 0.15;
    st.actions.forEach((a, ai) => {
      const slot = slots[si][ai];
      const end = t + slot;
      const tb = toStage(a.target);
      if (a.type === 'goto' || a.type === 'scroll') {
        pushShot(a.shots[0], t);
      } else if (a.type === 'pages') {
        overlays.push(pagesViewer(K, L, dir, a, t, end));
      } else if (a.type === 'card') {
        overlays.push(infoCard(K, L, a.card, t, end));
      } else if (tb) {
        pushShot(a.shots[0], t);
        const p = pointOf(a, tb);
        const tClick = t + 0.72;
        if (a.type !== 'highlight') {
          if (L.mobile) {
            overlays.push(`<div class="tap" style="left:${p.x}px;top:${p.y}px;${K.anim([
              { t: 0, css: { opacity: 0, transform: 'scale(.6)' } },
              { t: tClick - 0.25, css: { opacity: 0, transform: 'scale(.6)' }, ease: EASE },
              { t: tClick, css: { opacity: 1, transform: 'scale(1)' }, ease: EASE },
              { t: tClick + 0.35, css: { opacity: 0, transform: 'scale(1.25)' } },
            ])}"></div>`);
          } else {
            cursorFrames.push(
              { t, css: { transform: `translate(${cur.x.toFixed(1)}px,${cur.y.toFixed(1)}px)` }, ease: EASE },
              { t: t + 0.62, css: { transform: `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px)` } }
            );
            pressFrames.push(
              { t: tClick - 0.06, css: { transform: 'scale(1)' }, ease: EASE },
              { t: tClick + 0.04, css: { transform: 'scale(.82)' }, ease: EASE },
              { t: tClick + 0.2, css: { transform: 'scale(1)' } }
            );
            cursorVis.push([t, end]);
            cur = p;
          }
          overlays.push(`<div class="ripple" style="left:${p.x}px;top:${p.y}px;${K.anim([
            { t: 0, css: { opacity: 0, transform: 'scale(.2)' } },
            { t: tClick, css: { opacity: 0.9, transform: 'scale(.2)' }, ease: 'ease-out' },
            { t: tClick + 0.5, css: { opacity: 0, transform: 'scale(1.5)' } },
          ])}"></div>`);
        }
        const ringPad = 8;
        const spot = a.type === 'highlight';
        const ringA = t + (spot ? 0.3 : 0.35);
        const ringB = spot ? end - 0.25 : tClick + 0.45;
        overlays.push(
          `<div class="ring${spot ? ' spot' : ''}" style="left:${tb.x - ringPad}px;top:${tb.y - ringPad}px;width:${tb.w + ringPad * 2}px;height:${tb.h + ringPad * 2}px;${K.show(ringA, ringB)}"></div>`
        );
        if (a.callout) overlays.push(callout(K, L, tb, a.callout, t + 0.5, end - 0.15, cam));

        if (a.type === 'click' || a.type === 'check') {
          a.shots.slice(1).forEach((f) => pushShot(f, tClick + 0.18));
        } else if (a.type === 'fill') {
          const typed = a.shots.slice(1);
          const span = Math.max(0.4, slot - 1.05);
          typed.forEach((f, k) => pushShot(f, tClick + 0.15 + (span * (k + 1)) / (typed.length + 0.2) - span / (typed.length + 0.2)));
        } else if (a.type === 'select') {
          const mOpen = tClick + 0.1;
          const mSel = mOpen + 0.6;
          const mClose = mOpen + 1.15;
          overlays.push(menu(K, L, tb, a, mOpen, mSel, mClose));
          a.shots.slice(1).forEach((f) => pushShot(f, mClose));
        } else if (a.type === 'download') {
          a.shots.slice(1).forEach((f) => pushShot(f, tClick + 0.2));
          overlays.push(toast(K, L, a.download, tClick + 0.3, Math.min(end, tClick + 1.9)));
        }
      }
      t = end;
    });
  });
  camFrames.push({ t: outroStart, css: camCss(cam) });

  // --------------------------------------------------------- HTML
  const screenW = L.vw * L.S;
  const screenH = L.vh * L.S;
  const shotImgs = shots
    .map((s, i) => {
      const nextT = shots[i + 1]?.t;
      const vis = i === 0 ? { a: -1, b: nextT ?? total } : { a: s.t, b: nextT ?? total };
      const style =
        i === 0
          ? K.anim([
              { t: 0, css: { opacity: 1 } },
              { t: (nextT ?? total) + FADE, css: { opacity: 1 } },
              { t: (nextT ?? total) + FADE + 0.01, css: { opacity: nextT ? 0 : 1 } },
            ])
          : K.show(vis.a, vis.b + FADE, FADE);
      return `<img src="${url(path.join(dir, 'shots', s.file))}" style="z-index:${i + 1};${style}">`;
    })
    .join('');

  const cursorHtml =
    !L.mobile && cursorFrames.length
      ? `<div class="cursor" style="${K.anim(cursorFrames)}"><i style="${K.anim(pressFrames)}">${CURSOR_SVG}</i></div>`
      : '';
  const cursorWrap = cursorHtml
    ? `<div style="position:absolute;inset:0;z-index:60;${K.anim([
        { t: 0, css: { opacity: 0 } },
        { t: introEnd, css: { opacity: 0 } },
        { t: introEnd + 0.3, css: { opacity: 1 } },
        { t: outroStart - 0.1, css: { opacity: 1 } },
        { t: outroStart + 0.2, css: { opacity: 0 } },
      ])}">${cursorHtml}</div>`
    : '';

  const device = L.mobile
    ? `${glows()}<div class="abs" style="left:${L.ox - 20}px;top:${L.oy - 20}px;width:${screenW + 40}px;height:${screenH + 40}px;border-radius:78px;background:#0B1220;box-shadow:0 40px 120px -20px rgba(0,0,0,.7),0 0 0 3px #1F2A44"></div>`
    : '';
  const screen = `<div class="screen" style="left:${L.ox}px;top:${L.oy}px;width:${screenW}px;height:${screenH}px;${L.mobile ? 'border-radius:58px' : ''}">${shotImgs}</div>`;
  const stage = `<div class="stage" style="width:${L.W}px;height:${L.H}px;${K.anim(camFrames)}">${device}${screen}${overlays.join('')}${cursorWrap}</div>`;

  const captionMax = L.mobile ? 30 : 60;
  const captions = [null, ...m.steps.map((s) => s.caption), null];
  const cues = captionTimeline(captions, starts, clips, captionMax, LEAD);
  const caps = cues
    .map(
      (c) =>
        `<div class="cap" style="${L.mobile ? 'bottom:70px;padding:0 60px;font-size:42px' : 'bottom:40px;padding:0 220px;font-size:36px'};${K.show(c.start, c.end, 0.12)}"><span>${esc(c.text)}</span></div>`
    )
    .join('');

  const stepChips = m.steps
    .map(
      (_, i) =>
        `<div class="step" style="${L.mobile ? 'left:60px;top:170px;font-size:30px' : 'right:34px;bottom:44px;font-size:24px'};${K.show(starts[i + 1], starts[i + 1] + durs[i + 1] - FADE, 0.2)}">Étape ${i + 1}/${m.steps.length}</div>`
    )
    .join('');
  const mobileHead = L.mobile
    ? `<div class="abs" style="left:0;right:0;top:0;padding:60px 60px 50px;display:flex;align-items:center;justify-content:space-between;z-index:99;background:linear-gradient(180deg,#0A192F 62%,rgba(10,25,47,0));${K.show(introEnd - 0.45, outroStart)}">${logo(46)}<span class="chip" style="font-size:26px">Tutoriel · ${esc(SECTOR_LABELS[m.sector] ?? 'KonaData')}</span></div>`
    : '';
  const bar = `<div class="bar" style="${K.anim([
    { t: 0, css: { transform: 'scaleX(0)' } },
    { t: introEnd, css: { transform: 'scaleX(0)' } },
    { t: outroStart, css: { transform: 'scaleX(1)' } },
  ])}"></div>`;

  const intro = introCard(K, L, m, introEnd);
  const outro = outroCard(K, L, m, outroStart);

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>${CSS}${TUTO_CSS}
:root{--a1:${a1};--a2:${a2}}
${K.rules.join('\n')}</style></head><body>
<div class="cv" style="width:${L.W}px;height:${L.H}px;background:#0A192F">${stage}${mobileHead}${stepChips}${caps}${bar}${intro}${outro}</div></body></html>`;

  const audio = await buildAudio(path.join(dir, 'audio'), clips, durs, { lead: LEAD, musicVolume: 0.05 });
  await renderHtmlVideo(browser, { html, htmlFile: path.join(dir, 'video.html'), W: L.W, H: L.H, total, audio, out });
  await writeFile(out.replace(/\.mp4$/, '.srt'), toSrt(cues), 'utf8');
  return { total };
}

// --------------------------------------------------------- éléments
function callout(K, L, tb, text, a, b) {
  const fs = L.mobile ? 34 : 26;
  const above = tb.y > (L.mobile ? 520 : 160);
  const top = above ? tb.y - fs * 2.6 : tb.y + tb.h + 18;
  const left = Math.max(20, Math.min(tb.x, L.W - text.length * fs * 0.6 - 60));
  return `<div class="callout" style="left:${left}px;top:${top}px;font-size:${fs}px;${K.show(a, b)}">${esc(text)}</div>`;
}

function menu(K, L, tb, a, open, sel, close) {
  const fs = Math.round((L.mobile ? 15 : 14) * L.S);
  const opts = a.options ?? [];
  const si = Math.max(0, opts.indexOf(a.selected));
  const from = Math.max(0, Math.min(si - 3, opts.length - 8));
  const shown = opts.slice(from, from + 8);
  const w = Math.max(tb.w, 260 * L.S);
  const rowH = fs * 1.95;
  const h = shown.length * rowH + 16;
  const top = tb.y + tb.h + 6 + h > L.oy + L.vh * L.S ? tb.y - h - 6 : tb.y + tb.h + 6;
  const rows = shown
    .map((o, k) => {
      const isSel = from + k === si;
      return `<div style="${isSel ? K.anim([
        { t: 0, css: { background: 'transparent', color: '#0F172A' } },
        { t: sel, css: { background: 'transparent', color: '#0F172A' } },
        { t: sel + 0.08, css: { background: '#2563EB', color: '#fff' } },
      ]) : ''}">${esc(o || '—')}</div>`;
    })
    .join('');
  return `<div class="menu" style="left:${tb.x}px;top:${top}px;width:${w}px;font-size:${fs}px;${K.anim([
    { t: 0, css: { opacity: 0, transform: 'translateY(-8px)' } },
    { t: open, css: { opacity: 0, transform: 'translateY(-8px)' }, ease: EASE },
    { t: open + 0.18, css: { opacity: 1, transform: 'none' } },
    { t: close, css: { opacity: 1, transform: 'none' } },
    { t: close + 0.12, css: { opacity: 0, transform: 'none' } },
  ])}">${rows}</div>`;
}

function toast(K, L, name, a, b) {
  const fs = L.mobile ? 34 : 28;
  const pos = L.mobile ? `left:60px;right:60px;top:${L.H - 330}px` : `right:40px;top:120px`;
  return `<div class="toast" style="${pos};font-size:${fs}px;${K.show(a, b)}"><svg viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg><span>Téléchargé : ${esc(name)}</span></div>`;
}

function pagesViewer(K, L, dir, a, t0, t1) {
  const n = a.files.length;
  const per = (t1 - t0 - 0.5) / n;
  const mainH = L.mobile ? 1250 : 930;
  const mainW = mainH / Math.SQRT2;
  const mainX = L.mobile ? (L.W - mainW) / 2 : 250;
  const mainY = L.mobile ? 330 : (L.H - mainH) / 2 - 10;
  const imgs = a.files
    .map((f, k) => {
      const a0 = t0 + 0.3 + k * per;
      const a1 = a0 + per;
      const last = k === n - 1;
      return `<img src="${url(path.join(dir, a.dir, f))}" style="left:${mainX}px;top:${mainY}px;width:${mainW}px;height:${mainH}px;object-fit:contain;${K.anim([
        { t: 0, css: { opacity: 0, transform: 'translateX(120px)' } },
        { t: a0 - 0.05, css: { opacity: 0, transform: 'translateX(120px)' }, ease: EASE },
        { t: a0 + 0.4, css: { opacity: 1, transform: 'none' } },
        { t: last ? t1 : a1, css: { opacity: 1, transform: 'none' }, ease: EASE },
        { t: (last ? t1 : a1) + 0.4, css: { opacity: 0, transform: last ? 'none' : 'translateX(-120px)' } },
      ])}">`;
    })
    .join('');
  let side = '';
  if (!L.mobile) {
    const thumbs = a.files
      .map((f, k) => {
        const a0 = t0 + 0.3 + k * per;
        return `<div style="position:relative;width:150px;height:212px;border-radius:6px;overflow:hidden;background:#fff;box-shadow:0 8px 24px rgba(0,0,0,.4)"><img src="${url(path.join(dir, a.dir, f))}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;box-shadow:none"><div style="position:absolute;inset:0;border:5px solid var(--a1);border-radius:6px;${K.show(a0, a0 + per - 0.1, 0.15)}"></div></div>`;
      })
      .join('');
    side = `<div class="abs col" style="left:${mainX + mainW + 90}px;top:${mainY + 20}px;right:120px;gap:30px">
      <span class="chip" style="font-size:24px;align-self:flex-start">${icon('check')}${esc(a.title || 'Document PDF')}</span>
      <p style="font-size:34px;font-weight:800;line-height:1.2">${a.total} page${a.total > 1 ? 's' : ''} générée${a.total > 1 ? 's' : ''} automatiquement</p>
      <div style="display:flex;flex-wrap:wrap;gap:22px">${thumbs}</div></div>`;
  }
  return `<div class="viewer" style="${K.show(t0, t1 - 0.2, 0.3)}">${imgs}${side}</div>`;
}

function infoCard(K, L, card, a, b) {
  const fs = L.mobile ? 44 : 40;
  const items = (card.items ?? []).map((it) => `<li style="display:flex;gap:.6em;align-items:flex-start">${icon('check')}<span>${esc(it)}</span></li>`).join('');
  return `<div class="card" style="z-index:85;${K.show(a, b - 0.2, 0.3)}">${glows()}
    <div class="abs col" style="left:${L.mobile ? 80 : 180}px;right:${L.mobile ? 80 : 180}px;top:0;bottom:0;justify-content:center;gap:40px;font-size:${fs}px">
      <span class="chip" style="font-size:${fs * 0.62}px;align-self:flex-start">${esc(card.kicker ?? 'À savoir')}</span>
      <h1 style="font-size:${fs * 1.9}px">${esc(card.title)}</h1>
      <ul class="col" style="gap:.55em;list-style:none;font-weight:600;color:#E2E8F0">${items}</ul>
    </div></div>`;
}

function introCard(K, L, m, end) {
  const V = L.mobile;
  return `<div class="card" style="${K.anim([
    { t: 0, css: { opacity: 1 } },
    { t: end - 0.45, css: { opacity: 1 }, ease: EASE },
    { t: end, css: { opacity: 0 } },
  ])}">${glows()}
    <div class="abs" style="left:${V ? 80 : 120}px;top:${V ? 90 : 80}px">${logo(V ? 60 : 52)}</div>
    <div class="abs col" style="left:${V ? 80 : 120}px;right:${V ? 80 : 120}px;top:0;bottom:0;justify-content:center;gap:${V ? 44 : 36}px;font-size:${V ? 40 : 34}px">
      <span class="chip" style="font-size:${V ? 30 : 26}px;align-self:flex-start">${ICON_PATHS[m.sector] ? icon(m.sector) : ''}Tutoriel · ${esc(SECTOR_LABELS[m.sector] ?? 'KonaData')}</span>
      <h1 style="font-size:${V ? 104 : 96}px">${esc(m.title)}</h1>
      <p style="font-size:${V ? 40 : 36}px;color:#CBD5E1;font-weight:600">${m.steps.length} étapes · ${esc(m.role ?? '')}</p>
    </div></div>`;
}

function outroCard(K, L, m, start) {
  const V = L.mobile;
  return `<div class="card" style="${K.anim([
    { t: 0, css: { opacity: 0 } },
    { t: start, css: { opacity: 0 }, ease: EASE },
    { t: start + 0.45, css: { opacity: 1 } },
  ])}">${glows()}
    <div class="abs col" style="inset:0;align-items:center;justify-content:center;gap:${V ? 50 : 40}px;text-align:center;font-size:${V ? 40 : 34}px">
      <div style="width:${V ? 150 : 120}px;height:${V ? 150 : 120}px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--a1),var(--a2));box-shadow:0 20px 60px -10px var(--a1)"><svg viewBox="0 0 24 24" width="55%" height="55%" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></div>
      <h1 style="font-size:${V ? 92 : 84}px">C’est à vous !</h1>
      <p style="font-size:${V ? 40 : 36}px;color:#CBD5E1;font-weight:600;max-width:${V ? 900 : 1300}px">${esc(m.title)}</p>
      <div class="foot" style="font-size:${V ? 38 : 32}px;color:#E2E8F0;display:flex;flex-direction:${V ? 'column' : 'row'};gap:${V ? 18 : 50}px;align-items:center">
        <span style="display:inline-flex;gap:.5em;align-items:center">${icon('phone')}Aide WhatsApp ${CONTACT.whatsapp}</span>
        <span style="display:inline-flex;gap:.5em;align-items:center"><em>${CONTACT.site}</em></span>
      </div>
      <div style="margin-top:10px">${logo(V ? 60 : 52)}</div>
    </div></div>`;
}

export async function imageSize(file) {
  const meta = await sharp(file).metadata();
  return { w: meta.width, h: meta.height };
}
