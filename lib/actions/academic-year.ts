'use server';



import { createClient } from '@/lib/supabase/server';

import { getSession } from '@/lib/actions/auth';

import { requireOrgId } from '@/lib/actions/org';

import { revalidatePath } from 'next/cache';

import { getEtablissementCapabilities } from '@/lib/school/etablissement-access';

import {

  ARCHIVE_CATEGORY_LABELS,

  buildAcademicYearArchives,

  type AcademicYearArchiveCategory,

} from '@/lib/school/academic-year-archive';

import { buildPermanentReenrollmentCode } from '@/lib/school/reenrollment-code';

import { parseStudentMatriculeSettings } from '@/lib/school/student-matricules';

import {

  isAcademicYearConcluded,

  mergeSchoolOrgSettingsPatch,

  nextAcademicYearLabel,

  parseAcademicYearLabel,

  parseSchoolOrgSettings,

} from '@/lib/school/school-org-settings';



export type AcademicYearArchiveSummary = {

  category: AcademicYearArchiveCategory;

  label: string;

  file_name: string;

  content_type: string;

  row_count: number;

  id: string;

};



export type AcademicYearOverview = {

  currentYear: string;

  isCurrentYearConcluded: boolean;

  suggestedNextYear: string | null;

  concludedYears: {

    year: string;

    concluded_at: string;

    archives: AcademicYearArchiveSummary[];

  }[];

  stats: {

    activeClasses: number;

    enrolledStudents: number;

    pendingEnrollments: number;

  };

};



const REVALIDATE_PATHS = [

  '/parametres/annee-scolaire',

  '/parametres',

  '/etablissement',

  '/etablissement/formations',

  '/etablissement/etudiants',

  '/etablissement/candidatures',

  '/etablissement/bulletins',

  '/etablissement/paiements',

  '/etablissement/rapports',

];



function revalidateAcademicYearPaths() {

  for (const p of REVALIDATE_PATHS) revalidatePath(p);

}



async function requireDirector() {

  const session = await getSession();

  const caps = getEtablissementCapabilities(session?.profile?.role);

  if (!caps.isDirector) {

    return { error: 'Seul le directeur peut gérer les années scolaires.' as const };

  }

  return { session };

}



async function loadArchivesForYears(

  orgId: string,

  years: string[]

): Promise<Map<string, AcademicYearArchiveSummary[]>> {

  const map = new Map<string, AcademicYearArchiveSummary[]>();

  if (years.length === 0) return map;



  const supabase = await createClient();

  const { data, error } = await supabase

    .from('school_academic_year_archives')

    .select('id, academic_year, category, file_name, content_type, row_count')

    .eq('organization_id', orgId)

    .in('academic_year', years)

    .order('category');



  if (error) {

    if (error.message.includes('does not exist')) return map;

    throw new Error(error.message);

  }



  for (const row of data ?? []) {

    const year = row.academic_year as string;

    const category = row.category as AcademicYearArchiveCategory;

    const list = map.get(year) ?? [];

    list.push({

      id: row.id as string,

      category,

      label: ARCHIVE_CATEGORY_LABELS[category] ?? category,

      file_name: row.file_name as string,

      content_type: row.content_type as string,

      row_count: Number(row.row_count ?? 0),

    });

    map.set(year, list);

  }

  return map;

}



async function persistYearArchives(orgId: string, year: string) {

  const supabase = await createClient();

  const archives = await buildAcademicYearArchives(supabase, orgId, year);



  for (const archive of archives) {

    const { error } = await supabase.from('school_academic_year_archives').upsert(

      {

        organization_id: orgId,

        academic_year: year,

        category: archive.category,

        file_name: archive.file_name,

        content_type: archive.content_type,

        content: archive.content,

        row_count: archive.row_count,

      },

      { onConflict: 'organization_id,academic_year,category' }

    );

    if (error) {

      if (error.message.includes('does not exist')) {

        return { error: 'Table archives absente — exécutez la migration 085 dans Supabase.' };

      }

      return { error: error.message };

    }

  }

  return { success: true as const, count: archives.length };

}



async function generateReenrollmentCodesFromPriorYear(
  orgId: string,
  sourceYear: string,
  _targetYear: string
): Promise<{ created: number; skipped: number } | { error: string }> {
  const supabase = await createClient();

  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .select('name, settings')
    .eq('id', orgId)
    .single();

  if (orgErr) return { error: orgErr.message };

  const orgName = (org?.name as string) || 'Établissement';
  const { data: matriculeSettingsRaw } = await supabase.rpc('school_student_matricule_settings', {
    p_org_id: orgId,
  });
  const matriculeSettings = parseStudentMatriculeSettings(matriculeSettingsRaw);
  const orgPrefix = matriculeSettings.org_prefix;

  const { data: yearClasses } = await supabase
    .from('school_classes')
    .select('id')
    .eq('organization_id', orgId)
    .eq('academic_year', sourceYear);

  const classIds = (yearClasses ?? []).map((c) => c.id as string);

  let students: Array<{
    id: string;
    matricule: string | null;
    core_persons: { full_name?: string } | { full_name?: string }[] | null;
  }> = [];

  if (classIds.length > 0) {
    const { data: byClass, error: stErr } = await supabase
      .from('school_students')
      .select('id, matricule, enrollment_status, core_persons(full_name)')
      .eq('organization_id', orgId)
      .eq('enrollment_status', 'enrolled')
      .in('class_id', classIds);

    if (stErr) return { error: stErr.message };
    students = (byClass ?? []) as typeof students;
  }

  const { data: byEnrollment } = await supabase
    .from('school_enrollments')
    .select('student_id, school_students(id, matricule, core_persons(full_name))')
    .eq('organization_id', orgId)
    .eq('academic_year', sourceYear)
    .eq('status', 'enrolled');

  for (const row of byEnrollment ?? []) {
    const st = row.school_students as
      | { id?: string; matricule?: string; core_persons?: { full_name?: string } }
      | { id?: string; matricule?: string; core_persons?: { full_name?: string } }[]
      | null;
    const student = Array.isArray(st) ? st[0] : st;
    if (!student?.id) continue;
    if (!students.some((s) => s.id === student.id)) {
      students.push({
        id: student.id as string,
        matricule: (student.matricule as string) || null,
        core_persons: student.core_persons ?? null,
      });
    }
  }

  let created = 0;
  let skipped = 0;

  for (const student of students) {
    const person = student.core_persons;
    const fullName = Array.isArray(person) ? person[0]?.full_name : person?.full_name;
    if (!fullName?.trim()) {
      skipped++;
      continue;
    }

    const { data: existingByStudent } = await supabase
      .from('school_reenrollment_codes')
      .select('id')
      .eq('organization_id', orgId)
      .eq('student_id', student.id)
      .maybeSingle();

    if (existingByStudent?.id) {
      skipped++;
      continue;
    }

    const code = buildPermanentReenrollmentCode({
      orgName,
      orgPrefix,
      studentFullName: fullName.trim(),
      studentId: student.id,
    });

    const matricule = (student.matricule ?? '').trim().toUpperCase() || null;

    const { error: insErr } = await supabase.from('school_reenrollment_codes').insert({
      organization_id: orgId,
      code,
      matricule,
      student_id: student.id,
      academic_year: null,
      source_academic_year: sourceYear,
      legacy_reference: fullName.trim(),
    });

    if (insErr) {
      if (insErr.message.includes('duplicate') || insErr.message.includes('unique')) {
        skipped++;
        continue;
      }
      return { error: insErr.message };
    }
    created++;
  }

  return { created, skipped };
}



export async function getAcademicYearOverview(): Promise<

  { overview: AcademicYearOverview } | { error: string }

> {

  const orgId = await requireOrgId();

  const supabase = await createClient();



  const { data: org, error: orgErr } = await supabase

    .from('organizations')

    .select('settings, type')

    .eq('id', orgId)

    .single();



  if (orgErr) return { error: orgErr.message };

  if (org?.type !== 'school') return { error: 'Réservé aux établissements.' };



  const settings = parseSchoolOrgSettings((org.settings as Record<string, unknown>) ?? null);

  const currentYear = settings.default_academic_year;

  const concluded = isAcademicYearConcluded(currentYear, settings);



  const { data: classes } = await supabase

    .from('school_classes')

    .select('id')

    .eq('organization_id', orgId)

    .eq('academic_year', currentYear)

    .eq('is_active', true);



  const classIds = (classes ?? []).map((c) => c.id as string);



  let enrolledStudents = 0;

  if (classIds.length > 0) {

    const { count } = await supabase

      .from('school_students')

      .select('id', { count: 'exact', head: true })

      .eq('organization_id', orgId)

      .eq('enrollment_status', 'enrolled')

      .in('class_id', classIds);

    enrolledStudents = count ?? 0;

  }



  const { count: pendingCount } = await supabase

    .from('school_enrollments')

    .select('id', { count: 'exact', head: true })

    .eq('organization_id', orgId)

    .eq('academic_year', currentYear)

    .in('status', ['pending', 'admitted']);



  const concludedYearsList = [...settings.concluded_academic_years].sort((a, b) =>

    b.year.localeCompare(a.year)

  );

  const archiveMap = await loadArchivesForYears(

    orgId,

    concludedYearsList.map((y) => y.year)

  );



  return {

    overview: {

      currentYear,

      isCurrentYearConcluded: concluded,

      suggestedNextYear: nextAcademicYearLabel(currentYear),

      concludedYears: concludedYearsList.map((y) => ({

        ...y,

        archives: archiveMap.get(y.year) ?? [],

      })),

      stats: {

        activeClasses: classIds.length,

        enrolledStudents,

        pendingEnrollments: pendingCount ?? 0,

      },

    },

  };

}



export async function concludeAcademicYear(): Promise<

  { success: true; year: string; archivesCount: number } | { error: string }

> {

  const auth = await requireDirector();

  if ('error' in auth) return auth;



  const orgId = await requireOrgId();

  const supabase = await createClient();



  const { data: org, error: loadErr } = await supabase

    .from('organizations')

    .select('settings')

    .eq('id', orgId)

    .single();



  if (loadErr) return { error: loadErr.message };



  const settings = parseSchoolOrgSettings((org?.settings as Record<string, unknown>) ?? null);

  const year = settings.default_academic_year;



  if (!parseAcademicYearLabel(year)) {

    return { error: `Année scolaire invalide : ${year}` };

  }

  if (isAcademicYearConcluded(year, settings)) {

    return { error: `L'année ${year} est déjà clôturée.` };

  }



  const archiveResult = await persistYearArchives(orgId, year);

  if ('error' in archiveResult) return archiveResult;



  const nextSettings = mergeSchoolOrgSettingsPatch(

    (org?.settings as Record<string, unknown>) ?? null,

    {

      concluded_academic_years: [

        ...settings.concluded_academic_years,

        { year, concluded_at: new Date().toISOString() },

      ],

    }

  );



  const { error: saveErr } = await supabase

    .from('organizations')

    .update({ settings: nextSettings })

    .eq('id', orgId);



  if (saveErr) return { error: saveErr.message };



  revalidateAcademicYearPaths();

  return { success: true, year, archivesCount: archiveResult.count };

}



export async function startNewAcademicYear(params: {

  newYear: string;

  duplicateClasses?: boolean;

  generateReenrollmentCodes?: boolean;

}): Promise<

  | { success: true; year: string; classesCreated: number; reenrollmentCodesCreated: number }

  | { error: string }

> {

  const auth = await requireDirector();

  if ('error' in auth) return auth;



  const newYear = params.newYear?.trim();

  if (!newYear || !parseAcademicYearLabel(newYear)) {

    return { error: 'Indiquez une année au format AAAA-AAAA (ex. 2026-2027).' };

  }



  const orgId = await requireOrgId();

  const supabase = await createClient();



  const { data: org, error: loadErr } = await supabase

    .from('organizations')

    .select('settings')

    .eq('id', orgId)

    .single();



  if (loadErr) return { error: loadErr.message };



  const settings = parseSchoolOrgSettings((org?.settings as Record<string, unknown>) ?? null);

  const previousYear = settings.default_academic_year;



  if (!isAcademicYearConcluded(previousYear, settings)) {

    return {

      error: `Clôturez d'abord l'année ${previousYear} avant d'en ouvrir une nouvelle.`,

    };

  }



  const expectedNext = nextAcademicYearLabel(previousYear);

  if (expectedNext && newYear !== expectedNext) {

    const parsedNew = parseAcademicYearLabel(newYear);

    const parsedPrev = parseAcademicYearLabel(previousYear);

    if (parsedNew && parsedPrev && parsedNew.start <= parsedPrev.start) {

      return { error: `La nouvelle année doit être postérieure à ${previousYear}.` };

    }

  }



  if (newYear === previousYear) {

    return { error: 'La nouvelle année doit être différente de l\'année clôturée.' };

  }



  let classesCreated = 0;



  if (params.duplicateClasses !== false) {

    const { data: sourceClasses, error: srcErr } = await supabase

      .from('school_classes')

      .select('name, level, education_level_band, department, program, capacity, tuition_fee_gnf')

      .eq('organization_id', orgId)

      .eq('academic_year', previousYear)

      .order('name');



    if (srcErr) return { error: srcErr.message };



    if (sourceClasses && sourceClasses.length > 0) {

      const { data: existing } = await supabase

        .from('school_classes')

        .select('name')

        .eq('organization_id', orgId)

        .eq('academic_year', newYear)

        .eq('is_active', true);



      const existingNames = new Set((existing ?? []).map((c) => (c.name as string).trim()));



      const toInsert = sourceClasses

        .filter((c) => !existingNames.has((c.name as string).trim()))

        .map((c) => ({

          organization_id: orgId,

          name: c.name as string,

          level: (c.level as string) || null,

          education_level_band: (c.education_level_band as string) || null,

          department: (c.department as string) || null,

          program: (c.program as string) || null,

          academic_year: newYear,

          capacity: (c.capacity as number) ?? 40,

          tuition_fee_gnf: (c.tuition_fee_gnf as number) ?? null,

          is_active: true,

        }));



      if (toInsert.length > 0) {

        const { error: insErr } = await supabase.from('school_classes').insert(toInsert);

        if (insErr) return { error: insErr.message };

        classesCreated = toInsert.length;

      }

    }

  }



  let reenrollmentCodesCreated = 0;

  if (params.generateReenrollmentCodes !== false) {

    const codeResult = await generateReenrollmentCodesFromPriorYear(

      orgId,

      previousYear,

      newYear

    );

    if ('error' in codeResult) return codeResult;

    reenrollmentCodesCreated = codeResult.created;

  }



  const nextSettings = mergeSchoolOrgSettingsPatch(

    (org?.settings as Record<string, unknown>) ?? null,

    { default_academic_year: newYear }

  );



  const { error: saveErr } = await supabase

    .from('organizations')

    .update({ settings: nextSettings })

    .eq('id', orgId);



  if (saveErr) return { error: saveErr.message };



  revalidateAcademicYearPaths();

  return { success: true, year: newYear, classesCreated, reenrollmentCodesCreated };

}



export async function downloadAcademicYearArchive(

  archiveId: string

): Promise<

  | { fileName: string; content: string; contentType: string }

  | { error: string }

> {

  const auth = await requireDirector();

  if ('error' in auth) return auth;



  const orgId = await requireOrgId();

  const supabase = await createClient();



  const { data, error } = await supabase

    .from('school_academic_year_archives')

    .select('file_name, content, content_type, organization_id')

    .eq('id', archiveId)

    .eq('organization_id', orgId)

    .single();



  if (error) return { error: error.message };

  if (!data) return { error: 'Archive introuvable.' };



  return {

    fileName: data.file_name as string,

    content: data.content as string,

    contentType: (data.content_type as string) || 'text/csv',

  };

}



export async function downloadReenrollmentCodesCsv(

  targetYear?: string

): Promise<{ fileName: string; content: string } | { error: string }> {

  const auth = await requireDirector();

  if ('error' in auth) return auth;



  const orgId = await requireOrgId();

  const supabase = await createClient();



  const { data: org } = await supabase

    .from('organizations')

    .select('settings')

    .eq('id', orgId)

    .single();



  const year =

    targetYear?.trim() ||

    parseSchoolOrgSettings((org?.settings as Record<string, unknown>) ?? null)

      .default_academic_year;



  const { data: codes, error } = await supabase
    .from('school_reenrollment_codes')
    .select(
      'code, matricule, legacy_reference, source_academic_year, academic_year, is_active, used_at, created_at'
    )
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .or(`academic_year.is.null,academic_year.eq.${year}`)
    .order('legacy_reference');



  if (error) return { error: error.message };



  const header = 'code;matricule;eleve;annee_origine;type;statut;cree_le';

  const rows = (codes ?? []).map((c) => {
    const permanent = !c.academic_year;
    const status = permanent ? 'permanent' : c.used_at ? 'utilise' : c.is_active ? 'actif' : 'inactif';

    return [
      c.code,
      c.matricule ?? '',
      c.legacy_reference ?? '',
      c.source_academic_year ?? '',
      permanent ? 'permanent' : 'annuel',
      status,
      c.created_at ?? '',
    ]

      .map((v) => {

        const s = String(v ?? '');

        return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;

      })

      .join(';');

  });



  return {

    fileName: `codes-reinscription-${year}.csv`,

    content: [header, ...rows].join('\n'),

  };

}


