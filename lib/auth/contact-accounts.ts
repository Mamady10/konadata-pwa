import type { SupabaseClient } from '@supabase/supabase-js';
import { isSyntheticPhoneEmail, phoneToSyntheticEmail } from '@/lib/auth/phone-email';

export type ContactAccountChoice = {
  id: string;
  /** Email technique pour signInWithPassword */
  authEmail: string;
  label: string;
  fullName: string;
  organizationName: string | null;
};

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  organizations: { name?: string } | { name?: string }[] | null;
};

function orgNameFromRow(row: ProfileRow): string | null {
  const org = row.organizations;
  if (!org) return null;
  if (Array.isArray(org)) return org[0]?.name?.trim() || null;
  return org.name?.trim() || null;
}

function toChoice(row: ProfileRow): ContactAccountChoice {
  const fullName = (row.full_name ?? '').trim() || 'Compte KonaData';
  const organizationName = orgNameFromRow(row);
  const label = organizationName ? `${fullName} — ${organizationName}` : `${fullName} — Sans organisation`;
  return {
    id: row.id,
    authEmail: row.email,
    label,
    fullName,
    organizationName,
  };
}

/** Tous les profils liés à un numéro WhatsApp (partage autorisé). */
export async function findProfilesByPhone(
  service: SupabaseClient,
  phoneE164: string
): Promise<ContactAccountChoice[]> {
  const { data: byPhone } = await service
    .from('profiles')
    .select('id, email, full_name, organizations(name)')
    .eq('phone', phoneE164)
    .order('created_at', { ascending: true });

  const rows = (byPhone ?? []) as ProfileRow[];
  if (rows.length) return rows.map(toChoice);

  // Rétrocompat : ancien compte téléphone sans profiles.phone renseigné
  const legacy = phoneToSyntheticEmail(phoneE164);
  const { data: byEmail } = await service
    .from('profiles')
    .select('id, email, full_name, organizations(name)')
    .ilike('email', legacy)
    .maybeSingle();

  if (byEmail?.id) return [toChoice(byEmail as ProfileRow)];
  return [];
}

/** @deprecated Préférer findProfilesByPhone — conserve le 1er compte pour rétrocompat. */
export async function findProfileByPhone(
  service: SupabaseClient,
  phoneE164: string
): Promise<{ id: string; email: string } | null> {
  const all = await findProfilesByPhone(service, phoneE164);
  if (!all.length) return null;
  return { id: all[0]!.id, email: all[0]!.authEmail };
}

/** Profils joignables par email de contact (ou email auth legacy). */
export async function findProfilesByContactEmail(
  service: SupabaseClient,
  contactEmail: string
): Promise<ContactAccountChoice[]> {
  const email = contactEmail.trim().toLowerCase();
  if (!email || isSyntheticPhoneEmail(email)) return [];

  const seen = new Map<string, ContactAccountChoice>();

  const { data: byContact, error: contactErr } = await service
    .from('profiles')
    .select('id, email, full_name, organizations(name)')
    .ilike('contact_email', email)
    .order('created_at', { ascending: true });

  // Migration 120 absente : ignorer contact_email et se rabattre sur email auth.
  if (!contactErr?.message?.includes('contact_email')) {
    for (const row of (byContact ?? []) as ProfileRow[]) {
      seen.set(row.id, toChoice(row));
    }
  }

  const { data: byAuthEmail } = await service
    .from('profiles')
    .select('id, email, full_name, organizations(name)')
    .ilike('email', email)
    .maybeSingle();

  if (byAuthEmail?.id) {
    seen.set(byAuthEmail.id, toChoice(byAuthEmail as ProfileRow));
  }

  return Array.from(seen.values());
}

export async function authEmailAlreadyTaken(
  service: SupabaseClient,
  authEmail: string
): Promise<boolean> {
  const { data } = await service
    .from('profiles')
    .select('id')
    .ilike('email', authEmail.trim().toLowerCase())
    .maybeSingle();
  return Boolean(data?.id);
}
