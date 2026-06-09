import { redirect } from 'next/navigation';
import { getSession } from '@/lib/actions/auth';
import type { AppRole } from '@/types/database';
import {
  canAccessEtablissementPage,
  getEtablissementFallbackPath,
  type EtablissementPage,
} from '@/lib/school/etablissement-access';

/** Garde serveur : redirige si le rôle n'a pas accès à cette page. */
export async function requireEtablissementPage(page: EtablissementPage) {
  const session = await getSession();
  if (!session) redirect('/login');

  const role = session.profile?.role as AppRole | undefined;
  if (!canAccessEtablissementPage(role, page)) {
    redirect(getEtablissementFallbackPath(role));
  }

  return session;
}
