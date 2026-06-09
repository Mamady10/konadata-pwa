#!/usr/bin/env node
/**
 * Teste la connexion Supabase et vérifie si le schéma est appliqué.
 * Usage: node scripts/test-supabase.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '../.env.local');

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.replace(/\r$/, '');
    const m = trimmed.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('❌ Variables Supabase manquantes dans .env.local');
  process.exit(1);
}

console.log('🔗 Projet:', url);

const supabase = createClient(url, key);

const tables = ['organizations', 'profiles', 'school_students', 'school_enrollments', 'documents'];

for (const table of tables) {
  const { error } = await supabase.from(table).select('id').limit(1);
  if (error) {
    console.log(`❌ Table "${table}": ${error.message}`);
  } else {
    console.log(`✅ Table "${table}" accessible`);
  }
}

const { data: buckets } = await supabase.storage.listBuckets();
console.log('📦 Buckets:', buckets?.map((b) => b.name).join(', ') || 'aucun (schéma storage non appliqué)');

console.log('\n📋 Si des tables sont absentes, exécutez supabase/full_schema.sql dans le SQL Editor:');
console.log('   https://supabase.com/dashboard/project/wrwhoqtxttthmqfocmab/sql/new');
