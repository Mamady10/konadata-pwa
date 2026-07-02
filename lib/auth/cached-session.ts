import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

/** Session dédupliquée par requête (layout + pages).
 * getClaims() vérifie le JWT localement (clés asymétriques) au lieu d'un appel
 * réseau au serveur Auth — plus rapide sur chaque rendu de page. */
export const getCachedSession = cache(async () => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as
    | {
        sub?: string;
        email?: string;
        phone?: string;
        user_metadata?: Record<string, unknown>;
        app_metadata?: Record<string, unknown>;
      }
    | undefined;
  if (!claims?.sub) return null;

  const user = {
    id: claims.sub,
    email: claims.email ?? '',
    phone: claims.phone ?? '',
    user_metadata: claims.user_metadata ?? {},
    app_metadata: claims.app_metadata ?? {},
  };

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, organizations(*)')
    .eq('id', user.id)
    .single();

  return { user, profile };
});
