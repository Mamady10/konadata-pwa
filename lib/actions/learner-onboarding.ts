'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type {
  PublicSchoolOption,
  SchoolApplicationCatalog,
  SchoolCatalogClass,
} from '@/lib/school/learner-application';

export type { PublicSchoolOption, SchoolApplicationCatalog, SchoolCatalogClass };

function buildCatalogFromRows(
  rows: Array<{
    id: string;
    name: string;
    level: string | null;
    department: string | null;
    program: string | null;
    academic_year: string;
  }>
): SchoolApplicationCatalog {
  const classes = rows.map((c) => ({
    id: c.id,
    name: c.name,
    level: c.level,
    department: c.department,
    program: c.program,
    academic_year: c.academic_year,
  }));
  const levels = [...new Set(classes.map((c) => c.level).filter(Boolean))] as string[];
  const departments = [...new Set(classes.map((c) => c.department).filter(Boolean))] as string[];
  const programs = [...new Set(classes.map((c) => c.program).filter(Boolean))] as string[];
  return {
    levels,
    departments,
    programs,
    classes,
    hasClasses: classes.length > 0,
  };
}

export async function listPublicSchools(): Promise<PublicSchoolOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('list_public_schools');
  if (error) {
    const { data: rows } = await supabase
      .from('organizations')
      .select('id, name, email, settings')
      .eq('type', 'school')
      .eq('is_active', true)
      .order('name');
    return (rows ?? []).map((o) => ({
      id: o.id as string,
      name: o.name as string,
      email: (o.email as string) ?? null,
      city: ((o.settings as { city?: string })?.city) ?? '',
    }));
  }
  return (data ?? []).map((row: { id: string; name: string; email?: string; city?: string }) => ({
    id: row.id,
    name: row.name,
    email: row.email ?? null,
    city: row.city ?? '',
  }));
}

export async function getSchoolApplicationCatalog(
  orgId: string
): Promise<SchoolApplicationCatalog> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_school_application_catalog', {
    p_org_id: orgId,
  });
  if (!error && data) {
    const raw = data as Record<string, unknown>;
    if (typeof raw.error !== 'string') {
      const cls = (raw.classes as SchoolCatalogClass[]) ?? [];
      return {
        ...buildCatalogFromRows(
          cls.map((c) => ({
            id: c.id,
            name: c.name,
            level: c.level,
            department: c.department,
            program: c.program,
            academic_year: c.academic_year,
          }))
        ),
      };
    }
  }

  const { data: classes, error: clsErr } = await supabase
    .from('school_classes')
    .select('id, name, level, department, program, academic_year')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .order('name');

  if (clsErr) {
    return {
      levels: [],
      departments: [],
      programs: [],
      classes: [],
      hasClasses: false,
      error: clsErr.message,
    };
  }

  return buildCatalogFromRows(
    (classes ?? []).map((c) => ({
      id: c.id as string,
      name: c.name as string,
      level: (c.level as string) ?? null,
      department: (c.department as string) ?? null,
      program: (c.program as string) ?? null,
      academic_year: (c.academic_year as string) ?? '2025-2026',
    }))
  );
}

export interface ApplyToSchoolInput {
  organizationId: string;
  studyLevel: string;
  department: string;
  program: string;
  classId?: string | null;
  requestType: 'new' | 'reenrollment';
  reenrollmentCode?: string | null;
  academicYear?: string;
  guardianName?: string | null;
  guardianPhone?: string | null;
  guardianRelation?: string | null;
  guardianSmsConsent?: boolean;
}

async function applyViaDirectInserts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  input: ApplyToSchoolInput
): Promise<{ error?: string; success?: boolean }> {
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('id, full_name, email, organization_id, role')
    .eq('id', userId)
    .single();

  if (profErr || !profile) return { error: profErr?.message || 'Profil introuvable' };

  const { data: org } = await supabase
    .from('organizations')
    .select('id, type, is_active')
    .eq('id', input.organizationId)
    .eq('type', 'school')
    .eq('is_active', true)
    .maybeSingle();

  if (!org) return { error: 'Établissement introuvable ou inactif.' };

  const applicantName =
    (profile.full_name as string)?.trim() ||
    (profile.email as string)?.split('@')[0] ||
    'Candidat';

  let profileUpdErr = (
    await supabase
      .from('profiles')
      .update({
        organization_id: input.organizationId,
        role: (profile.role as string) === 'student' ? 'student' : 'candidate',
        onboarding_path: 'learner',
      })
      .eq('id', userId)
  ).error;

  if (profileUpdErr?.message?.includes('onboarding_path')) {
    profileUpdErr = (
      await supabase
        .from('profiles')
        .update({
          organization_id: input.organizationId,
          role: (profile.role as string) === 'student' ? 'student' : 'candidate',
        })
        .eq('id', userId)
    ).error;
  }

  if (profileUpdErr) return { error: profileUpdErr.message };

  let personId: string | null = null;
  const { data: existingPerson } = await supabase
    .from('core_persons')
    .select('id')
    .eq('profile_id', userId)
    .eq('organization_id', input.organizationId)
    .maybeSingle();

  if (existingPerson?.id) {
    personId = existingPerson.id as string;
  } else {
    const { data: person, error: personErr } = await supabase
      .from('core_persons')
      .insert({
        organization_id: input.organizationId,
        profile_id: userId,
        kind: 'candidate',
        full_name: applicantName,
        email: profile.email,
      })
      .select('id')
      .single();
    if (personErr) return { error: personErr.message };
    personId = person.id as string;
  }

  let studentId: string | null = null;
  const { data: existingStudent } = await supabase
    .from('school_students')
    .select('id')
    .eq('person_id', personId)
    .eq('organization_id', input.organizationId)
    .maybeSingle();

  if (existingStudent?.id) {
    studentId = existingStudent.id as string;
    if (input.classId) {
      await supabase
        .from('school_students')
        .update({ class_id: input.classId })
        .eq('id', studentId);
    }
  } else {
    const { data: student, error: studentErr } = await supabase
      .from('school_students')
      .insert({
        organization_id: input.organizationId,
        person_id: personId,
        class_id: input.classId || null,
        enrollment_status: 'pending',
      })
      .select('id')
      .single();
    if (studentErr) return { error: studentErr.message };
    studentId = student.id as string;
  }

  const baseEnrollment = {
    organization_id: input.organizationId,
    student_id: studentId,
    class_id: input.classId || null,
    academic_year: input.academicYear || '2025-2026',
    status: 'pending' as const,
    applicant_name: applicantName,
    applicant_email: profile.email as string,
    notes:
      input.requestType === 'reenrollment' ? 'Réinscription' : 'Nouvelle inscription',
  };

  const extendedEnrollment = {
    ...baseEnrollment,
    request_type: input.requestType,
    study_level: input.studyLevel,
    department: input.department,
    program: input.program,
    reenrollment_verification_code:
      input.requestType === 'reenrollment'
        ? (input.reenrollmentCode || '').trim().toUpperCase()
        : null,
    reenrollment_code_verified: false,
    guardian_name: input.guardianName?.trim() || null,
    guardian_phone: input.guardianPhone?.trim() || null,
    guardian_relation: input.guardianRelation?.trim() || null,
    guardian_sms_consent: Boolean(input.guardianSmsConsent),
  };

  let enrollErr = (
    await supabase.from('school_enrollments').insert(extendedEnrollment)
  ).error;

  if (enrollErr?.message?.includes('column') || enrollErr?.code === '42703') {
    enrollErr = (await supabase.from('school_enrollments').insert(baseEnrollment)).error;
  }

  if (enrollErr) return { error: enrollErr.message };

  return { success: true };
}

async function resolveApplyInput(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: ApplyToSchoolInput
): Promise<ApplyToSchoolInput> {
  if (!input.classId) return input;
  const { data: cls } = await supabase
    .from('school_classes')
    .select('level, department, program, academic_year')
    .eq('id', input.classId)
    .maybeSingle();
  if (!cls) return input;
  return {
    ...input,
    studyLevel: input.studyLevel || (cls.level as string) || '',
    department: input.department || (cls.department as string) || '',
    program: input.program || (cls.program as string) || '',
    academicYear: input.academicYear || (cls.academic_year as string) || '2025-2026',
  };
}

export async function applyToSchoolAsLearner(input: ApplyToSchoolInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Connectez-vous pour finaliser votre inscription.' };

  if (!input.organizationId) {
    return { error: 'Choisissez un établissement.' };
  }

  const resolved = await resolveApplyInput(supabase, input);

  const { data, error } = await supabase.rpc('apply_to_school_as_learner', {
    p_org_id: resolved.organizationId,
    p_study_level: resolved.studyLevel,
    p_department: resolved.department,
    p_program: resolved.program,
    p_class_id: resolved.classId || null,
    p_request_type: resolved.requestType,
    p_reenrollment_code: resolved.reenrollmentCode || null,
    p_academic_year: resolved.academicYear || '2025-2026',
    p_guardian_name: resolved.guardianName || null,
    p_guardian_phone: resolved.guardianPhone || null,
    p_guardian_relation: resolved.guardianRelation || null,
    p_guardian_sms_consent: Boolean(resolved.guardianSmsConsent),
  });

  if (error) {
    const hint = error.message.includes('apply_to_school_as_learner')
      ? ' Exécutez les migrations 027 et 029 dans Supabase SQL Editor.'
      : '';
    const fallback = await applyViaDirectInserts(supabase, user.id, resolved);
    if (fallback.error) {
      return {
        error: `${error.message}${hint} (${fallback.error})`,
      };
    }
    revalidatePath('/etablissement');
    revalidatePath('/etablissement/candidatures');
    return { success: true };
  }

  const result = data as { error?: string; success?: boolean } | null;
  if (result?.error) {
    const fallback = await applyViaDirectInserts(supabase, user.id, resolved);
    if (fallback.error) return { error: result.error };
    revalidatePath('/etablissement');
    revalidatePath('/etablissement/candidatures');
    return { success: true, viaFallback: true };
  }

  if (!result?.success) {
    const fallback = await applyViaDirectInserts(supabase, user.id, resolved);
    if (fallback.error) {
      return { error: 'La demande n’a pas pu être enregistrée. Réessayez.' };
    }
  }

  revalidatePath('/etablissement');
  revalidatePath('/etablissement/candidatures');
  revalidatePath('/inscription-etablissement');

  return {
    success: true,
    reenrollmentVerified: Boolean(
      (result as { reenrollment_verified?: boolean })?.reenrollment_verified
    ),
  };
}

export async function createReenrollmentCode(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Non authentifié' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single();

  if (!profile?.organization_id) return { error: 'Organisation requise' };

  const code = (formData.get('code') as string)?.trim().toUpperCase();
  const legacyReference = (formData.get('legacy_reference') as string)?.trim() || null;
  const academicYear = (formData.get('academic_year') as string)?.trim() || null;
  const matricule = (formData.get('matricule') as string)?.trim().toUpperCase() || null;

  if (!code || code.length < 4) {
    return { error: 'Code min. 4 caractères (ex. REIN-2024-042 ou matricule)' };
  }

  const row: Record<string, unknown> = {
    organization_id: profile.organization_id,
    code,
    legacy_reference: legacyReference,
  };
  if (academicYear) row.academic_year = academicYear;
  if (matricule) row.matricule = matricule;

  const { error } = await supabase.from('school_reenrollment_codes').insert(row);

  if (error) {
    if (error.message.includes('does not exist')) {
      return {
        error:
          'Table des codes de réinscription absente — exécutez la migration 027 dans Supabase.',
      };
    }
    return { error: error.message };
  }

  revalidatePath('/etablissement/candidatures');
  return { success: true };
}

export async function listReenrollmentCodes(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('school_reenrollment_codes')
    .select('id, code, legacy_reference, is_active, used_at, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    if (error.message.includes('does not exist')) return [];
    throw new Error(error.message);
  }
  return data ?? [];
}
