import { redirect } from 'next/navigation';
import { getSession } from '@/lib/actions/auth';
import type { AppRole } from '@/types/database';
import {
  canAccessPmePage,
  getPmeFallbackPath,
  type PmePage,
} from '@/lib/pme/pme-access';

export async function requirePmePage(page: PmePage) {
  const session = await getSession();
  if (!session) redirect('/login');

  const role = session.profile?.role as AppRole | undefined;
  if (!canAccessPmePage(role, page)) {
    redirect(getPmeFallbackPath(role));
  }

  return session;
}
