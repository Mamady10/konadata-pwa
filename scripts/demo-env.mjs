import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

export function loadEnvLocal() {
  const envPath = resolve(__dir, '../.env.local');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.replace(/\r$/, '');
    const m = trimmed.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

export function supabaseProjectRef(url) {
  const m = url?.match(/https:\/\/([^.]+)\.supabase\.co/);
  return m?.[1] ?? null;
}
