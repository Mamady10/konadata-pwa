#!/usr/bin/env node
/**
 * Vidéos de campagne KonaData : scènes HTML animées capturées image par image,
 * voix off Edge TTS, ambiance musicale et sous-titres incrustés.
 *
 * Sorties : docs/marketing/campagne/videos/<id>-9x16.mp4 | -16x9.mp4 | .srt
 *
 * Usage : node scripts/marketing/build-campaign-videos.mjs [--only=konadata-btp] [--format=9x16]
 * Variables : CAMPAIGN_TTS_VOICE (défaut fr-FR-DeniseNeural), CAMPAIGN_MUSIC_VOLUME (défaut 0.10)
 * Musique : placez un fichier libre de droits dans docs/marketing/campagne/musique.mp3
 *           (sinon une nappe discrète est générée).
 */
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import { buildAudio, captionTimeline, renderHtmlVideo, toSrt, voiceClip } from './video-kit.mjs';
import { ACCENTS, CONTACT, SECTOR_LABELS } from './campaign-content.mjs';
import { VIDEOS } from './campaign-videos.mjs';
import {
  CAMPAIGN,
  CSS,
  WORK,
  capture,
  esc,
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
} from './campaign-html.mjs';

const OUT = path.join(CAMPAIGN, 'videos');
const VWORK = path.join(WORK, 'video');

export const XF = 0.4; // fondu enchaîné entre scènes (s)
const LEAD = 0.25; // silence avant la voix dans chaque scène (s)

export const VFORMATS = {
  '9x16': { W: 1080, H: 1920, V: true },
  '16x9': { W: 1920, H: 1080, V: false },
};

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const ONLY = arg('only')?.split(',');
const ONLY_FORMAT = arg('format');

// ---------------------------------------------------------------- scènes
const EASE = 'cubic-bezier(.2,.8,.2,1)';
export const A = (name, delay, dur, ease = EASE, fill = 'both') => `${name} ${dur}s ${ease} ${Math.max(0, delay).toFixed(3)}s ${fill}`;

const VIDEO_CSS = `
@keyframes fade{from{opacity:0}to{opacity:1}}
@keyframes hide{from{opacity:1}to{opacity:0}}
@keyframes up{from{opacity:0;transform:translateY(70px)}to{opacity:1;transform:none}}
@keyframes rise{from{opacity:0;transform:translateY(300px)}to{opacity:1;transform:none}}
@keyframes slideL{from{opacity:0;transform:translateX(260px)}to{opacity:1;transform:none}}
@keyframes pop{0%{opacity:0;transform:scale(.55)}65%{opacity:1;transform:scale(1.06)}100%{opacity:1;transform:scale(1)}}
@keyframes kb{from{transform:scale(1.02)}to{transform:scale(1.14)}}
@keyframes zoom{from{transform:scale(1)}to{transform:scale(1.05)}}
.scene{position:absolute;inset:0;overflow:hidden;background:#0A192F}
.cap{position:absolute;left:0;right:0;display:flex;justify-content:center;z-index:100}
.cap span{background:rgba(6,17,31,.82);color:#fff;font-weight:700;text-align:center;line-height:1.3;padding:.32em .75em;border-radius:.45em;box-shadow:0 8px 30px rgba(0,0,0,.35)}
.tile{border-radius:28px;display:flex;flex-direction:column;justify-content:space-between;padding:1em;font-weight:800;color:#fff}
.tile svg{width:1.6em;height:1.6em}
.qrbox{background:#fff;border-radius:24px;padding:18px;display:flex;flex-direction:column;align-items:center;gap:8px;color:#0A192F;font-weight:800}
`;

function sceneHook(sc, s, d, f) {
  const V = f.V;
  return `
    <div class="abs" style="inset:0;overflow:hidden"><img class="abs" src="${sc.photoUrl ?? photo(sc.photo)}" style="inset:0;width:100%;height:100%;object-fit:cover;object-position:${sc.pos?.[V ? 0 : 1] ?? (V ? '62% 30%' : '72% 35%')};animation:${A('kb', s - XF, d + XF, 'linear')}"></div>
    <div class="abs" style="inset:0;background:${
      V
        ? 'linear-gradient(180deg,rgba(10,25,47,.45) 0%,rgba(10,25,47,0) 22%,rgba(10,25,47,.15) 42%,rgba(10,25,47,.94) 66%,#0A192F 100%)'
        : 'linear-gradient(90deg,rgba(10,25,47,.96) 0%,rgba(10,25,47,.86) 36%,rgba(10,25,47,.15) 64%,rgba(10,25,47,0) 100%)'
    }"></div>
    <div class="abs col" style="${V ? 'left:80px;right:80px;top:1060px' : 'left:110px;width:860px;top:0;bottom:120px;justify-content:center'};gap:34px;font-size:${V ? 40 : 34}px">
      <div style="animation:${A('up', s + 0.15, 0.7)}">${kickerHtml(sc.kicker)}</div>
      <h1 style="font-size:${V ? 104 : 88}px;animation:${A('up', s + 0.3, 0.8)}">${rich(sc.title)}</h1>
    </div>`;
}

export const kickerHtml = (t) => `<div class="kicker"><i></i>${esc(t)}</div>`;

function sceneLogo(sc, s, d, f) {
  const V = f.V;
  return `${glows()}
    <div class="abs col" style="inset:0;align-items:center;justify-content:center;gap:${V ? 46 : 34}px;padding-bottom:${V ? 200 : 80}px">
      <img src="${url(path.join(WORK, 'icon.png'))}" style="width:${V ? 300 : 230}px;height:${V ? 300 : 230}px;border-radius:${V ? 66 : 50}px;box-shadow:0 30px 90px -20px rgba(34,211,238,.55);animation:${A('pop', s + 0.1, 0.8)}">
      <div style="animation:${A('up', s + 0.5, 0.8)}">${logoText(V ? 150 : 128)}</div>
      <p style="font-size:${V ? 46 : 40}px;color:#CBD5E1;font-weight:600;animation:${A('up', s + 0.85, 0.8)}">${esc(CONTACT.slogan)}</p>
      <div class="chips" style="font-size:${V ? 40 : 32}px;justify-content:center;animation:${A('up', s + 1.15, 0.8)}">${['Écoles', 'ONG', 'BTP', 'PME'].map((c) => `<span>${c}</span>`).join('')}</div>
    </div>`;
}

const logoText = (size) =>
  `<span style="font-size:${size}px;font-weight:800;letter-spacing:-.03em;line-height:1"><b style="color:#fff">Kona</b><b style="color:#38BDF8">Data</b></span>`;

function sceneSectors(sc, s, d, f) {
  const V = f.V;
  const tiles = ['ecole', 'ong', 'btp', 'pme']
    .map((k, i) => {
      const [a1, a2] = ACCENTS[k];
      return `<div class="tile" style="background:linear-gradient(135deg,${a1},${a2});height:${V ? 330 : 380}px;animation:${A('pop', s + 0.35 + i * 0.2, 0.7)}">${icon(k)}<span>${esc(SECTOR_LABELS[k])}</span></div>`;
    })
    .join('');
  return `${glows()}
    <div class="abs col" style="${V ? 'left:80px;right:80px;top:300px' : 'left:120px;right:120px;top:170px'};gap:${V ? 70 : 60}px">
      <h1 style="font-size:${V ? 104 : 88}px;animation:${A('up', s + 0.1, 0.8)}">${rich(sc.title)}</h1>
      <div style="display:grid;grid-template-columns:${V ? '1fr 1fr' : 'repeat(4,1fr)'};gap:28px;font-size:${V ? 46 : 38}px">${tiles}</div>
    </div>`;
}

export function bulletsAnim(items, s, off, step) {
  return `<ul class="bul">${items
    .map((b, i) => `<li style="animation:${A('up', s + off + i * step, 0.6)}">${icon('check')}<span>${esc(b)}</span></li>`)
    .join('')}</ul>`;
}

function sceneDevice(sc, s, d, f) {
  const V = f.V;
  if (V) {
    return `${glows()}
      <div class="abs col" style="left:80px;right:80px;top:150px;gap:30px;font-size:40px">
        <div style="animation:${A('up', s + 0.1, 0.7)}">${kickerHtml(sc.kicker)}</div>
        <h1 style="font-size:92px;animation:${A('up', s + 0.25, 0.8)}">${rich(sc.title)}</h1>
      </div>
      <div class="abs" style="inset:0;animation:${A('zoom', s, d, 'linear')}">
        <div class="abs" style="left:60px;top:590px;animation:${A('rise', s + 0.35, 0.9)}">${laptop(capture(sc.desktop), 960)}</div>
        <div class="abs" style="right:44px;top:720px;animation:${A('slideL', s + 0.8, 0.9)}">${phone(capture(sc.mobile), 270)}</div>
      </div>
      <div class="abs" style="left:80px;right:80px;top:1320px;font-size:46px">${bulletsAnim(sc.bullets, s, 1.3, 0.4)}</div>`;
  }
  return `${glows()}
    <div class="abs col" style="left:110px;top:0;bottom:130px;width:720px;justify-content:center;gap:34px;font-size:36px">
      <div style="animation:${A('up', s + 0.1, 0.7)}">${kickerHtml(sc.kicker)}</div>
      <h1 style="font-size:76px;animation:${A('up', s + 0.25, 0.8)}">${rich(sc.title)}</h1>
      ${bulletsAnim(sc.bullets, s, 1.2, 0.4)}
    </div>
    <div class="abs" style="inset:0;animation:${A('zoom', s, d, 'linear')}">
      <div class="abs" style="left:860px;top:190px;animation:${A('rise', s + 0.35, 0.9)}">${laptop(capture(sc.desktop), 960)}</div>
      <div class="abs" style="left:1640px;top:390px;animation:${A('slideL', s + 0.8, 0.9)}">${phone(capture(sc.mobile), 220)}</div>
    </div>`;
}

function sceneMobile(sc, s, d, f) {
  const V = f.V;
  if (V) {
    return `${glows()}
      <div class="abs col" style="left:80px;right:80px;top:150px;gap:30px;font-size:40px">
        <div style="animation:${A('up', s + 0.1, 0.7)}">${kickerHtml(sc.kicker)}</div>
        <h1 style="font-size:96px;animation:${A('up', s + 0.25, 0.8)}">${rich(sc.title)}</h1>
      </div>
      <div class="abs" style="left:300px;top:600px;animation:${A('rise', s + 0.3, 1)}"><div style="animation:${A('zoom', s, d, 'linear')}">${phone(capture(sc.mobile), 480)}</div></div>`;
  }
  return `${glows()}
    <div class="abs col" style="left:110px;top:0;bottom:130px;width:900px;justify-content:center;gap:34px;font-size:36px">
      <div style="animation:${A('up', s + 0.1, 0.7)}">${kickerHtml(sc.kicker)}</div>
      <h1 style="font-size:92px;animation:${A('up', s + 0.25, 0.8)}">${rich(sc.title)}</h1>
    </div>
    <div class="abs" style="left:1230px;top:80px;animation:${A('rise', s + 0.3, 1)}"><div style="animation:${A('zoom', s, d, 'linear')}">${phone(capture(sc.mobile), 400)}</div></div>`;
}

function scenePhones(sc, s, d, f) {
  const V = f.V;
  const [m1, m2, m3] = sc.phones.map(capture);
  const ph = (img, w, pos, rot, delay, z = 1) =>
    `<div class="abs" style="${pos};z-index:${z};animation:${A('rise', s + delay, 0.9)}"><div style="transform:rotate(${rot}deg)">${phone(img, w)}</div></div>`;
  if (V) {
    return `${glows()}
      <div class="abs col" style="left:80px;right:80px;top:150px;gap:30px;font-size:40px">
        <div style="animation:${A('up', s + 0.1, 0.7)}">${kickerHtml(sc.kicker)}</div>
        <h1 style="font-size:96px;animation:${A('up', s + 0.25, 0.8)}">${rich(sc.title)}</h1>
      </div>
      ${ph(m1, 300, 'left:50px;top:720px', -7, 0.35)}
      ${ph(m3, 300, 'left:730px;top:720px', 7, 0.55)}
      ${ph(m2, 340, 'left:370px;top:640px', 0, 0.75, 2)}`;
  }
  return `${glows()}
    <div class="abs col" style="left:110px;top:0;bottom:130px;width:760px;justify-content:center;gap:34px;font-size:36px">
      <div style="animation:${A('up', s + 0.1, 0.7)}">${kickerHtml(sc.kicker)}</div>
      <h1 style="font-size:84px;animation:${A('up', s + 0.25, 0.8)}">${rich(sc.title)}</h1>
    </div>
    ${ph(m1, 300, 'left:930px;top:200px', -7, 0.35)}
    ${ph(m3, 300, 'left:1530px;top:200px', 7, 0.55)}
    ${ph(m2, 340, 'left:1210px;top:130px', 0, 0.75, 2)}`;
}

function sceneOffer(sc, s, d, f) {
  const V = f.V;
  const digits = (sc.big.match(/\d+/) || ['12'])[0];
  return `${glows()}
    <div class="abs" style="right:-3%;top:${V ? '14%' : '-8%'};font-weight:900;font-size:${V ? 900 : 1000}px;line-height:1;color:transparent;-webkit-text-stroke:4px rgba(52,211,153,.16);letter-spacing:-.06em;animation:${A('fade', s, 1.2)}">${digits}</div>
    <div class="abs col" style="${V ? 'left:80px;right:80px;top:560px' : 'left:120px;width:1300px;top:0;bottom:140px;justify-content:center'};gap:${V ? 44 : 36}px;font-size:${V ? 40 : 34}px">
      <div style="animation:${A('up', s + 0.1, 0.7)}">${kickerHtml('Offre de lancement')}</div>
      <h1 style="font-size:${V ? 150 : 138}px;line-height:1;transform-origin:left center;animation:${A('pop', s + 0.3, 0.8)}">${rich(sc.big)}</h1>
      <p style="font-size:${V ? 46 : 42}px;font-weight:700;color:#E2E8F0;animation:${A('up', s + 0.8, 0.7)}">${esc(sc.note)}</p>
      <p class="fine" style="font-size:${V ? 34 : 30}px;animation:${A('up', s + 1.1, 0.7)}">Activation unique, dans les 2 mois suivant l'inscription.</p>
    </div>`;
}

let QR = '';
function sceneCta(sc, s, d, f) {
  const V = f.V;
  const texts = `
    <div style="animation:${A('pop', s + 0.1, 0.8)}">${logo(V ? 84 : 76)}</div>
    <div style="font-size:${V ? 50 : 42}px;animation:${A('up', s + 0.4, 0.7)}"><div class="cta">Essai gratuit${icon('arrow')}</div></div>
    <div style="font-size:${V ? 88 : 84}px;font-weight:900;letter-spacing:-.03em;animation:${A('up', s + 0.6, 0.7)}"><em>${CONTACT.site}</em></div>
    <div class="foot" style="font-size:${V ? 44 : 38}px;color:#CBD5E1;animation:${A('up', s + 0.8, 0.7)}"><span>${icon('phone')}WhatsApp ${CONTACT.whatsapp}</span></div>`;
  const qr = `<div class="qrbox" style="font-size:${V ? 30 : 26}px;animation:${A('pop', s + 1.0, 0.7)}"><div style="width:${V ? 300 : 260}px;height:${V ? 300 : 260}px">${QR}</div>Scannez-moi</div>`;
  if (V) {
    return `${glows()}<div class="abs col" style="inset:0;align-items:center;justify-content:center;gap:48px;padding-bottom:160px;text-align:center">${texts}${qr}</div>`;
  }
  return `${glows()}<div class="abs" style="inset:0;display:flex;align-items:center;justify-content:center;gap:120px;padding-bottom:60px">
    <div class="col" style="gap:40px">${texts}</div>${qr}</div>`;
}

/** Types de scène disponibles (extensibles par d'autres scripts vidéo). */
export const SCENES = {
  hook: sceneHook,
  logo: sceneLogo,
  sectors: sceneSectors,
  device: sceneDevice,
  mobile: sceneMobile,
  phones: scenePhones,
  offer: sceneOffer,
  cta: sceneCta,
};

function buildHtml(video, f, starts, durs, cues, extraCss = '') {
  const [a1, a2] = ACCENTS[video.accent];
  const n = video.scenes.length;
  const scenes = video.scenes
    .map((sc, i) => {
      const s = starts[i];
      const d = durs[i];
      const anims = [];
      if (i > 0) anims.push(A('fade', s - XF, XF, 'linear'));
      if (i < n - 1) anims.push(A('hide', s + d, 0.001, 'linear', 'forwards'));
      const mark =
        sc.type === 'logo' || sc.type === 'cta'
          ? ''
          : `<div class="abs" style="left:${f.V ? 80 : 110}px;top:${f.V ? 70 : 60}px;z-index:5">${logo(f.V ? 44 : 38)}</div>`;
      return `<div class="scene" style="z-index:${i + 1};${anims.length ? `animation:${anims.join(',')}` : ''}">${SCENES[sc.type](sc, s, d, f)}${mark}</div>`;
    })
    .join('\n');
  const caps = cues
    .map(
      (c) =>
        `<div class="cap" style="${f.V ? 'bottom:150px;padding:0 70px' : 'bottom:60px;padding:0 200px'};font-size:${f.V ? 44 : 40}px;animation:${A('fade', c.start, 0.12, 'linear')},${A('hide', c.end, 0.001, 'linear', 'forwards')}"><span>${esc(c.text)}</span></div>`
    )
    .join('\n');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>${CSS}${VIDEO_CSS}${extraCss}
:root{--a1:${a1};--a2:${a2}}
*{animation-play-state:paused!important}</style></head><body>
<div class="cv" style="width:${f.W}px;height:${f.H}px">${scenes}${caps}</div></body></html>`;
}

/** Rend une liste de vidéos (voix, musique, sous-titres) dans `outDir`, aux formats 9:16 et 16:9. */
export async function renderVideos(videos, { outDir = OUT, only = ONLY, onlyFormat = ONLY_FORMAT, css = '' } = {}) {
  await mkdir(outDir, { recursive: true });
  await mkdir(VWORK, { recursive: true });
  await prepareBrandAssets();
  QR = await qrSvg();
  const browser = await launchBrowser();

  for (const video of videos) {
    if (only && !only.includes(video.id)) continue;
    console.log(`\n🎬 ${video.id}`);
    const clips = [];
    for (const sc of video.scenes) clips.push(await voiceClip(sc.say, path.join(VWORK, 'tts')));
    const durs = video.scenes.map((sc, i) => Math.max(sc.type === 'cta' ? 5 : 2.8, LEAD + clips[i].dur + 0.7));
    const starts = [];
    let total = 0;
    for (const d of durs) {
      starts.push(total);
      total += d;
    }
    const audio = await buildAudio(path.join(VWORK, video.id), clips, durs, { lead: LEAD });

    for (const [fk, f] of Object.entries(VFORMATS)) {
      if (onlyFormat && onlyFormat !== fk) continue;
      const cues = captionTimeline(video.scenes.map((sc) => sc.caption), starts, clips, f.V ? 34 : 64, LEAD);
      const out = path.join(outDir, `${video.id}-${fk}.mp4`);
      await renderHtmlVideo(browser, {
        html: buildHtml(video, f, starts, durs, cues, css),
        htmlFile: path.join(VWORK, `${video.id}-${fk}.html`),
        W: f.W,
        H: f.H,
        total,
        audio,
        out,
      });
      await writeFile(out.replace(/\.mp4$/, '.srt'), toSrt(cues), 'utf8');
    }
  }

  await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]);
  console.log('\n✅ Vidéos :', outDir);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  renderVideos(VIDEOS).then(
    () => process.exit(0),
    (e) => {
      console.error('❌', e);
      process.exit(1);
    }
  );
}
