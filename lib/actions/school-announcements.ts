'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireOrgId } from '@/lib/actions/org';
import { getSession } from '@/lib/actions/auth';
import { MAX_ANNOUNCEMENT_IMAGES } from '@/lib/school/announcement-constants';

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
  imageUrls: string[];
}

const ANNOUNCEMENT_SELECT =
  'id, title, body, category, event_date, visible_to_parents, visible_to_students, published_at, image_path, image_paths';

/** Retourne toutes les clés Storage d'une ligne (tableau image_paths, sinon image_path). */
function rowImagePaths(row: Record<string, unknown>): string[] {
  const arr = row.image_paths as string[] | null;
  if (Array.isArray(arr) && arr.length) return arr.filter(Boolean);
  const single = row.image_path as string | null;
  return single ? [single] : [];
}

function mapRow(
  row: Record<string, unknown>,
  urlByPath: Record<string, string>
): SchoolAnnouncementRow {
  const paths = rowImagePaths(row);
  return {
    id: row.id as string,
    title: row.title as string,
    body: (row.body as string) ?? '',
    category: (row.category as SchoolAnnouncementCategory) ?? 'announcement',
    eventDate: (row.event_date as string) ?? null,
    visibleToParents: Boolean(row.visible_to_parents),
    visibleToStudents: Boolean(row.visible_to_students),
    publishedAt: row.published_at as string,
    imageUrls: paths.map((p) => urlByPath[p]).filter((u): u is string => Boolean(u)),
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

/** Extensions autorisées → type MIME. */
const ANNOUNCEMENT_IMAGE_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

/** Déduit extension + type MIME d'après le nom et/ou le type du fichier. */
function resolveImageKind(
  name?: string | null,
  type?: string | null
): { ext: string; contentType: string } | null {
  const nameExt = (name ?? '').match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ?? '';
  if (ANNOUNCEMENT_IMAGE_TYPES[nameExt]) {
    return { ext: nameExt, contentType: ANNOUNCEMENT_IMAGE_TYPES[nameExt] };
  }
  const mime = (type ?? '').toLowerCase();
  const extByType = Object.entries(ANNOUNCEMENT_IMAGE_TYPES).find(([, m]) => m === mime)?.[0];
  if (extByType) return { ext: extByType, contentType: mime };
  return null;
}

export interface AnnouncementUploadTarget {
  /** Clé Storage à réutiliser lors de la publication. */
  path: string;
  /** Jeton d'upload signé (pour uploadToSignedUrl côté navigateur). */
  token: string;
}

/**
 * Génère des URLs d'upload signées pour envoyer les images d'annonces
 * DIRECTEMENT du navigateur vers Supabase Storage. Cela contourne la limite de
 * taille des Server Actions (et la limite plateforme ~4,5 Mo sur Vercel) : les
 * images conservent leur pleine qualité, quelle que soit leur taille.
 */
export async function createAnnouncementUploadTargets(
  files: Array<{ name?: string | null; type?: string | null }>
): Promise<{ targets?: AnnouncementUploadTarget[]; error?: string }> {
  const orgId = await requireOrgId();
  const session = await getSession();
  if (!canWriteAnnouncements(session?.profile?.role)) {
    return { error: 'Seuls la direction et la scolarité peuvent publier.' };
  }
  if (!files.length) return { targets: [] };
  if (files.length > MAX_ANNOUNCEMENT_IMAGES) {
    return { error: `Maximum ${MAX_ANNOUNCEMENT_IMAGES} images par publication.` };
  }

  const service = await createServiceClient();
  const targets: AnnouncementUploadTarget[] = [];
  for (const f of files) {
    const kind = resolveImageKind(f.name, f.type);
    if (!kind) return { error: 'Format image non pris en charge (PNG, JPG ou WEBP).' };
    const path = `${orgId}/announcements/${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 10)}.${kind.ext}`;
    const { data, error } = await service.storage
      .from('documents')
      .createSignedUploadUrl(path);
    if (error || !data) {
      return { error: `Préparation de l'envoi impossible : ${error?.message ?? 'inconnue'}` };
    }
    targets.push({ path: data.path ?? path, token: data.token });
  }
  return { targets };
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
    rows.flatMap((r) => rowImagePaths(r as Record<string, unknown>))
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

  // Les images ont déjà été téléversées en pleine qualité côté navigateur :
  // on ne reçoit que leurs chemins Storage (via createAnnouncementUploadTargets).
  const rawPaths = formData.get('image_paths');
  let imagePaths: string[] = [];
  if (typeof rawPaths === 'string' && rawPaths.trim()) {
    try {
      const parsed = JSON.parse(rawPaths);
      if (Array.isArray(parsed)) {
        imagePaths = parsed.filter((p): p is string => typeof p === 'string' && p.trim().length > 0);
      }
    } catch {
      return { error: "Chemins d'images invalides." };
    }
  }

  if (imagePaths.length > MAX_ANNOUNCEMENT_IMAGES) {
    return { error: `Maximum ${MAX_ANNOUNCEMENT_IMAGES} images par publication.` };
  }

  // Sécurité : n'accepter que des chemins appartenant à CETTE organisation.
  const prefix = `${orgId}/announcements/`;
  if (imagePaths.some((p) => !p.startsWith(prefix) || p.includes('..'))) {
    return { error: "Chemin d'image non autorisé." };
  }

  const removeUploaded = async () => {
    if (!imagePaths.length) return;
    const service = await createServiceClient();
    await service.storage.from('documents').remove(imagePaths);
  };

  const { error } = await supabase.from('school_announcements').insert({
    organization_id: orgId,
    title,
    body,
    category,
    event_date: eventDate,
    visible_to_parents: formData.get('visible_to_parents') !== 'false',
    visible_to_students: formData.get('visible_to_students') !== 'false',
    image_path: imagePaths[0] ?? null,
    image_paths: imagePaths,
    created_by: session?.user?.id ?? null,
  });

  if (error) {
    await removeUploaded();
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
    .select('image_path, image_paths')
    .eq('id', id)
    .eq('organization_id', orgId)
    .maybeSingle();

  const { error } = await supabase
    .from('school_announcements')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId);
  if (error) return { error: error.message };

  const paths = existing ? rowImagePaths(existing as Record<string, unknown>) : [];
  if (paths.length) {
    await supabase.storage.from('documents').remove(paths);
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
    data.flatMap((r) => rowImagePaths(r as Record<string, unknown>))
  );
  return data.map((r) => mapRow(r as Record<string, unknown>, urlByPath));
}
