/**
 * Cache d'autorisation signé (cookie court) pour le middleware.
 *
 * Objectif performance : éviter, sur chaque navigation, la requête profil +
 * les RPC facturation/CGU. Après une première résolution, on stocke un petit
 * jeton signé (HMAC) valable ~60 s. Les navigations suivantes lisent ce jeton
 * sans toucher la base. Les accès aux données restent protégés par la RLS ;
 * ce cache ne sert qu'aux redirections d'accès (secteur, facturation, CGU).
 */

export const AUTHZ_COOKIE = 'kona_authz';
export const AUTHZ_TTL_MS = 60_000;

export interface AuthzCacheData {
  sub: string;
  role: string | null;
  orgId: string | null;
  orgType: string | null;
  isActive: boolean;
  onboardingPath: string | null;
  billingStatus: string | null;
  billingOk: boolean;
  cguAccepted: boolean;
  surveyOnly: boolean;
  hasEnrollmentHistory: boolean;
}

export function getAuthzSecret(): string | null {
  return (
    process.env.AUTHZ_COOKIE_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    null
  );
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmacSha256(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

export async function signAuthz(
  data: AuthzCacheData,
  secret: string,
  ttlMs: number = AUTHZ_TTL_MS
): Promise<string> {
  const payload = { ...data, exp: Date.now() + ttlMs };
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = toBase64Url(await hmacSha256(secret, body));
  return `${body}.${sig}`;
}

export async function verifyAuthz(
  value: string,
  secret: string,
  expectedSub: string
): Promise<AuthzCacheData | null> {
  const dot = value.indexOf('.');
  if (dot <= 0) return null;
  const body = value.slice(0, dot);
  const sig = value.slice(dot + 1);

  const expectedSig = toBase64Url(await hmacSha256(secret, body));
  if (expectedSig !== sig) return null;

  let payload: (AuthzCacheData & { exp?: number }) | null = null;
  try {
    payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body)));
  } catch {
    return null;
  }
  if (!payload || payload.sub !== expectedSub) return null;
  if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;

  const { exp: _exp, ...data } = payload;
  void _exp;
  return data;
}
