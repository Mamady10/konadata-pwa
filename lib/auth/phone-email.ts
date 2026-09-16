/** Email technique pour les comptes créés par téléphone (profiles.email reste UNIQUE). */

export function phoneToSyntheticEmail(phoneE164: string, disambiguator?: string): string {
  const digits = phoneE164.replace(/\D/g, '');
  if (disambiguator?.trim()) {
    return `${digits}.${disambiguator.trim().toLowerCase()}@phone.konadata.gn`;
  }
  return `${digits}@phone.konadata.gn`;
}

export function isSyntheticPhoneEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().endsWith('@phone.konadata.gn');
}

export function isSyntheticAuthEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.toLowerCase();
  return e.endsWith('@phone.konadata.gn') || e.endsWith('@email.konadata.gn');
}

/** Suffixe court pour disambiguation (auth email unique). */
export function randomAuthSuffix(length = 6): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(length);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

/**
 * Auth email unique pour un nouveau compte téléphone.
 * Les anciens comptes restent en `{digits}@phone.konadata.gn`.
 */
export function allocatePhoneAuthEmail(phoneE164: string): string {
  return phoneToSyntheticEmail(phoneE164, randomAuthSuffix(6));
}

/**
 * Auth email unique pour un compte « email ».
 * - 1er compte : l'adresse saisie (compatibilité).
 * - Comptes suivants avec le même contact : `{local}+kdXXXXXX@{domain}`.
 */
export function allocateEmailAuthEmail(contactEmail: string, alreadyUsedAsAuthEmail: boolean): string {
  const normalized = contactEmail.trim().toLowerCase();
  if (!alreadyUsedAsAuthEmail) return normalized;

  const at = normalized.lastIndexOf('@');
  if (at <= 0) {
    return `${normalized}.${randomAuthSuffix(6)}@email.konadata.gn`;
  }
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  return `${local}+kd${randomAuthSuffix(6)}@${domain}`;
}
