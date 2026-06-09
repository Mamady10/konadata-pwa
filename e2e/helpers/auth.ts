import { createClient } from '@supabase/supabase-js';
import type { BrowserContext } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

export const DEMO_PASSWORD = 'DemoKona2026!';
export const SCHOOL_EMAIL = 'demo.ecole@konadata.demo';

function loadEnvLocal() {
  const envPath = path.resolve(__dirname, '../../.env.local');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.replace(/\r$/, '');
    const m = trimmed.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

function supabaseProjectRef(url: string | undefined) {
  const m = url?.match(/https:\/\/([^.]+)\.supabase\.co/);
  return m?.[1] ?? null;
}

function createChunks(key: string, value: string) {
  const CHUNK_SIZE = 3180;
  if (value.length <= CHUNK_SIZE) return [{ name: key, value }];
  const chunks: Array<{ name: string; value: string }> = [];
  let remaining = value;
  let i = 0;
  while (remaining.length > 0) {
    chunks.push({ name: `${key}.${i}`, value: remaining.slice(0, CHUNK_SIZE) });
    remaining = remaining.slice(CHUNK_SIZE);
    i += 1;
  }
  return chunks;
}

export async function loginViaSupabase(
  context: BrowserContext,
  email: string,
  password = DEMO_PASSWORD
) {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const base = process.env.PLAYWRIGHT_BASE_URL || process.env.DEMO_BASE_URL || 'http://localhost:3000';
  const ref = supabaseProjectRef(url);

  if (!url || !anonKey || !ref) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / ANON_KEY manquants dans .env.local');
  }

  const supabase = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Auth ${email}: ${error.message}`);
  if (!data.session) throw new Error(`Pas de session pour ${email}`);

  const storageKey = `sb-${ref}-auth-token`;
  const payload = JSON.stringify({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    expires_in: data.session.expires_in,
    token_type: data.session.token_type,
    user: data.session.user,
  });

  const baseUrl = new URL(base);
  const cookies = createChunks(storageKey, payload).map((c) => ({
    name: c.name,
    value: c.value,
    domain: baseUrl.hostname,
    path: '/',
    httpOnly: false,
    secure: baseUrl.protocol === 'https:',
    sameSite: 'Lax' as const,
  }));

  await context.addCookies(cookies);
}
