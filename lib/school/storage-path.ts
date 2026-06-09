import 'server-only';

import { randomUUID } from 'crypto';

const MAX_DISPLAY_NAME_LEN = 240;

/** Clé Supabase Storage sûre ; le nom d'origine est conservé en base (affichage). */
export function buildSafeDocumentStoragePath(
  orgId: string,
  originalName: string
): { storagePath: string; displayName: string } {
  const trimmed = originalName.trim() || 'document';
  const lastDot = trimmed.lastIndexOf('.');
  const ext =
    lastDot > 0 && lastDot < trimmed.length - 1
      ? trimmed.slice(lastDot).replace(/[^a-zA-Z0-9.]/g, '').slice(0, 16)
      : '';
  const storageFileName = `${Date.now()}_${randomUUID()}${ext}`;
  const displayName =
    trimmed.length > MAX_DISPLAY_NAME_LEN
      ? `${trimmed.slice(0, MAX_DISPLAY_NAME_LEN - 3)}...${ext}`
      : trimmed;
  return {
    storagePath: `${orgId}/${storageFileName}`,
    displayName,
  };
}
