import type { SupabaseClient } from '@supabase/supabase-js';

/** Vérifie un code ou matricule de réinscription pour l'année cible. */
export async function verifyReenrollmentCode(
  supabase: SupabaseClient,
  orgId: string,
  code: string,
  targetAcademicYear: string
): Promise<{ verified: boolean; codeId?: string; permanent?: boolean }> {
  const norm = code.trim().toUpperCase();
  if (norm.length < 4) return { verified: false };

  const { data: rows } = await supabase
    .from('school_reenrollment_codes')
    .select('id, academic_year, is_active, used_at')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .or(`code.eq.${norm},matricule.eq.${norm}`);

  for (const row of rows ?? []) {
    const year = (row.academic_year as string) || null;
    const permanent = !year;

    if (permanent) {
      return { verified: true, codeId: row.id as string, permanent: true };
    }

    if (year === targetAcademicYear && !row.used_at) {
      return { verified: true, codeId: row.id as string, permanent: false };
    }
  }

  return { verified: false };
}
