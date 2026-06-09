import { getSession } from '@/lib/actions/auth';
import { getAcademicYearOverview } from '@/lib/actions/academic-year';
import {
  getAcademicYearFeeSetup,
  type AcademicYearFeeSetup,
} from '@/lib/actions/academic-year-fees';
import { redirect } from 'next/navigation';
import { AnneeScolaireClient } from './annee-scolaire-client';

export default async function AnneeScolairePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const orgType = (session.profile?.organizations as { type?: string } | null)?.type;
  if (orgType !== 'school') redirect('/parametres');

  const role = session.profile?.role;
  const canManage =
    role === 'org_admin' || role === 'platform_admin' || role === 'deputy_director';

  const overviewResult = await getAcademicYearOverview();
  const overview = 'overview' in overviewResult ? overviewResult.overview : null;
  const loadError = 'error' in overviewResult ? overviewResult.error : undefined;

  let feeSetup: AcademicYearFeeSetup | null = null;
  let feeLoadError: string | undefined;
  let feePrepNextYear = false;

  if (canManage && overview) {
    const feeYear = overview.isCurrentYearConcluded
      ? overview.suggestedNextYear
      : overview.currentYear;
    feePrepNextYear = Boolean(overview.isCurrentYearConcluded && overview.suggestedNextYear);
    if (feeYear) {
      const feeResult = await getAcademicYearFeeSetup(feeYear);
      feeSetup = 'setup' in feeResult ? feeResult.setup : null;
      feeLoadError = 'error' in feeResult ? feeResult.error : undefined;
    }
  }

  return (
    <AnneeScolaireClient
      overview={overview}
      loadError={loadError}
      canManage={canManage}
      orgName={(session.profile?.organizations as { name?: string } | null)?.name ?? ''}
      feeSetup={feeSetup}
      feeLoadError={feeLoadError}
      feePrepNextYear={feePrepNextYear}
    />
  );
}
