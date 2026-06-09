#!/usr/bin/env node
/**
 * Audit RLS multi-tenant KonaData
 *
 * Usage: npm run audit:rls
 *
 * Connexion (par priorité) :
 *  1. DATABASE_URL
 *  2. SUPABASE_DB_PASSWORD (+ NEXT_PUBLIC_SUPABASE_URL)
 *  3. SUPABASE_SERVICE_ROLE_KEY → RPC audit_rls_tenant_isolation (migration 056)
 */
import { createClient } from '@supabase/supabase-js';
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
    const trimmed = line.replace(/\r$/, '');
    const m = trimmed.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

loadEnv();

const AUDIT_SQL = `
WITH tenant_tables AS (
  SELECT DISTINCT c.relname AS table_name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND a.attname = 'organization_id'
    AND NOT a.attisdropped
),
rls_on AS (
  SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
),
policies AS (
  SELECT
    tablename AS table_name,
    COUNT(*) FILTER (WHERE roles::text LIKE '%authenticated%') AS auth_policy_count,
    BOOL_OR(
      qual::text ILIKE '%belongs_to_org%'
      OR qual::text ILIKE '%get_user_organization_id%'
      OR with_check::text ILIKE '%belongs_to_org%'
      OR with_check::text ILIKE '%get_user_organization_id%'
    ) AS has_tenant_predicate
  FROM pg_policies
  WHERE schemaname = 'public'
  GROUP BY tablename
)
SELECT
  t.table_name,
  COALESCE(r.rls_enabled, false) AS rls_enabled,
  COALESCE(p.auth_policy_count, 0)::int AS authenticated_policies,
  COALESCE(p.has_tenant_predicate, false) AS has_tenant_predicate,
  CASE
    WHEN NOT COALESCE(r.rls_enabled, false) THEN 'FAIL_RLS_OFF'
    WHEN COALESCE(p.auth_policy_count, 0) = 0 THEN 'FAIL_NO_POLICY'
    WHEN NOT COALESCE(p.has_tenant_predicate, false) THEN 'WARN_NO_TENANT'
    ELSE 'OK'
  END AS audit_status
FROM tenant_tables t
LEFT JOIN rls_on r ON r.table_name = t.table_name
LEFT JOIN policies p ON p.table_name = t.table_name
ORDER BY audit_status DESC, t.table_name;
`;

function printResults(rows, via) {
  console.log(`🔒 Audit RLS KonaData — via ${via}\n`);

  if (!rows.length) {
    console.log('⚠️  Aucune table avec organization_id trouvée.');
    return { fails: 0, warns: 0, ok: 0 };
  }

  let fails = 0;
  let warns = 0;
  let ok = 0;

  for (const row of rows) {
    const icon =
      row.audit_status === 'OK'
        ? '✅'
        : row.audit_status.startsWith('WARN')
          ? '⚠️ '
          : '❌';
    if (row.audit_status === 'OK') ok += 1;
    else if (row.audit_status.startsWith('WARN')) warns += 1;
    else fails += 1;

    const detail = [
      row.rls_enabled ? 'RLS' : 'no-RLS',
      `${row.authenticated_policies} policy(s)`,
      row.has_tenant_predicate ? 'tenant✓' : 'tenant?',
    ].join(' · ');

    console.log(`${icon} ${row.table_name.padEnd(40)} ${row.audit_status.padEnd(18)} ${detail}`);
  }

  console.log(`\n--- Résumé: ${ok} OK · ${warns} avertissement(s) · ${fails} échec(s) ---`);
  return { fails, warns, ok };
}

async function auditViaPg() {
  const databaseUrl = process.env.DATABASE_URL;
  const password = process.env.SUPABASE_DB_PASSWORD;
  const projectRef =
    process.env.SUPABASE_PROJECT_REF ||
    (process.env.NEXT_PUBLIC_SUPABASE_URL || '').match(/https:\/\/([^.]+)\./)?.[1] ||
    'wrwhoqtxttthmqfocmab';

  let client;
  if (databaseUrl) {
    client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  } else if (password) {
    client = new pg.Client({
      host: `db.${projectRef}.supabase.co`,
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password,
      ssl: { rejectUnauthorized: false },
    });
  } else {
    return null;
  }

  await client.connect();
  try {
    const { rows } = await client.query(AUDIT_SQL);
    return { rows, via: databaseUrl ? 'DATABASE_URL' : 'SUPABASE_DB_PASSWORD' };
  } finally {
    await client.end();
  }
}

async function auditViaServiceRole() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.rpc('audit_rls_tenant_isolation');
  if (error) {
    if (
      error.message.includes('audit_rls_tenant_isolation') ||
      error.message.includes('does not exist')
    ) {
      return { migrationMissing: true, error: error.message };
    }
    throw new Error(error.message);
  }

  const rows = (data?.rows ?? []) ;
  return { rows, via: 'SUPABASE_SERVICE_ROLE_KEY (RPC)' };
}

function printHelp() {
  console.error(`
❌ Connexion base impossible — ajoutez UNE de ces options dans .env.local :

  Option A (recommandée si vous avez déjà la clé service) :
    SUPABASE_SERVICE_ROLE_KEY=eyJ...
    + exécuter migration 056 (supabase/sql-editor/056-F-audit-rls-rpc-ONLY.sql)

  Option B (mot de passe PostgreSQL direct) :
    SUPABASE_DB_PASSWORD=votre_mot_de_passe
    Dashboard → https://supabase.com/dashboard/project/wrwhoqtxttthmqfocmab/settings/database

  Option C :
    DATABASE_URL=postgresql://postgres:[PASSWORD]@db.wrwhoqtxttthmqfocmab.supabase.co:5432/postgres
`);
}

try {
  let result = await auditViaPg();

  if (!result) {
    const rpcResult = await auditViaServiceRole();
    if (rpcResult?.migrationMissing) {
      console.error(`
❌ RPC audit_rls_tenant_isolation absente.

  Exécutez dans Supabase SQL Editor :
  supabase/sql-editor/056-F-audit-rls-rpc-ONLY.sql

  Ou ajoutez SUPABASE_DB_PASSWORD dans .env.local
`);
      process.exit(1);
    }
    if (rpcResult) {
      result = rpcResult;
    }
  }

  if (!result) {
    printHelp();
    process.exit(1);
  }

  const { fails, warns } = printResults(result.rows, result.via);

  if (fails > 0) {
    console.error('\n❌ Audit RLS échoué. Corrigez les tables en FAIL.');
    process.exit(1);
  }
  if (warns > 0) {
    console.warn('\n⚠️  Vérifiez les tables WARN.');
    process.exit(0);
  }
  console.log('\n✅ Audit RLS réussi.');
} catch (e) {
  console.error('❌ Erreur:', e.message);
  printHelp();
  process.exit(1);
}
