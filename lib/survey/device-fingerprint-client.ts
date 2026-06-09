'use client';

const STORAGE_PREFIX = 'kona_survey_fp_v1';

/** Empreinte légère côté navigateur (hashée côté serveur avec le survey_id). */
export async function getClientDeviceFingerprint(): Promise<string> {
  if (typeof window === 'undefined') return 'server';

  const cached = localStorage.getItem(STORAGE_PREFIX);
  if (cached) return cached;

  const parts = [
    navigator.userAgent,
    navigator.language,
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    String(navigator.hardwareConcurrency ?? ''),
    String(navigator.maxTouchPoints ?? 0),
  ];

  const raw = parts.join('|');
  const encoded = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  const fp = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  localStorage.setItem(STORAGE_PREFIX, fp);
  return fp;
}

export function getParticipationCookieName(surveyId: string): string {
  return `kona_srv_done_${surveyId.slice(0, 8)}`;
}

export function hasLocalParticipationMark(surveyId: string): boolean {
  if (typeof document === 'undefined') return false;
  const cookieName = getParticipationCookieName(surveyId);
  if (document.cookie.includes(`${cookieName}=1`)) return true;
  return localStorage.getItem(`${cookieName}_ls`) === '1';
}

export function markLocalParticipation(surveyId: string, lockDays: number) {
  const cookieName = getParticipationCookieName(surveyId);
  const maxAge = lockDays * 24 * 60 * 60;
  document.cookie = `${cookieName}=1; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
  localStorage.setItem(`${cookieName}_ls`, '1');
}
