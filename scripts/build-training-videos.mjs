#!/usr/bin/env node
/**
 * Génère toutes les vidéos de formation par rôle (établissement scolaire).
 *
 * Prérequis :
 *   npm run dev
 *   npm run capture:demo:all
 *
 * Usage :
 *   npm run build:training-videos              # toutes les vidéos
 *   npm run build:training-video -- direction  # une seule
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { TRAINING_ROLE_IDS } from './training-video-timeline.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const BUILD = path.join(__dir, 'build-demo-video.mjs');

const onlyRole = process.argv[2]?.trim();
const roles = onlyRole ? [onlyRole] : TRAINING_ROLE_IDS;

if (onlyRole && !TRAINING_ROLE_IDS.includes(onlyRole)) {
  console.error(`Rôle inconnu: ${onlyRole}`);
  console.error('Rôles:', TRAINING_ROLE_IDS.join(', '));
  process.exit(1);
}

console.log(`📚 Formations vidéo — ${roles.length} rôle(s)\n`);

let failed = 0;
for (const role of roles) {
  console.log(`\n━━━ ${role} ━━━`);
  const r = spawnSync(process.execPath, [BUILD, '--training', role], {
    stdio: 'inherit',
    cwd: path.resolve(__dir, '..'),
  });
  if (r.status !== 0) failed += 1;
}

if (failed) {
  console.error(`\n❌ ${failed} vidéo(s) en échec`);
  process.exit(1);
}

console.log('\n✅ Toutes les formations vidéo sont dans docs/formation/training/output/');
