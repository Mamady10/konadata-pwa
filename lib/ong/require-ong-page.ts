import { redirect } from 'next/navigation';
import { getSession } from '@/lib/actions/auth';
import type { AppRole } from '@/types/database';
import {
  canAccessOngPage,
  getOngFallbackPath,
  type OngPage,
} from '@/lib/ong/ong-access';

export async function requireOngPage(page: OngPage) {
  const session = await getSession();
  if (!session) redirect('/login');

  const role = session.profile?.role as AppRole | undefined;
  if (!canAccessOngPage(role, page)) {
    redirect(getOngFallbackPath(role));
  }

  return session;
}
