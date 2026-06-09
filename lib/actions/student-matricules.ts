'use server';

import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/actions/auth';
import { requireOrgId } from '@/lib/actions/org';
import { revalidatePath } from 'next/cache';
import { getEtablissementCapabilities } from '@/lib/school/etablissement-access';
import { personName, personEmail, STUDENT_WITH_PERSON } from '@/lib/school/person-utils';
import type { StudentImportRow } from '@/lib/school/student-import';
import {
  buildMatriculeExportCsv,
  parseStudentMatriculeSettings,
  type MatriculeExportRow,
  type StudentMatriculeSettings,
} from '@/lib/school/student-matricules';

function canConfigureMatricules(role: string | undefined): boolean {
  if (role === 'platform_admin') return true;
  const caps = getEtablissementCapabilities(role);
  return caps.isDirector || role === 'registrar';
}

export async function getStudentMatriculeSettings(): Promise<{
  settings: StudentMatriculeSettings;
  error?: string;
}> {
  const session = await getSession();
  const orgId = session?.profile?.organization_id;
  if (!orgId) {
    return { settings: parseStudentMatriculeSettings(null), error: 'Aucune organisation' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('school_student_matricule_settings', {
    p_org_id: orgId,
  });
  if (error) return { settings: parseStudentMatriculeSettings(null), error: error.message };
  return { settings: parseStudentMatriculeSettings(data) };
}

export async function updateStudentMatriculeSettings(settings: StudentMatriculeSettings) {
  const session = await getSession();
  if (!canConfigureMatricules(session?.profile?.role)) {
    return { error: 'Non autorisé' };
  }
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const { error } = await supabase.rpc('update_school_student_matricule_settings', {
    p_org_id: orgId,
    p_settings: settings,
  });
  if (error) return { error: error.message };
  revalidatePath('/parametres/codes-eleves');
  revalidatePath('/etablissement/etudiants/import');
  return { success: true as const };
}

/** Aperçu cohérent avec l'import (même RPC SQL, sans incrément persistant). */
export async function previewImportMatricules(
  classId: string,
  rows: StudentImportRow[]
): Promise<{ rows: StudentImportRow[]; error?: string }> {
  const session = await getSession();
  const caps = getEtablissementCapabilities(session?.profile?.role);
  if (!caps.manageStudents) return { rows, error: 'Non autorisé' };

  const orgId = await requireOrgId();
  const { settings } = await getStudentMatriculeSettings();
  if (!settings.auto_generate_on_import) return { rows };

  const needCount = rows.filter((r) => !r.matricule?.trim()).length;
  if (!needCount || !classId) return { rows };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('preview_school_student_matricules', {
    p_org_id: orgId,
    p_class_id: classId,
    p_count: needCount,
  });
  if (error) return { rows, error: error.message };

  const generated = (data as string[] | null) ?? [];
  let gi = 0;
  const enriched = rows.map((row) => {
    if (row.matricule?.trim()) return row;
    const code = generated[gi];
    gi += 1;
    return code ? { ...row, matricule: code } : row;
  });

  return { rows: enriched };
}

export async function exportStudentMatriculesCsv(): Promise<
  { csv: string; fileName: string } | { error: string }
> {
  const session = await getSession();
  const caps = getEtablissementCapabilities(session?.profile?.role);
  if (!caps.manageStudents) return { error: 'Non autorisé' };

  const orgId = await requireOrgId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('school_students')
    .select(`${STUDENT_WITH_PERSON}, school_classes(name)`)
    .eq('organization_id', orgId)
    .not('matricule', 'is', null)
    .order('matricule', { ascending: true });

  if (error) return { error: error.message };

  const exportRows: MatriculeExportRow[] = (data ?? []).map((s) => {
    const person = (s.core_persons ?? {}) as Record<string, unknown>;
    return {
      matricule: String(s.matricule ?? '').trim(),
      full_name: personName(s),
      class_name: String((s.school_classes as { name?: string } | null)?.name ?? '—'),
      phone: person.phone != null ? String(person.phone) : null,
      email: personEmail(s) || null,
    };
  });

  const csv = buildMatriculeExportCsv(exportRows);
  const date = new Date().toISOString().slice(0, 10);
  return { csv, fileName: `codes-eleves-konadata-${date}.csv` };
}

export interface MatriculeAssignClassBreakdown {
  classId: string | null;
  className: string;
  count: number;
  assignable: number;
}

export interface BulkAssignMatriculesResult {
  assigned: number;
  skipped_no_class: number;
  skipped_race: number;
}

export async function getStudentsWithoutMatriculeSummary(): Promise<{
  total: number;
  assignable: number;
  byClass: MatriculeAssignClassBreakdown[];
  error?: string;
}> {
  const session = await getSession();
  const caps = getEtablissementCapabilities(session?.profile?.role);
  if (!caps.manageStudents) {
    return { total: 0, assignable: 0, byClass: [], error: 'Non autorisé' };
  }

  const orgId = await requireOrgId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('school_students')
    .select('id, class_id, matricule, school_classes(name)')
    .eq('organization_id', orgId);

  if (error) return { total: 0, assignable: 0, byClass: [], error: error.message };

  const without = (data ?? []).filter((s) => !String(s.matricule ?? '').trim());
  const byClassMap = new Map<string, MatriculeAssignClassBreakdown>();

  for (const s of without) {
    const classId = (s.class_id as string | null) ?? null;
    const key = classId ?? '__none__';
    const className = classId
      ? String((s.school_classes as { name?: string } | null)?.name ?? 'Classe')
      : 'Sans classe';
    const prev = byClassMap.get(key) ?? {
      classId,
      className,
      count: 0,
      assignable: 0,
    };
    prev.count += 1;
    if (classId) prev.assignable += 1;
    byClassMap.set(key, prev);
  }

  const byClass = Array.from(byClassMap.values()).sort((a, b) =>
    a.className.localeCompare(b.className, 'fr')
  );

  return {
    total: without.length,
    assignable: without.filter((s) => s.class_id).length,
    byClass,
  };
}

/** Attribution en masse — ne modifie jamais un code déjà présent. */
export async function assignMatriculesBulk(
  classId?: string | null
): Promise<BulkAssignMatriculesResult | { error: string }> {
  const session = await getSession();
  const caps = getEtablissementCapabilities(session?.profile?.role);
  if (!caps.manageStudents) return { error: 'Non autorisé' };

  const orgId = await requireOrgId();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('assign_school_student_matricules_batch', {
    p_org_id: orgId,
    p_class_id: classId || null,
  });

  if (error) return { error: error.message };

  const o = (data ?? {}) as Record<string, unknown>;
  const result: BulkAssignMatriculesResult = {
    assigned: Number(o.assigned ?? 0),
    skipped_no_class: Number(o.skipped_no_class ?? 0),
    skipped_race: Number(o.skipped_race ?? 0),
  };

  revalidatePath('/etablissement');
  revalidatePath('/etablissement/etudiants');
  revalidatePath('/etablissement/paiements');
  revalidatePath('/payer-scolarite');

  return result;
}

/** Alloue un matricule serveur (ne remplace jamais un matricule existant). */
export async function allocateMatriculeForClass(
  classId: string
): Promise<{ matricule: string } | { error: string }> {
  const session = await getSession();
  const caps = getEtablissementCapabilities(session?.profile?.role);
  if (!caps.manageStudents) return { error: 'Non autorisé' };

  const orgId = await requireOrgId();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('allocate_school_student_matricule', {
    p_org_id: orgId,
    p_class_id: classId,
    p_commit: true,
  });
  if (error) return { error: error.message };
  if (!data) return { error: 'Allocation impossible' };
  return { matricule: String(data) };
}
