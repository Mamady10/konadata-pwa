import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

/** Session dédupliquée par requête (layout + pages). */
export const getCachedSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, organizations(*)')
    .eq('id', user.id)
    .single();

  return { user, profile };
});
