'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireOrgId } from '@/lib/actions/org';
import { getSession } from '@/lib/actions/auth';
import { prepareBrandingImage } from '@/lib/school/branding-image-prep';

export type SchoolAnnouncementCategory = 'announcement' | 'event' | 'holiday' | 'results';

/** Rôles autorisés à publier/supprimer — miroir de la policy RLS school_announcements_write. */
const ANNOUNCEMENT_WRITE_ROLES = new Set([
  'platform_admin',
  'org_admin',
  'deputy_director',
  'registrar',
]);

function canWriteAnnouncements(role: string | null | undefined): boolean {
  return Boolean(role && ANNOUNCEMENT_WRITE_ROLES.has(role));
}

export interface SchoolAnnouncementRow {
  id: string;
  title: string;
  body: string;
  category: SchoolAnnouncementCategory;
  eventDate: string | null;
  visibleToParents: boolean;
  visibleToStudents: boolean;
  publishedAt: string;
  imageUrl: string | null;
}

const ANNOUNCEMENT_SELECT =
  'id, title, body, category, event_date, visible_to_parents, visible_to_students, published_at, image_path';

function mapRow(
  row: Record<string, unknown>,
  urlByPath: Record<string, string>
): SchoolAnnouncementRow {
  const imagePath = (row.image_path as string) ?? null;
  return {
    id: row.id as string,
    title: row.title as string,
    body: (row.body as string) ?? '',
    category: (row.category as SchoolAnnouncementCategory) ?? 'announcement',
    eventDate: (row.event_date as string) ?? null,
    visibleToParents: Boolean(row.visible_to_parents),
    visibleToStudents: Boolean(row.visible_to_students),
    publishedAt: row.published_at as string,
    imageUrl: imagePath ? (urlByPath[imagePath] ?? null) : null,
  };
}

/**
 * Génère des URLs signées (1 h) pour les images d'annonces. Utilise le client
 * service-role pour couvrir tous les lecteurs autorisés (personnel, élèves,
 * parents sur le portail sans session). Les lignes ont déjà été filtrées par RLS
 * ou par la requête appelante, donc seules des images autorisées sont signées.
 */
export async function signAnnouncementImagePaths(
  paths: Array<string | null | undefined>
): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  if (!unique.length) return {};
  const service = await createServiceClient();
  const out: Record<string, string> = {};
  await Promise.all(
    unique.map(async (path) => {
      const { data } = await service.storage
        .from('documents')
        .createSignedUrl(path, 3600);
      if (data?.signedUrl) out[path] = data.signedUrl;
    })
  );
  return out;
}

async function uploadAnnouncementImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  file: Blob & { name?: string }
): Promise<{ path?: string; error?: string }> {
  const rawName = (file as { name?: string }).name ?? 'image.jpg';
  if (!/\.(png|jpe?g|webp)$/i.test(rawName) && !file.type.startsWith('image/')) {
    return { error: 'Format image non pris en charge (PNG, JPG ou WEBP).' };
  }

  const inputBuffer = Buffer.from(await file.arrayBuffer());
  if (!inputBuffer.byteLength) return { error: 'Image vide.' };

  const prepared = await prepareBrandingImage(inputBuffer, {
    maxDimension: 1600,
    preferJpeg: true,
    fileName: rawName,
  });

  const path = `${orgId}/announcements/${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}.jpg`;

  const { error } = await supabase.storage
    .from('documents')
    .upload(path, prepared.buffer, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (error) return { error: `Échec de l'envoi de l'image : ${error.message}` };
  return { path };
}

export async function getSchoolAnnouncements(orgId: string, limit = 50): Promise<SchoolAnnouncementRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('school_announcements')
    .select(ANNOUNCEMENT_SELECT)
    .eq('organization_id', orgId)
    .order('published_at', { ascending: false })
    .limit(limit);
  if (error) {
    if (error.message.includes('school_announcements')) return [];
    throw error;
  }
  const rows = data ?? [];
  const urlByPath = await signAnnouncementImagePaths(
    rows.map((r) => (r as Record<string, unknown>).image_path as string | null)
  );
  return rows.map((r) => mapRow(r as Record<string, unknown>, urlByPath));
}

export async function createSchoolAnnouncement(formData: FormData) {
  const orgId = await requireOrgId();
  const session = await getSession();
  if (!canWriteAnnouncements(session?.profile?.role)) {
    return { error: 'Seuls la direction et la scolarité peuvent publier.' };
  }
  const supabase = await createClient();

  const title = (formData.get('title') as string)?.trim();
  const body = (formData.get('body') as string)?.trim() ?? '';
  if (!title) return { error: 'Titre requis.' };

  const category = ((formData.get('category') as string) || 'announcement') as SchoolAnnouncementCategory;
  const eventDate = (formData.get('event_date') as string)?.trim() || null;

  let imagePath: string | null = null;
  const imageFile = formData.get('image');
  if (imageFile instanceof Blob && imageFile.size > 0) {
    const uploaded = await uploadAnnouncementImage(supabase, orgId, imageFile);
    if (uploaded.error) return { error: uploaded.error };
    imagePath = uploaded.path ?? null;
  }

  const { error } = await supabase.from('school_announcements').insert({
    organization_id: orgId,
    title,
    body,
    category,
    event_date: eventDate,
    visible_to_parents: formData.get('visible_to_parents') !== 'false',
    visible_to_students: formData.get('visible_to_students') !== 'false',
    image_path: imagePath,
    created_by: session?.user?.id ?? null,
  });

  if (error) {
    if (imagePath) {
      await supabase.storage.from('documents').remove([imagePath]);
    }
    return { error: error.message };
  }
  revalidatePath('/etablissement/vie-scolaire');
  revalidatePath('/suivi-scolarite');
  return { success: true };
}

export async function deleteSchoolAnnouncement(id: string) {
  const orgId = await requireOrgId();
  const session = await getSession();
  if (!canWriteAnnouncements(session?.profile?.role)) {
    return { error: 'Action non autorisée.' };
  }
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('school_announcements')
    .select('image_path')
    .eq('id', id)
    .eq('organization_id', orgId)
    .maybeSingle();

  const { error } = await supabase
    .from('school_announcements')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId);
  if (error) return { error: error.message };

  const imagePath = (existing?.image_path as string) ?? null;
  if (imagePath) {
    await supabase.storage.from('documents').remove([imagePath]);
  }
  revalidatePath('/etablissement/vie-scolaire');
  return { success: true };
}

/** Annonces visibles parents (portail OTP) — sans session auth école */
export async function getSchoolAnnouncementsForGuardian(orgId: string): Promise<SchoolAnnouncementRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('school_announcements')
    .select(ANNOUNCEMENT_SELECT)
    .eq('organization_id', orgId)
    .eq('visible_to_parents', true)
    .order('published_at', { ascending: false })
    .limit(20);
  if (error || !data) return [];
  const urlByPath = await signAnnouncementImagePaths(
    data.map((r) => (r as Record<string, unknown>).image_path as string | null)
  );
  return data.map((r) => mapRow(r as Record<string, unknown>, urlByPath));
}
