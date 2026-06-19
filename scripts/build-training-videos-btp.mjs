#!/usr/bin/env node
/**
 * Génère les vidéos de formation BTP par rôle.
 *
 * Prérequis :
 *   npm run dev
 *   npm run capture:demo:all
 *
 * Usage :
 *   npm run build:training-videos:btp
 *   npm run build:training-video:btp -- direction
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { BTP_TRAINING_ROLE_IDS } from './training-video-timeline-btp.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const BUILD = path.join(__dir, 'build-demo-video.mjs');

const onlyRole = process.argv[2]?.trim();
const roles = onlyRole ? [onlyRole] : BTP_TRAINING_ROLE_IDS;

if (onlyRole && !BTP_TRAINING_ROLE_IDS.includes(onlyRole)) {
  console.error(`Rôle BTP inconnu: ${onlyRole}`);
  console.error('Rôles:', BTP_TRAINING_ROLE_IDS.join(', '));
  process.exit(1);
}

console.log(`🏗️ Formations vidéo BTP — ${roles.length} rôle(s)\n`);

let failed = 0;
for (const role of roles) {
  console.log(`\n━━━ btp/${role} ━━━`);
  const r = spawnSync(process.execPath, [BUILD, '--training-btp', role], {
    stdio: 'inherit',
    cwd: path.resolve(__dir, '..'),
  });
  if (r.status !== 0) failed += 1;
}

if (failed) {
  console.error(`\n❌ ${failed} vidéo(s) BTP en échec`);
  process.exit(1);
}

console.log('\n✅ Formations BTP dans docs/formation/training/output/');
