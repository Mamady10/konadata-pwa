'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireOrgId } from '@/lib/actions/org';
import type { AppRole } from '@/types/database';

export type AssignmentResourceType = 'school_class' | 'ngo_project' | 'btp_site';

export interface ClassAssignmentRow {
  id: string;
  name: string;
  level: string | null;
  education_level_band: string | null;
  academic_year: string;
}

export interface SubjectAssignmentRow {
  id: string;
  name: string;
  code: string | null;
  education_level_band: string | null;
}

export interface TeachingSlot {
  classId: string;
  subjectId: string;
}

export interface TeacherAssignmentRow {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
  teachingSlots: TeachingSlot[];
}

export interface SchoolAssignmentsPayload {
  classes: ClassAssignmentRow[];
  subjects: SubjectAssignmentRow[];
  teachers: TeacherAssignmentRow[];
}

export interface NgoProjectAssignmentRow {
  id: string;
  name: string;
  region: string | null;
  status: string;
}

export interface NgoStaffAssignmentRow {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
  projectIds: string[];
}

export interface NgoAssignmentsPayload {
  projects: NgoProjectAssignmentRow[];
  staff: NgoStaffAssignmentRow[];
}

export interface BtpSiteAssignmentRow {
  id: string;
  name: string;
  location: string | null;
  status: string;
}

export interface BtpStaffAssignmentRow {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
  siteIds: string[];
}

export interface BtpAssignmentsPayload {
  sites: BtpSiteAssignmentRow[];
  staff: BtpStaffAssignmentRow[];
}

async function requireAssignmentManager() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('can_manage_assignments');
  if (error || !data) {
    throw new Error('Seuls les directeurs peuvent gérer les assignations.');
  }
  return requireOrgId();
}

export async function getSchoolAssignments(): Promise<SchoolAssignmentsPayload> {
  const orgId = await requireAssignmentManager();
  const supabase = await createClient();

  const [
    { data: classes, error: classErr },
    { data: subjects, error: subjectErr },
    { data: teachers, error: teacherErr },
    { data: teaching, error: teachingErr },
  ] = await Promise.all([
    supabase
      .from('school_classes')
      .select('id, name, level, education_level_band, academic_year')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('school_subjects')
      .select('id, name, code, education_level_band')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .in('role', ['teacher', 'registrar'])
      .order('full_name'),
    supabase
      .from('school_teaching_assignments')
      .select('profile_id, class_id, subject_id')
      .eq('organization_id', orgId),
  ]);

  if (classErr) throw new Error(classErr.message);
  if (subjectErr) throw new Error(subjectErr.message);
  if (teacherErr) throw new Error(teacherErr.message);
  if (teachingErr) throw new Error(teachingErr.message);

  const slotsByProfile = new Map<string, TeachingSlot[]>();
  for (const row of teaching ?? []) {
    const list = slotsByProfile.get(row.profile_id as string) ?? [];
    list.push({
      classId: row.class_id as string,
      subjectId: row.subject_id as string,
    });
    slotsByProfile.set(row.profile_id as string, list);
  }

  return {
    classes: (classes ?? []) as ClassAssignmentRow[],
    subjects: (subjects ?? []).map((s) => ({
      id: s.id as string,
      name: s.name as string,
      code: (s.code as string) || null,
      education_level_band: (s.education_level_band as string) || null,
    })),
    teachers: (teachers ?? []).map((t) => {
      const teachingSlots = slotsByProfile.get(t.id as string) ?? [];
      return {
        id: t.id as string,
        full_name: t.full_name as string,
        email: t.email as string,
        role: t.role as AppRole,
        teachingSlots,
      };
    }),
  };
}

function normalizeTeachingSlots(slots: TeachingSlot[]): TeachingSlot[] {
  const seen = new Set<string>();
  const out: TeachingSlot[] = [];
  for (const s of slots) {
    if (!s.classId || !s.subjectId) continue;
    const key = `${s.classId}:${s.subjectId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ classId: s.classId, subjectId: s.subjectId });
  }
  return out;
}

export async function saveTeacherTeachingAssignments(profileId: string, slots: TeachingSlot[]) {
  const orgId = await requireAssignmentManager();
  const supabase = await createClient();

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('id, role, organization_id')
    .eq('id', profileId)
    .eq('organization_id', orgId)
    .single();

  if (profileErr || !profile) {
    return { error: 'Enseignant introuvable dans votre établissement.' };
  }

  if (!['teacher', 'registrar'].includes(profile.role as string)) {
    return { error: 'Les assignations concernent les enseignants ou la scolarité.' };
  }

  const uniqueSlots = normalizeTeachingSlots(slots);

  if (uniqueSlots.length > 0) {
    const classIds = [...new Set(uniqueSlots.map((s) => s.classId))];
    const subjectIds = [...new Set(uniqueSlots.map((s) => s.subjectId))];

    const [{ data: validClasses, error: classErr }, { data: validSubjects, error: subErr }] =
      await Promise.all([
        supabase
          .from('school_classes')
          .select('id, education_level_band, level')
          .eq('organization_id', orgId)
          .in('id', classIds),
        supabase
          .from('school_subjects')
          .select('id, education_level_band')
          .eq('organization_id', orgId)
          .in('id', subjectIds),
      ]);

    if (classErr) return { error: classErr.message };
    if (subErr) return { error: subErr.message };
    if ((validClasses ?? []).length !== classIds.length) {
      return { error: 'Une ou plusieurs classes sont invalides.' };
    }
    if ((validSubjects ?? []).length !== subjectIds.length) {
      return { error: 'Une ou plusieurs matières sont invalides.' };
    }

    const { subjectMatchesClassBand, parseEducationLevelBand } = await import(
      '@/lib/school/education-level-catalog'
    );
    const classById = Object.fromEntries(
      (validClasses ?? []).map((c) => [c.id as string, c])
    );
    const subjectById = Object.fromEntries(
      (validSubjects ?? []).map((s) => [s.id as string, s])
    );
    for (const slot of uniqueSlots) {
      const cls = classById[slot.classId];
      const sub = subjectById[slot.subjectId];
      if (!cls || !sub) continue;
      const classBand = parseEducationLevelBand(cls.education_level_band);
      const subjectBand = parseEducationLevelBand(sub.education_level_band);
      if (
        subjectBand &&
        !subjectMatchesClassBand(subjectBand, classBand, cls.level as string | null)
      ) {
        return {
          error:
            'Une matière ne correspond pas au palier de la classe (primaire, collège, lycée, université).',
        };
      }
    }

    for (const slot of uniqueSlots) {
      const { data: conflict } = await supabase
        .from('school_teaching_assignments')
        .select('profile_id, profiles(full_name)')
        .eq('organization_id', orgId)
        .eq('class_id', slot.classId)
        .eq('subject_id', slot.subjectId)
        .neq('profile_id', profileId)
        .limit(1)
        .maybeSingle();
      if (conflict) {
        const otherName =
          ((conflict.profiles as { full_name?: string } | null)?.full_name) || 'un autre enseignant';
        return {
          error: `Ce couple classe/matière est déjà assigné à ${otherName}.`,
        };
      }
    }
  }

  const { data: { user } } = await supabase.auth.getUser();

  const { error: deleteTeachingErr } = await supabase
    .from('school_teaching_assignments')
    .delete()
    .eq('organization_id', orgId)
    .eq('profile_id', profileId);

  if (deleteTeachingErr) return { error: deleteTeachingErr.message };

  await supabase
    .from('collaborator_assignments')
    .delete()
    .eq('organization_id', orgId)
    .eq('profile_id', profileId)
    .eq('resource_type', 'school_class');

  if (uniqueSlots.length > 0) {
    const rows = uniqueSlots.map((slot) => ({
      organization_id: orgId,
      profile_id: profileId,
      class_id: slot.classId,
      subject_id: slot.subjectId,
      assigned_by: user?.id ?? null,
    }));

    const { error: insertErr } = await supabase.from('school_teaching_assignments').insert(rows);
    if (insertErr) return { error: insertErr.message };
  }

  revalidatePath('/utilisateurs/assignations');
  revalidatePath('/etablissement/resultats');
  revalidatePath('/etablissement/formations');
  return { success: true };
}

/** @deprecated Utiliser saveTeacherTeachingAssignments */
export async function saveTeacherClassAssignments(profileId: string, classIds: string[]) {
  const orgId = await requireAssignmentManager();
  const supabase = await createClient();
  const uniqueClassIds = [...new Set(classIds.filter(Boolean))];
  if (uniqueClassIds.length === 0) {
    return saveTeacherTeachingAssignments(profileId, []);
  }
  const { data: subjects, error } = await supabase
    .from('school_subjects')
    .select('id')
    .eq('organization_id', orgId);
  if (error) return { error: error.message };
  const slots: TeachingSlot[] = [];
  for (const classId of uniqueClassIds) {
    for (const sub of subjects ?? []) {
      slots.push({ classId, subjectId: sub.id as string });
    }
  }
  return saveTeacherTeachingAssignments(profileId, slots);
}

export async function getNgoAssignments(): Promise<NgoAssignmentsPayload> {
  const orgId = await requireAssignmentManager();
  const supabase = await createClient();

  const [{ data: projects, error: projectErr }, { data: staff, error: staffErr }, { data: assignments, error: assignErr }] =
    await Promise.all([
      supabase
        .from('ngo_projects')
        .select('id, name, region, status')
        .eq('organization_id', orgId)
        .order('name'),
      supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .eq('role', 'ngo_staff')
        .order('full_name'),
      supabase
        .from('collaborator_assignments')
        .select('profile_id, resource_id')
        .eq('organization_id', orgId)
        .eq('resource_type', 'ngo_project'),
    ]);

  if (projectErr) throw new Error(projectErr.message);
  if (staffErr) throw new Error(staffErr.message);
  if (assignErr) throw new Error(assignErr.message);

  const byProfile = new Map<string, string[]>();
  for (const row of assignments ?? []) {
    const list = byProfile.get(row.profile_id) ?? [];
    list.push(row.resource_id as string);
    byProfile.set(row.profile_id, list);
  }

  const seenProjectIds = new Set<string>();
  const uniqueProjects: NgoProjectAssignmentRow[] = [];
  for (const p of projects ?? []) {
    const id = p.id as string;
    if (seenProjectIds.has(id)) continue;
    seenProjectIds.add(id);
    uniqueProjects.push(p as NgoProjectAssignmentRow);
  }

  return {
    projects: uniqueProjects,
    staff: (staff ?? []).map((s) => ({
      id: s.id as string,
      full_name: s.full_name as string,
      email: s.email as string,
      role: s.role as AppRole,
      projectIds: byProfile.get(s.id as string) ?? [],
    })),
  };
}

export async function saveNgoStaffProjectAssignments(profileId: string, projectIds: string[]) {
  const orgId = await requireAssignmentManager();
  const supabase = await createClient();

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('id, role, organization_id')
    .eq('id', profileId)
    .eq('organization_id', orgId)
    .single();

  if (profileErr || !profile) {
    return { error: 'Agent introuvable dans votre ONG.' };
  }

  if (profile.role !== 'ngo_staff') {
    return { error: 'Les assignations de projets concernent les agents ONG.' };
  }

  const uniqueProjectIds = [...new Set(projectIds.filter(Boolean))];

  if (uniqueProjectIds.length > 0) {
    const { data: validProjects, error: validErr } = await supabase
      .from('ngo_projects')
      .select('id')
      .eq('organization_id', orgId)
      .in('id', uniqueProjectIds);

    if (validErr) return { error: validErr.message };
    if ((validProjects ?? []).length !== uniqueProjectIds.length) {
      return { error: 'Un ou plusieurs projets sont invalides.' };
    }
  }

  const { data: { user } } = await supabase.auth.getUser();

  const { error: deleteErr } = await supabase
    .from('collaborator_assignments')
    .delete()
    .eq('organization_id', orgId)
    .eq('profile_id', profileId)
    .eq('resource_type', 'ngo_project');

  if (deleteErr) return { error: deleteErr.message };

  if (uniqueProjectIds.length > 0) {
    const rows = uniqueProjectIds.map((projectId) => ({
      organization_id: orgId,
      profile_id: profileId,
      resource_type: 'ngo_project' as const,
      resource_id: projectId,
      can_import: false,
      can_upload: true,
      can_edit: false,
      assigned_by: user?.id ?? null,
    }));

    const { error: insertErr } = await supabase.from('collaborator_assignments').insert(rows);
    if (insertErr) return { error: insertErr.message };
  }

  revalidatePath('/utilisateurs/assignations');
  revalidatePath('/ong/projets');
  revalidatePath('/ong/documents');
  revalidatePath('/ong/rapports');
  return { success: true };
}

export async function getBtpAssignments(): Promise<BtpAssignmentsPayload> {
  const orgId = await requireAssignmentManager();
  const supabase = await createClient();

  const [{ data: sites, error: siteErr }, { data: staff, error: staffErr }, { data: assignments, error: assignErr }] =
    await Promise.all([
      supabase
        .from('btp_sites')
        .select('id, name, location, status')
        .eq('organization_id', orgId)
        .order('name'),
      supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .eq('role', 'btp_staff')
        .order('full_name'),
      supabase
        .from('collaborator_assignments')
        .select('profile_id, resource_id')
        .eq('organization_id', orgId)
        .eq('resource_type', 'btp_site'),
    ]);

  if (siteErr) throw new Error(siteErr.message);
  if (staffErr) throw new Error(staffErr.message);
  if (assignErr) throw new Error(assignErr.message);

  const byProfile = new Map<string, string[]>();
  for (const row of assignments ?? []) {
    const list = byProfile.get(row.profile_id) ?? [];
    list.push(row.resource_id as string);
    byProfile.set(row.profile_id, list);
  }

  const seenSiteIds = new Set<string>();
  const uniqueSites: BtpSiteAssignmentRow[] = [];
  for (const s of sites ?? []) {
    const id = s.id as string;
    if (seenSiteIds.has(id)) continue;
    seenSiteIds.add(id);
    uniqueSites.push(s as BtpSiteAssignmentRow);
  }

  return {
    sites: uniqueSites,
    staff: (staff ?? []).map((s) => ({
      id: s.id as string,
      full_name: s.full_name as string,
      email: s.email as string,
      role: s.role as AppRole,
      siteIds: byProfile.get(s.id as string) ?? [],
    })),
  };
}

export async function saveBtpStaffSiteAssignments(profileId: string, siteIds: string[]) {
  const orgId = await requireAssignmentManager();
  const supabase = await createClient();

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('id, role, organization_id')
    .eq('id', profileId)
    .eq('organization_id', orgId)
    .single();

  if (profileErr || !profile) {
    return { error: 'Staff introuvable dans votre entreprise BTP.' };
  }

  if (profile.role !== 'btp_staff') {
    return { error: 'Les assignations de chantiers concernent le staff BTP.' };
  }

  const uniqueSiteIds = [...new Set(siteIds.filter(Boolean))];

  if (uniqueSiteIds.length > 0) {
    const { data: validSites, error: validErr } = await supabase
      .from('btp_sites')
      .select('id')
      .eq('organization_id', orgId)
      .in('id', uniqueSiteIds);

    if (validErr) return { error: validErr.message };
    if ((validSites ?? []).length !== uniqueSiteIds.length) {
      return { error: 'Un ou plusieurs chantiers sont invalides.' };
    }
  }

  const { data: { user } } = await supabase.auth.getUser();

  const { error: deleteErr } = await supabase
    .from('collaborator_assignments')
    .delete()
    .eq('organization_id', orgId)
    .eq('profile_id', profileId)
    .eq('resource_type', 'btp_site');

  if (deleteErr) return { error: deleteErr.message };

  if (uniqueSiteIds.length > 0) {
    const rows = uniqueSiteIds.map((siteId) => ({
      organization_id: orgId,
      profile_id: profileId,
      resource_type: 'btp_site' as const,
      resource_id: siteId,
      can_import: false,
      can_upload: true,
      can_edit: true,
      assigned_by: user?.id ?? null,
    }));

    const { error: insertErr } = await supabase.from('collaborator_assignments').insert(rows);
    if (insertErr) return { error: insertErr.message };
  }

  revalidatePath('/utilisateurs/assignations');
  revalidatePath('/btp/chantiers');
  revalidatePath('/btp/carburant');
  revalidatePath('/btp/avancement');
  revalidatePath('/btp/documents');
  return { success: true };
}

export async function canManageAssignments(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('can_manage_assignments');
  if (error) return false;
  return Boolean(data);
}

/** null = accès complet (directeur). [] = aucune assignation. */
export async function getMyTeachingAssignments(): Promise<TeachingSlot[] | null> {
  const canManage = await canManageAssignments();
  if (canManage) return null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: teaching, error: teachingErr } = await supabase
    .from('school_teaching_assignments')
    .select('class_id, subject_id')
    .eq('profile_id', user.id);

  if (!teachingErr && (teaching?.length ?? 0) > 0) {
    return (teaching ?? []).map((r) => ({
      classId: r.class_id as string,
      subjectId: r.subject_id as string,
    }));
  }

  const { data: legacy, error: legacyErr } = await supabase
    .from('collaborator_assignments')
    .select('resource_id')
    .eq('profile_id', user.id)
    .eq('resource_type', 'school_class');

  if (legacyErr || !(legacy?.length)) return [];

  const { data: prof } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  const orgId = prof?.organization_id as string | undefined;
  if (!orgId) return [];

  const classIds = [...new Set(legacy.map((r) => r.resource_id as string))];
  const { data: subjects } = await supabase
    .from('school_subjects')
    .select('id')
    .eq('organization_id', orgId);

  const slots: TeachingSlot[] = [];
  for (const classId of classIds) {
    for (const sub of subjects ?? []) {
      slots.push({ classId, subjectId: sub.id as string });
    }
  }
  return slots;
}

/** null = toutes les classes (directeur). */
export async function getMyAssignedSchoolClassIds(): Promise<string[] | null> {
  const slots = await getMyTeachingAssignments();
  if (slots === null) return null;
  return [...new Set(slots.map((s) => s.classId))];
}

/** null = accès à tous les chantiers (directeur). [] = aucune assignation. */
export async function getMyAssignedBtpSiteIds(): Promise<string[] | null> {
  const canManage = await canManageAssignments();
  if (canManage) return null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('collaborator_assignments')
    .select('resource_id')
    .eq('profile_id', user.id)
    .eq('resource_type', 'btp_site');

  if (error) return [];
  return (data ?? []).map((r) => r.resource_id as string);
}

/** null = accès à tous les projets (directeur). [] = aucune assignation. */
export async function getMyAssignedNgoProjectIds(): Promise<string[] | null> {
  const canManage = await canManageAssignments();
  if (canManage) return null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('collaborator_assignments')
    .select('resource_id')
    .eq('profile_id', user.id)
    .eq('resource_type', 'ngo_project');

  if (error) return [];
  return (data ?? []).map((r) => r.resource_id as string);
}
