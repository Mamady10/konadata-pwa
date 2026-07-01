'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireOrgId } from '@/lib/actions/org';
import { getSession } from '@/lib/actions/auth';

export type SchoolAnnouncementCategory = 'announcement' | 'event' | 'holiday' | 'results';

export interface SchoolAnnouncementRow {
  id: string;
  title: string;
  body: string;
  category: SchoolAnnouncementCategory;
  eventDate: string | null;
  visibleToParents: boolean;
  visibleToStudents: boolean;
  publishedAt: string;
}

function mapRow(row: Record<string, unknown>): SchoolAnnouncementRow {
  return {
    id: row.id as string,
    title: row.title as string,
    body: (row.body as string) ?? '',
    category: (row.category as SchoolAnnouncementCategory) ?? 'announcement',
    eventDate: (row.event_date as string) ?? null,
    visibleToParents: Boolean(row.visible_to_parents),
    visibleToStudents: Boolean(row.visible_to_students),
    publishedAt: row.published_at as string,
  };
}

export async function getSchoolAnnouncements(orgId: string, limit = 50): Promise<SchoolAnnouncementRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('school_announcements')
    .select('id, title, body, category, event_date, visible_to_parents, visible_to_students, published_at')
    .eq('organization_id', orgId)
    .order('published_at', { ascending: false })
    .limit(limit);
  if (error) {
    if (error.message.includes('school_announcements')) return [];
    throw error;
  }
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export async function createSchoolAnnouncement(formData: FormData) {
  const orgId = await requireOrgId();
  const session = await getSession();
  const supabase = await createClient();

  const title = (formData.get('title') as string)?.trim();
  const body = (formData.get('body') as string)?.trim() ?? '';
  if (!title) return { error: 'Titre requis.' };

  const category = ((formData.get('category') as string) || 'announcement') as SchoolAnnouncementCategory;
  const eventDate = (formData.get('event_date') as string)?.trim() || null;

  const { error } = await supabase.from('school_announcements').insert({
    organization_id: orgId,
    title,
    body,
    category,
    event_date: eventDate,
    visible_to_parents: formData.get('visible_to_parents') !== 'false',
    visible_to_students: formData.get('visible_to_students') !== 'false',
    created_by: session?.user?.id ?? null,
  });

  if (error) return { error: error.message };
  revalidatePath('/etablissement/vie-scolaire');
  revalidatePath('/suivi-scolarite');
  return { success: true };
}

export async function deleteSchoolAnnouncement(id: string) {
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const { error } = await supabase
    .from('school_announcements')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId);
  if (error) return { error: error.message };
  revalidatePath('/etablissement/vie-scolaire');
  return { success: true };
}

/** Annonces visibles parents (portail OTP) — sans session auth école */
export async function getSchoolAnnouncementsForGuardian(orgId: string): Promise<SchoolAnnouncementRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('school_announcements')
    .select('id, title, body, category, event_date, visible_to_parents, visible_to_students, published_at')
    .eq('organization_id', orgId)
    .eq('visible_to_parents', true)
    .order('published_at', { ascending: false })
    .limit(20);
  if (error || !data) return [];
  return data.map((r) => mapRow(r as Record<string, unknown>));
}
