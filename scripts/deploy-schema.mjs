#!/usr/bin/env node
/**
 * Déploie le schéma KonaData sur Supabase via PostgreSQL direct.
 * Plus besoin de copier-coller dans le SQL Editor.
 *
 * 1. Supabase Dashboard → Settings → Database → Database password
 * 2. Ajoutez dans .env.local : SUPABASE_DB_PASSWORD=votre_mot_de_passe
 * 3. npm run deploy:schema
 */
import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');
const envPath = resolve(root, '.env.local');

function loadEnv() {
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.replace(/\r$/, '');
    const m = trimmed.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

loadEnv();

const password = process.env.SUPABASE_DB_PASSWORD;
const projectRef = 'wrwhoqtxttthmqfocmab';

if (!password) {
  console.error(`
❌ Mot de passe PostgreSQL manquant.

Étapes :
  1. Ouvrez https://supabase.com/dashboard/project/${projectRef}/settings/database
  2. Copiez le "Database password" (ou réinitialisez-le si oublié)
  3. Ajoutez dans .env.local :
     SUPABASE_DB_PASSWORD=votre_mot_de_passe
  4. Relancez : npm run deploy:schema
`);
  process.exit(1);
}

const connectionString =
  process.env.SUPABASE_DB_URL ||
  `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres`;

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

function readSql(relativePath) {
  const p = resolve(root, relativePath);
  if (!existsSync(p)) throw new Error(`Fichier introuvable : ${p}`);
  return readFileSync(p, 'utf8');
}

function listMigrations() {
  const dir = resolve(root, 'supabase/migrations');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => resolve(dir, f));
}

async function runSql(label, sql) {
  process.stdout.write(`  → ${label}... `);
  try {
    await client.query(sql);
    console.log('✅');
  } catch (err) {
    console.log('❌');
    throw err;
  }
}

async function verify() {
  const { rows: tables } = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  const required = ['organizations', 'profiles', 'school_students', 'ngo_projects', 'btp_sites'];
  const names = tables.map((r) => r.table_name);
  const missing = required.filter((t) => !names.includes(t));

  console.log(`\n📊 Tables publiques : ${names.length}`);
  if (missing.length) {
    console.error('❌ Tables manquantes :', missing.join(', '));
    process.exit(1);
  }
  console.log('✅ Schéma KonaData installé avec succès !');
  required.forEach((t) => console.log(`   ✓ ${t}`));
}

async function main() {
  console.log(`\n🔗 Connexion à db.${projectRef}.supabase.co...\n`);

  await client.connect();
  console.log('✅ Connecté\n');

  const reset = process.argv.includes('--no-reset')
    ? null
    : readSql('supabase/full_schema_reset.sql');

  if (reset) {
    console.log('🧹 Reset (nettoyage ancien schéma)...');
    await runSql('full_schema_reset.sql', reset);
    console.log('');
  }

  console.log('📦 Application des migrations...');
  for (const file of listMigrations()) {
    const name = file.split(/[/\\]/).pop();
    await runSql(name, readFileSync(file, 'utf8'));
  }

  await verify();
  await client.end();
}

main().catch(async (err) => {
  console.error('\n❌ Erreur :', err.message);
  if (err.message.includes('password authentication failed')) {
    console.error('\n→ Mot de passe incorrect. Vérifiez SUPABASE_DB_PASSWORD dans .env.local');
    console.error(`→ Dashboard : https://supabase.com/dashboard/project/${projectRef}/settings/database`);
  }
  try { await client.end(); } catch { /* ignore */ }
  process.exit(1);
});
