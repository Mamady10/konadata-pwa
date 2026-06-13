#!/usr/bin/env node
/**
 * Vérifie que les routes API publiques sont déclarées et utilisées par le middleware.
 * Usage: npm run check:public-api
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function listApiRoutePaths(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) {
      listApiRoutePaths(full, acc);
      continue;
    }
    if (entry === 'route.ts') {
      acc.push('/' + relative(resolve(root, 'app'), dirname(full)).replace(/\\/g, '/'));
    }
  }
  return acc;
}

function extractPublicPrefixes(source) {
  const match = source.match(/PUBLIC_API_PREFIXES\s*=\s*\[([\s\S]*?)\]\s*as const/);
  if (!match) throw new Error('PUBLIC_API_PREFIXES introuvable dans lib/http/public-api-routes.ts');
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

function extractClientFetchPaths(source) {
  return [...source.matchAll(/fetch\s*\(\s*['"`](\/api\/[^'"`]+)['"`]/g)].map((m) => m[1]);
}

function isCovered(path, prefixes) {
  return prefixes.some((p) => path === p || path.startsWith(`${p}/`));
}

function walkTsFiles(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') continue;
      walkTsFiles(full, acc);
    } else if (/\.(tsx?|jsx?|mjs)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

const publicPrefixes = extractPublicPrefixes(read('lib/http/public-api-routes.ts'));
const middlewareSource = read('lib/supabase/middleware.ts');

if (!middlewareSource.includes('isPublicApiPath')) {
  console.error('❌ middleware.ts n’utilise pas isPublicApiPath — risque de régression.');
  process.exit(1);
}

const allApiPaths = listApiRoutePaths(resolve(root, 'app/api'));
const clientFetchPaths = new Set();
for (const file of walkTsFiles(root)) {
  const rel = relative(root, file);
  if (rel.startsWith('node_modules')) continue;
  const content = readFileSync(file, 'utf8');
  for (const p of extractClientFetchPaths(content)) {
    clientFetchPaths.add(p.split('?')[0].replace(/\$\{[^}]+\}/g, ''));
  }
}

/** Routes protégées par secret / token dans le handler (pas session cookie). */
const HANDLER_AUTH_PREFIXES = [
  '/api/cron',
  '/api/billing/webhook',
  '/api/school-payment/webhook',
  '/api/school-payment/receipt',
];

const mustBePublic = new Set([
  ...clientFetchPaths,
  ...allApiPaths.filter((p) =>
    HANDLER_AUTH_PREFIXES.some((h) => p === h || p.startsWith(`${h}/`))
  ),
]);

const missing = [...mustBePublic].filter((p) => !isCovered(p, publicPrefixes));

if (missing.length) {
  console.error('❌ Routes API appelées sans session mais absentes de PUBLIC_API_PREFIXES :');
  for (const p of missing.sort()) console.error(`   - ${p}`);
  console.error('\nAjoutez-les dans lib/http/public-api-routes.ts');
  process.exit(1);
}

console.log(`✅ ${publicPrefixes.length} préfixes publics — ${mustBePublic.size} routes client/critiques couvertes.`);
