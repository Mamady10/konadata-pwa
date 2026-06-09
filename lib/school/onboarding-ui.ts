import type { AppRole } from '@/types/database';
import { isEtablissementDirector } from '@/lib/school/etablissement-access';

export function showSchoolOnboardingChecklist(role: AppRole | string | undefined): boolean {
  return isEtablissementDirector(role) || role === 'registrar' || role === 'platform_admin';
}
