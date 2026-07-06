import type { AppRole, OrganizationType } from '@/types/database';
import { resolvePostLoginRedirect, sectorHomeFromOrgType } from '@/lib/sector/post-login';
import { LANDING_LINKS } from '@/lib/marketing/landing-links';
import { learnerNeedsSchoolOnboarding } from '@/lib/auth/learner-enrollments';
import {
  isLearnerOnlyRedirect,
  isOrganizationMemberRole,
} from '@/lib/auth/org-member-roles';
import {
  isDirectorOnboardingPath,
  isDirectorOrStaffIntent,
  isLearnerIntent,
} from '@/lib/auth/account-intent';

const LEARNER_ROLES = new Set<AppRole>(['candidate', 'student']);

const LEARNER_HOME = '/etablissement/candidatures';

const STAFF_ROLES_WITH_ORG = new Set<AppRole>([
  'org_admin',
  'deputy_director',
  'registrar',
  'accountant',
  'teacher',
  'ngo_staff',
  'btp_staff',
  'pme_staff',
]);

function isSafeInternalRedirect(path: string): boolean {
  return (
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !path.includes('..') &&
    !path.startsWith('/login') &&
    !path.startsWith('/register')
  );
}

/** A une organisation et un rôle métier (même si metadata candidat). */
export function hasStaffAccessToOrg(
  role: AppRole | string | undefined,
  organizationId: string | null | undefined,
  accountIntent?: string | null,
  onboardingPath?: string | null
): boolean {
  if (!organizationId) return false;
  if (isDirectorOrStaffIntent(accountIntent) || isDirectorOnboardingPath(onboardingPath)) {
    return true;
  }
  if (isOrganizationMemberRole(role)) return true;
  if (role && STAFF_ROLES_WITH_ORG.has(role as AppRole)) return true;
  return false;
}

function isStaffProfile(
  accountIntent?: string | null,
  onboardingPath?: string | null
): boolean {
  return isDirectorOrStaffIntent(accountIntent) || isDirectorOnboardingPath(onboardingPath);
}

export function isLearnerAccount(
  role: AppRole | string | undefined,
  accountIntent?: string | null,
  onboardingPath?: string | null
): boolean {
  if (isStaffProfile(accountIntent, onboardingPath)) return false;
  if (isOrganizationMemberRole(role)) return false;
  if (role && STAFF_ROLES_WITH_ORG.has(role as AppRole)) return false;
  if (onboardingPath === 'learner') return true;
  if (accountIntent === 'learner') return true;
  return LEARNER_ROLES.has(role as AppRole);
}

/** Destination après connexion ou création de compte. */
export function resolvePostAuthDestination(options: {
  organizationId: string | null | undefined;
  role: AppRole | string | undefined;
  orgType?: OrganizationType | string | null;
  accountIntent?: string | null;
  onboardingPath?: string | null;
  redirectParam?: string | null;
  hasEnrollmentHistory?: boolean;
}): string {
  const {
    organizationId,
    role,
    orgType,
    accountIntent,
    onboardingPath,
    redirectParam,
    hasEnrollmentHistory = false,
  } = options;

  if (role === 'platform_admin') {
    return '/dashboard';
  }

  if (isStaffProfile(accountIntent, onboardingPath)) {
    if (!organizationId) {
      return `${LANDING_LINKS.rejoindre}?profil=directeur`;
    }
    const redirect = redirectParam?.trim() ?? '';
    if (redirect && isLearnerOnlyRedirect(redirect)) {
      return resolvePostLoginRedirect('', orgType ?? undefined);
    }
    return resolvePostLoginRedirect(redirectParam ?? '', orgType ?? undefined);
  }

  if (
    organizationId &&
    !isLearnerIntent(accountIntent) &&
    onboardingPath !== 'learner' &&
    hasStaffAccessToOrg(role, organizationId, accountIntent, onboardingPath)
  ) {
    const redirect = redirectParam?.trim() ?? '';
    if (redirect && isLearnerOnlyRedirect(redirect)) {
      return sectorHomeFromOrgType(orgType ?? undefined);
    }
    return resolvePostLoginRedirect(redirectParam ?? '', orgType ?? undefined);
  }

  const learner = isLearnerAccount(role, accountIntent, onboardingPath);

  if (
    learnerNeedsSchoolOnboarding({
      role,
      organizationId,
      accountIntent,
      onboardingPath,
      hasEnrollmentHistory,
    })
  ) {
    return LANDING_LINKS.inscriptionEtablissement;
  }

  if (learner && (organizationId || hasEnrollmentHistory)) {
    const redirect = redirectParam?.trim() ?? '';
    if (
      redirect &&
      isSafeInternalRedirect(redirect) &&
      !redirect.startsWith('/inscription-etablissement')
    ) {
      return redirect;
    }
    return LEARNER_HOME;
  }

  if (!organizationId) {
    return LANDING_LINKS.rejoindre;
  }

  return resolvePostLoginRedirect(redirectParam ?? '', orgType ?? undefined);
}
