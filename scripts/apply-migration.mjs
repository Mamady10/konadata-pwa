#!/usr/bin/env node
/**
 * Applique UNE migration précise sur Supabase (sans reset, sans rejouer tout le schéma).
 *
 * Usage :
 *   1. Ajoutez dans .env.local : SUPABASE_DB_PASSWORD=votre_mot_de_passe
 *      (Supabase Dashboard → Settings → Database → Database password)
 *   2. node scripts/apply-migration.mjs 113_pme_debts.sql
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');
const envPath = resolve(root, '.env.local');

function loadEnv() {
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.replace(/\r$/, '').match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

loadEnv();

const fileArg = process.argv[2];
if (!fileArg) {
  console.error('❌ Précisez le fichier de migration. Ex : node scripts/apply-migration.mjs 113_pme_debts.sql');
  process.exit(1);
}

const password = process.env.SUPABASE_DB_PASSWORD;
const projectRef = 'wrwhoqtxttthmqfocmab';

if (!password) {
  console.error(`
❌ SUPABASE_DB_PASSWORD manquant dans .env.local.
   1. https://supabase.com/dashboard/project/${projectRef}/settings/database
   2. Copiez le "Database password"
   3. Ajoutez dans .env.local : SUPABASE_DB_PASSWORD=...
`);
  process.exit(1);
}

const connectionString =
  process.env.SUPABASE_DB_URL ||
  `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres`;

const migrationPath = resolve(root, 'supabase/migrations', fileArg);
if (!existsSync(migrationPath)) {
  console.error(`❌ Fichier introuvable : ${migrationPath}`);
  process.exit(1);
}

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
  console.log(`\n🔗 Connexion à db.${projectRef}.supabase.co...`);
  await client.connect();
  console.log('✅ Connecté');
  console.log(`📦 Application de ${fileArg}...`);
  await client.query(readFileSync(migrationPath, 'utf8'));
  console.log('✅ Migration appliquée avec succès !');
  await client.end();
}

main().catch(async (err) => {
  console.error('\n❌ Erreur :', err.message);
  try { await client.end(); } catch { /* ignore */ }
  process.exit(1);
});
