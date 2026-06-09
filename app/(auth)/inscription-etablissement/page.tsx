import { redirect } from 'next/navigation';
import { getSession } from '@/lib/actions/auth';
import { createClient } from '@/lib/supabase/server';
import { InscriptionWizard } from './inscription-wizard';
import { sectorHomeFromOrgType } from '@/lib/sector/post-login';
import { getOrgType } from '@/types/database';
import type { Organization } from '@/types/database';
import { learnerHasEnrollmentHistory, isLearnerRole } from '@/lib/auth/learner-enrollments';
import { isDirectorOrStaffIntent } from '@/lib/auth/account-intent';

export default async function InscriptionEtablissementPage({
  searchParams,
}: {
  searchParams: Promise<{ nouvelle?: string }>;
}) {
  const session = await getSession();
  const { nouvelle } = await searchParams;
  const isNewApplication = nouvelle === '1';

  if (!session?.user) {
    redirect('/register/candidat');
  }

  const accountIntent = session.user.user_metadata?.account_intent as string | undefined;
  if (isDirectorOrStaffIntent(accountIntent)) {
    redirect(session.profile?.organization_id ? '/mon-espace' : '/rejoindre?profil=directeur');
  }

  const profile = session.profile;
  const role = profile?.role as string | undefined;
  const onboardingPath = (profile as { onboarding_path?: string })?.onboarding_path;
  const isLearner =
    isLearnerRole(role) || role === 'candidate' || onboardingPath === 'learner';

  if (!isNewApplication && isLearner) {
    const supabase = await createClient();
    const hasHistory = await learnerHasEnrollmentHistory(supabase, session.user.id);
    if (profile?.organization_id || hasHistory) {
      redirect('/etablissement/candidatures');
    }
  }

  if (!isNewApplication && profile?.organization_id) {
    const org = profile.organizations as Organization | null;
    redirect(sectorHomeFromOrgType(getOrgType(org)));
  }

  return <InscriptionWizard isNewApplication={isNewApplication} />;
}
