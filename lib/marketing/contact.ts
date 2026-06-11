/** Coordonnées publiques KonaData (landing, affiches, footer). */
export const KONADATA_CONTACT = {
  email: 'contact@konadatagn.com',
  whatsapp: [
    { display: '+224 628 36 04 35', waMe: '224628360435' },
    { display: '+224 627 71 77 85', waMe: '224627717785' },
  ] as const,
} as const;

export function whatsAppUrl(waMe: string, text?: string): string {
  const base = `https://wa.me/${waMe.replace(/\D/g, '')}`;
  if (!text?.trim()) return base;
  return `${base}?text=${encodeURIComponent(text.trim())}`;
}
