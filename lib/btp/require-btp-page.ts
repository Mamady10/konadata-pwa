import { redirect } from 'next/navigation';
import { getSession } from '@/lib/actions/auth';
import type { AppRole } from '@/types/database';
import {
  canAccessBtpPage,
  getBtpFallbackPath,
  type BtpPage,
} from '@/lib/btp/btp-access';

export async function requireBtpPage(page: BtpPage) {
  const session = await getSession();
  if (!session) redirect('/login');

  const role = session.profile?.role as AppRole | undefined;
  if (!canAccessBtpPage(role, page)) {
    redirect(getBtpFallbackPath(role));
  }

  return session;
}
