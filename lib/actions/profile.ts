'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non authentifié' };

  const full_name = (formData.get('full_name') as string)?.trim();
  const phone = (formData.get('phone') as string)?.trim();

  if (!full_name) return { error: 'Le nom est requis' };

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name,
      phone: phone || null,
    })
    .eq('id', user.id);

  if (error) return { error: error.message };

  revalidatePath('/parametres');
  return { success: true };
}

export async function getOrgProfiles(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, is_active, last_login_at, created_at')
    .eq('organization_id', orgId)
    .order('full_name');
  if (error) throw error;
  return data ?? [];
}
