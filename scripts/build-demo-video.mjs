#!/usr/bin/env node
/**
 * Vidéo démo KonaData — captures + voix Edge TTS + musique de fond.
 *
 * Usage:
 *   npm run build:demo-video
 *   npm run build:demo-video:teaser
 *
 * Variables optionnelles:
 *   DEMO_TTS_VOICE=fr-FR-DeniseNeural
 *   DEMO_MUSIC_VOLUME=0.14   (volume musique, voix prioritaire)
 */
import { spawnSync } from 'child_process';
import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { EdgeTTS } from 'node-edge-tts';
import {
  CAPTURES_DIR,
  FULL_DEMO_SCENES,
  SCHOOL_FORMATION_SCENES,
  SCHOOL_TEASER_SCENES,
  TEASER_SCENES,
} from './demo-video-timeline.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dir, '..');
const FFMPEG = ffmpegInstaller.path;
const OUT_DIR = path.join(ROOT, 'docs', 'demo-video', 'output');
const WORK_DIR = path.join(OUT_DIR, '.work');

const TTS_VOICE = process.env.DEMO_TTS_VOICE || 'fr-FR-DeniseNeural';
const MUSIC_VOL = Number(process.env.DEMO_MUSIC_VOLUME || '0.24');
const MUSIC_ASSET = path.join(ROOT, 'docs', 'demo-video', 'assets', 'background-music.mp3');

const mode = process.argv.includes('--school-teaser')
  ? 'school-teaser'
  : process.argv.includes('--school')
    ? 'school'
    : process.argv.includes('--teaser')
      ? 'teaser'
      : 'full';

const SCENES =
  mode === 'school'
    ? SCHOOL_FORMATION_SCENES
    : mode === 'school-teaser'
      ? SCHOOL_TEASER_SCENES
      : mode === 'teaser'
        ? TEASER_SCENES
        : FULL_DEMO_SCENES;

const OUT_FILE =
  mode === 'school'
    ? path.join(OUT_DIR, 'konadata-formation-ecole.mp4')
    : mode === 'school-teaser'
      ? path.join(OUT_DIR, 'konadata-formation-ecole-teaser.mp4')
      : mode === 'teaser'
        ? path.join(OUT_DIR, 'konadata-demo-teaser-60s.mp4')
        : path.join(OUT_DIR, 'konadata-demo-complete.mp4');

const tts = new EdgeTTS({
  voice: TTS_VOICE,
  lang: 'fr-FR',
  outputFormat: 'audio-24khz-96kbitrate-mono-mp3',
  rate: '-6%',
  pitch: '+0Hz',
  timeout: 90000,
});

function runFfmpeg(args, label) {
  const r = spawnSync(FFMPEG, args, { encoding: 'utf8', maxBuffer: 80 * 1024 * 1024 });
  if (r.status !== 0) {
    console.error(`ffmpeg échec [${label}]:`, r.stderr?.slice(-1000));
    throw new Error(`ffmpeg: ${label}`);
  }
  return r;
}

function escapeDrawtext(s) {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/\n/g, ' ');
}

function probeDurationSec(filePath) {
  const r = spawnSync(FFMPEG, ['-i', filePath, '-f', 'null', '-'], { encoding: 'utf8' });
  const stderr = r.stderr || '';
  const m = stderr.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

async function synthVoiceMp3(text, outMp3) {
  await tts.ttsPromise(text, outMp3);
  if (!existsSync(outMp3)) throw new Error('Edge TTS sans fichier de sortie');
}

function cleanVoice(inMp3, outWav) {
  runFfmpeg(
    [
      '-i',
      inMp3,
      '-af',
      'highpass=f=100,lowpass=f=9000,afftdn=nf=-28,acompressor=threshold=-20dB:ratio=2.5:attack=15:release=120,alimiter=limit=0.92',
      '-ar',
      '44100',
      '-ac',
      '1',
      '-y',
      outWav,
    ],
    'clean-voice'
  );
}

function imageToClip(imagePath, durationSec, subtitle, clipPath) {
  const sub = escapeDrawtext(subtitle);
  const fadeOutStart = Math.max(0, durationSec - 0.45);
  // Image fixe (pas de zoom) + léger fondu pour transitions douces entre domaines
  const vf = [
    'scale=1920:1080:force_original_aspect_ratio=decrease',
    'pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0A192F',
    `drawtext=fontfile='C\\:/Windows/Fonts/segoeui.ttf':text='${sub}':fontcolor=white:fontsize=34:box=1:boxcolor=0x0A192F@0.8:boxborderw=12:x=(w-text_w)/2:y=h-110`,
    'fade=t=in:st=0:d=0.35',
    `fade=t=out:st=${fadeOutStart.toFixed(2)}:d=0.4`,
    'format=yuv420p',
  ].join(',');

  runFfmpeg(
    [
      '-loop',
      '1',
      '-i',
      imagePath,
      '-vf',
      vf,
      '-t',
      String(durationSec),
      '-c:v',
      'libx264',
      '-preset',
      'fast',
      '-crf',
      '23',
      '-r',
      '30',
      '-an',
      '-y',
      clipPath,
    ],
    `clip-${path.basename(clipPath)}`
  );
}

function padAudioToDuration(inWav, outWav, durationSec) {
  runFfmpeg(
    [
      '-i',
      inWav,
      '-af',
      'apad',
      '-t',
      String(durationSec),
      '-y',
      outWav,
    ],
    'pad-audio'
  );
}

function buildBackgroundMusic(durationSec, outWav) {
  if (existsSync(MUSIC_ASSET)) {
    const fadeOut = Math.max(0, durationSec - 8);
    runFfmpeg(
      [
        '-stream_loop',
        '-1',
        '-i',
        MUSIC_ASSET,
        '-t',
        String(durationSec),
        '-af',
        [
          `afade=t=in:st=0:d=4`,
          `afade=t=out:st=${fadeOut}:d=8`,
          'highpass=f=90',
          'lowpass=f=9000',
          `volume=${MUSIC_VOL}`,
        ].join(','),
        '-ar',
        '44100',
        '-ac',
        '1',
        '-c:a',
        'pcm_s16le',
        '-y',
        outWav,
      ],
      'bg-music-file'
    );
    return 'fichier assets/background-music.mp3';
  }

  const fadeOut = Math.max(0, durationSec - 8);
  runFfmpeg(
    [
      '-f',
      'lavfi',
      '-i',
      `sine=frequency=196:duration=${durationSec}`,
      '-f',
      'lavfi',
      '-i',
      `sine=frequency=247:duration=${durationSec}`,
      '-f',
      'lavfi',
      '-i',
      `sine=frequency=294:duration=${durationSec}`,
      '-f',
      'lavfi',
      '-i',
      `sine=frequency=370:duration=${durationSec}`,
      '-f',
      'lavfi',
      '-i',
      `sine=frequency=98:duration=${durationSec}`,
      '-filter_complex',
      [
        '[0:a]volume=0.45,tremolo=f=0.12:d=0.35[a0]',
        '[1:a]volume=0.38,tremolo=f=0.15:d=0.3[a1]',
        '[2:a]volume=0.32[a2]',
        '[3:a]volume=0.22[a3]',
        '[4:a]volume=0.18,lowpass=f=200[a4]',
        '[a0][a1][a2][a3][a4]amix=inputs=5:duration=longest',
        'aecho=0.7:0.55:1200|1800|2400|3200:0.25|0.2|0.15|0.1',
        `afade=t=in:st=0:d=5,afade=t=out:st=${fadeOut}:d=8`,
        'lowpass=f=2800,highpass=f=55',
        `volume=${MUSIC_VOL}`,
      ].join(','),
      '-t',
      String(durationSec),
      '-ar',
      '44100',
      '-ac',
      '1',
      '-c:a',
      'pcm_s16le',
      '-y',
      outWav,
    ],
    'bg-music-generated'
  );
  return 'ambiance générée';
}

function mixVoiceAndMusic(voiceWav, musicWav, outAac, durationSec) {
  runFfmpeg(
    [
      '-i',
      voiceWav,
      '-i',
      musicWav,
      '-filter_complex',
      '[0:a][1:a]amix=inputs=2:duration=first:dropout_transition=2,alimiter=limit=0.98[a]',
      '-map',
      '[a]',
      '-t',
      String(durationSec),
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-y',
      outAac,
    ],
    'mix-audio'
  );
}

function concatMedia(listFile, outPath, type) {
  if (type === 'video') {
    runFfmpeg(
      [
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        listFile,
        '-c:v',
        'libx264',
        '-preset',
        'fast',
        '-crf',
        '23',
        '-pix_fmt',
        'yuv420p',
        '-an',
        '-y',
        outPath,
      ],
      'concat-video'
    );
  } else {
    runFfmpeg(
      [
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        listFile,
        '-ar',
        '44100',
        '-ac',
        '1',
        '-c:a',
        'pcm_s16le',
        '-y',
        outPath,
      ],
      'concat-audio'
    );
  }
}

function timelineTotal(durations) {
  let total = 0;
  const starts = [];
  for (const d of durations) {
    starts.push(total);
    total += d;
  }
  return { starts, total };
}

function muxVideoAudio(videoPath, audioPath, outPath) {
  runFfmpeg(
    [
      '-i',
      videoPath,
      '-i',
      audioPath,
      '-c:v',
      'copy',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-shortest',
      '-y',
      outPath,
    ],
    'mux'
  );
}

function writeSrt(scenes, durations, outPath) {
  const { starts, total } = timelineTotal(durations);
  const lines = [];
  scenes.forEach((scene, i) => {
    const start = formatSrt(starts[i]);
    const end = formatSrt(
      i < scenes.length - 1 ? starts[i + 1] : total
    );
    lines.push(`${i + 1}`);
    lines.push(`${start} --> ${end}`);
    lines.push(scene.narration);
    lines.push('');
  });
  return writeFile(outPath, lines.join('\n'), 'utf8');
}

function formatSrt(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${String(ms).padStart(3, '0')}`;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

async function main() {
  console.log(`🎬 Construction vidéo (${mode})`);
  console.log('   Voix:', TTS_VOICE, '(Edge TTS neural)');
  console.log('   Images: fixes (sans zoom) + fondu entrée/sortie');

  await mkdir(WORK_DIR, { recursive: true });
  await mkdir(OUT_DIR, { recursive: true });

  const videoClips = [];
  const audioClips = [];
  const sceneDurations = [];

  for (let i = 0; i < SCENES.length; i++) {
    const scene = SCENES[i];
    const img = path.join(ROOT, CAPTURES_DIR, scene.image);
    if (!existsSync(img)) throw new Error(`Capture manquante: ${img}`);

    const idx = String(i + 1).padStart(2, '0');
    const rawMp3 = path.join(WORK_DIR, `${idx}-${scene.id}-raw.mp3`);
    const cleanWav = path.join(WORK_DIR, `${idx}-${scene.id}-voice.wav`);
    const paddedWav = path.join(WORK_DIR, `${idx}-${scene.id}-pad.wav`);
    const videoClip = path.join(WORK_DIR, `${idx}-${scene.id}-v.mp4`);

    console.log(`▶ ${idx}/${SCENES.length} ${scene.id} — synthèse voix…`);
    await synthVoiceMp3(scene.narration, rawMp3);
    cleanVoice(rawMp3, cleanWav);

    const voiceDur = probeDurationSec(cleanWav) ?? scene.durationSec;
    const clipDur = Math.max(voiceDur + 0.9, scene.durationSec * 0.55);
    sceneDurations.push(clipDur);

    padAudioToDuration(cleanWav, paddedWav, clipDur);
    imageToClip(img, clipDur, scene.subtitle, videoClip);

    videoClips.push(videoClip);
    audioClips.push(paddedWav);
    console.log(`   ✓ ${clipDur.toFixed(1)}s`);
  }

  const { total: totalSec } = timelineTotal(sceneDurations);

  const videoList = path.join(WORK_DIR, 'videos.txt');
  const audioList = path.join(WORK_DIR, 'audios.txt');
  await writeFile(
    videoList,
    videoClips.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n'),
    'utf8'
  );
  await writeFile(
    audioList,
    audioClips.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n'),
    'utf8'
  );

  const videoOnly = path.join(WORK_DIR, 'all-video.mp4');
  const voiceOnly = path.join(WORK_DIR, 'all-voice.wav');
  const musicWav = path.join(WORK_DIR, 'background-music.wav');
  const mixedAudio = path.join(WORK_DIR, 'mixed-audio.aac');

  console.log('\n🔗 Assemblage + musique…');
  concatMedia(videoList, videoOnly, 'video');
  concatMedia(audioList, voiceOnly, 'audio');
  const musicSource = buildBackgroundMusic(totalSec, musicWav);
  console.log('   Musique:', musicSource, '(volume', MUSIC_VOL, ')');
  mixVoiceAndMusic(voiceOnly, musicWav, mixedAudio, totalSec);
  muxVideoAudio(videoOnly, mixedAudio, OUT_FILE);

  const srtName =
    mode === 'school'
      ? 'konadata-formation-ecole.srt'
      : mode === 'school-teaser'
        ? 'konadata-formation-ecole-teaser.srt'
        : mode === 'teaser'
          ? 'konadata-demo-teaser.srt'
          : 'konadata-demo-complete.srt';
  const srtPath = path.join(OUT_DIR, srtName);
  await writeSrt(SCENES, sceneDurations, srtPath);

  console.log('\n✅ Vidéo:', OUT_FILE);
  console.log('✅ Sous-titres:', srtPath);
  console.log(`   Durée: ~${Math.floor(totalSec / 60)} min ${Math.round(totalSec % 60)} s`);
}

main().catch((e) => {
  console.error('❌', e.message || e);
  process.exit(1);
});
