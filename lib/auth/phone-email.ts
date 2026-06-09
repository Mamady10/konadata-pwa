/** Email technique pour les comptes créés par téléphone (profiles.email reste NOT NULL). */
export function phoneToSyntheticEmail(phoneE164: string): string {
  const digits = phoneE164.replace(/\D/g, '');
  return `${digits}@phone.konadata.gn`;
}

export function isSyntheticPhoneEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().endsWith('@phone.konadata.gn');
}
