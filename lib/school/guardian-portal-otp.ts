import type { createServiceClient } from '@/lib/supabase/server';

type Supabase = Awaited<ReturnType<typeof createServiceClient>>;

export async function resolveStudentIdByMatricule(
  supabase: Supabase,
  orgId: string,
  matricule: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc('resolve_school_student_by_matricule', {
    p_org_id: orgId,
    p_matricule: matricule.trim(),
  });
  if (error || !data) return null;
  return String(data);
}
