/**
 * Briques communes aux vidéos KonaData (campagne, tutoriels) :
 * voix off Edge TTS, nappe musicale, mixage, sous-titres et rendu image par image
 * d'une page HTML animée (animations CSS mises en pause puis positionnées à chaque image).
 */
import { spawn, spawnSync } from 'child_process';
import { once } from 'events';
import { createHash } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { EdgeTTS } from 'node-edge-tts';
import { CAMPAIGN, url } from './campaign-html.mjs';

export const FFMPEG = ffmpegInstaller.path;
export const FPS = 30;
export const VOICE = process.env.CAMPAIGN_TTS_VOICE || 'fr-FR-DeniseNeural';
const MUSIC_FILE = path.join(CAMPAIGN, 'musique.mp3');
const MUSIC_VOL = Number(process.env.CAMPAIGN_MUSIC_VOLUME || '0.10');

export function ff(args, label) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(`ffmpeg ${label}: ${r.stderr?.slice(-800)}`);
}

export function durationSec(file) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-i', file, '-f', 'null', '-'], { encoding: 'utf8' });
  const m = (r.stderr || '').match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

/** Synthèse vocale mise en cache (clé = voix + texte). */
export async function voiceClip(text, cacheDir) {
  const key = createHash('md5').update(`${VOICE}|${text}`).digest('hex').slice(0, 16);
  const mp3 = path.join(cacheDir, `${key}.mp3`);
  const wav = path.join(cacheDir, `${key}.wav`);
  if (!existsSync(wav)) {
    await mkdir(cacheDir, { recursive: true });
    const tts = new EdgeTTS({
      voice: VOICE,
      lang: 'fr-FR',
      outputFormat: 'audio-24khz-96kbitrate-mono-mp3',
      rate: '+2%',
      timeout: 120000,
    });
    await tts.ttsPromise(text, mp3);
    ff(
      [
        '-i', mp3,
        '-af', 'highpass=f=90,lowpass=f=10000,acompressor=threshold=-20dB:ratio=2.5:attack=15:release=120,alimiter=limit=0.95',
        '-ar', '44100', '-ac', '1', '-y', wav,
      ],
      'voix'
    );
  }
  return { wav, dur: durationSec(wav) ?? 3 };
}

function buildMusic(total, out, volume) {
  const fadeOut = Math.max(0, total - 3);
  if (existsSync(MUSIC_FILE)) {
    ff(
      [
        '-stream_loop', '-1', '-i', MUSIC_FILE, '-t', String(total),
        '-af', `afade=t=in:st=0:d=1.5,afade=t=out:st=${fadeOut}:d=3,volume=${volume * 2.2}`,
        '-ar', '44100', '-ac', '1', '-y', out,
      ],
      'musique'
    );
    return;
  }
  const notes = [130.81, 196.0, 261.63, 329.63, 392.0];
  const inputs = notes.flatMap((fq) => ['-f', 'lavfi', '-i', `sine=frequency=${fq}:duration=${total}`]);
  const mix = notes.map((_, i) => `[${i}:a]volume=${[0.5, 0.35, 0.3, 0.22, 0.16][i]},tremolo=f=${0.1 + i * 0.05}:d=0.35[n${i}]`);
  ff(
    [
      ...inputs,
      '-filter_complex',
      `${mix.join(';')};${notes.map((_, i) => `[n${i}]`).join('')}amix=inputs=${notes.length}:duration=longest,` +
        `aecho=0.7:0.5:900|1400:0.25|0.18,lowpass=f=2200,highpass=f=70,` +
        `afade=t=in:st=0:d=2,afade=t=out:st=${fadeOut}:d=3,volume=${volume * 4}`,
      '-t', String(total), '-ar', '44100', '-ac', '1', '-y', out,
    ],
    'nappe'
  );
}

/**
 * Piste audio : chaque segment dure `durs[i]` ; sa voix (optionnelle) démarre `lead` s après son début.
 * `musicVolume` : 0 pour aucune musique.
 */
export async function buildAudio(dir, clips, durs, { lead = 0.25, musicVolume = MUSIC_VOL } = {}) {
  await mkdir(dir, { recursive: true });
  const total = durs.reduce((a, b) => a + b, 0);
  const padded = [];
  for (const [i, c] of clips.entries()) {
    const out = path.join(dir, `voice-${i}.wav`);
    if (c) {
      ff(
        ['-i', c.wav, '-af', `adelay=${Math.round(lead * 1000)},apad,atrim=0:${durs[i].toFixed(3)}`, '-ar', '44100', '-ac', '1', '-y', out],
        'pad'
      );
    } else {
      ff(['-f', 'lavfi', '-i', `anullsrc=r=44100:cl=mono`, '-t', durs[i].toFixed(3), '-y', out], 'silence');
    }
    padded.push(out);
  }
  const list = path.join(dir, 'voices.txt');
  await writeFile(list, padded.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n'));
  const voice = path.join(dir, 'voice.wav');
  ff(['-f', 'concat', '-safe', '0', '-i', list, '-ar', '44100', '-ac', '1', '-y', voice], 'concat');
  const mixed = path.join(dir, 'audio.m4a');
  if (musicVolume > 0) {
    const music = path.join(dir, 'music.wav');
    buildMusic(total, music, musicVolume);
    ff(
      [
        '-i', voice, '-i', music,
        '-filter_complex', '[0:a][1:a]amix=inputs=2:duration=first:dropout_transition=0,volume=2,alimiter=limit=0.97[a]',
        '-map', '[a]', '-t', total.toFixed(3), '-c:a', 'aac', '-b:a', '160k', '-y', mixed,
      ],
      'mixage'
    );
  } else {
    ff(['-i', voice, '-t', total.toFixed(3), '-c:a', 'aac', '-b:a', '160k', '-y', mixed], 'audio');
  }
  return mixed;
}

// ---------------------------------------------------------------- sous-titres
export function splitCaption(text, maxLen) {
  const parts = text.split(/(?<=[,.:;?!])\s+/);
  const chunks = [];
  for (const part of parts) {
    const words = part.split(/\s+/);
    let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).trim().length > maxLen && cur) {
        chunks.push(cur.trim());
        cur = w;
      } else cur = `${cur} ${w}`;
    }
    if (cur.trim()) chunks.push(cur.trim());
  }
  const merged = [];
  for (const c of chunks) {
    const prev = merged[merged.length - 1];
    if (prev && (prev.length < 14 || c.length < 14) && prev.length + c.length + 1 <= maxLen + 8) {
      merged[merged.length - 1] = `${prev} ${c}`;
    } else merged.push(c);
  }
  return merged;
}

/** Sous-titres répartis proportionnellement à la durée de chaque voix. */
export function captionTimeline(captions, starts, clips, maxLen, lead = 0.25) {
  const cues = [];
  captions.forEach((caption, i) => {
    if (!caption || !clips[i]) return;
    const chunks = splitCaption(caption, maxLen);
    const total = chunks.reduce((n, c) => n + c.length, 0);
    let t = starts[i] + lead;
    for (const c of chunks) {
      const d = (clips[i].dur * c.length) / total;
      cues.push({ text: c, start: t, end: t + d });
      t += d;
    }
  });
  return cues;
}

function srtTime(sec) {
  const ms = Math.round(sec * 1000);
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
}

export function toSrt(cues) {
  return cues.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`).join('\n');
}

// ---------------------------------------------------------------- rendu
/**
 * Rend `html` (animations CSS en pause) image par image vers `out` (H.264 + audio).
 * `htmlFile` : chemin où écrire la page (les ressources sont référencées en file://).
 */
export async function renderHtmlVideo(browser, { html, htmlFile, W, H, total, audio, out }) {
  await writeFile(htmlFile, html, 'utf8');
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(url(htmlFile), { waitUntil: 'load' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images).map((i) => (i.decode ? i.decode().catch(() => {}) : null)));
    window.__anims = document.getAnimations();
    window.__anims.forEach((a) => a.pause());
    window.__seek = (t) => {
      for (const a of window.__anims) a.currentTime = t;
    };
  });

  const frames = Math.ceil(total * FPS);
  const enc = spawn(
    FFMPEG,
    [
      '-hide_banner', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-i', audio,
      '-map', '0:v', '-map', '1:a',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS),
      '-c:a', 'copy', '-shortest', '-movflags', '+faststart', '-y', out,
    ],
    { stdio: ['pipe', 'inherit', 'inherit'] }
  );
  const done = once(enc, 'close');
  const t0 = Date.now();
  for (let i = 0; i < frames; i++) {
    await page.evaluate((t) => window.__seek(t), (i / FPS) * 1000);
    const buf = await page.screenshot({ type: 'jpeg', quality: 90 });
    if (!enc.stdin.write(buf)) await once(enc.stdin, 'drain');
    if (i % (FPS * 5) === 0) process.stdout.write(`    ${Math.round((i / frames) * 100)} %\r`);
  }
  enc.stdin.end();
  const [code] = await done;
  await ctx.close();
  if (code !== 0) throw new Error(`encodage ${path.basename(out)} (code ${code})`);
  console.log(`  ✓ ${path.basename(out)} — ${total.toFixed(1)} s, rendu en ${Math.round((Date.now() - t0) / 1000)} s`);
}
