import { getSchoolOnboardingStatus } from '@/lib/actions/school-onboarding';
import { showSchoolOnboardingChecklist } from '@/lib/school/onboarding-ui';
import { SchoolOnboardingChecklist } from '@/components/school/school-onboarding-checklist';
import type { AppRole } from '@/types/database';

interface Props {
  role: AppRole | string | undefined;
  compact?: boolean;
}

export async function SchoolOnboardingPanel({ role, compact }: Props) {
  if (!showSchoolOnboardingChecklist(role)) return null;

  const { status } = await getSchoolOnboardingStatus();
  if (!status) return null;

  if (status.completedCount === status.totalCount && status.accessAllowed) {
    return null;
  }

  return <SchoolOnboardingChecklist onboarding={status} compact={compact} />;
}
