'use server';

import { createClient } from '@/lib/supabase/server';

/** Directeur, adjoint, scolarité — pas les enseignants. */
export async function canManageSchoolCatalog(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('can_manage_school_catalog');
  if (error) return false;
  return Boolean(data);
}
