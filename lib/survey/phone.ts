/** Normalise un numéro guinéen vers E.164 (+2246XXXXXXXX). */
export function normalizeGuineaPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (!digits.length) return null;

  let normalized = digits;
  if (normalized.startsWith('00224')) {
    normalized = normalized.slice(2);
  }
  if (normalized.startsWith('224') && normalized.length === 12) {
    return `+${normalized}`;
  }
  if (normalized.length === 9 && normalized.startsWith('6')) {
    return `+224${normalized}`;
  }
  if (normalized.length === 10 && normalized.startsWith('06')) {
    return `+224${normalized.slice(1)}`;
  }
  return null;
}

export function maskPhoneE164(e164: string): string {
  const digits = e164.replace(/\D/g, '');
  if (digits.length < 6) return e164;
  return `+${digits.slice(0, 3)}*****${digits.slice(-2)}`;
}
