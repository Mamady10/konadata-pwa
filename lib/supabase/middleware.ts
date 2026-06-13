import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  isCrossSectorPath,
  sectorHomeFromOrgType,
} from '@/lib/sector/post-login';
import {
  canAccessBtpPath,
  getBtpFallbackPath,
  isBtpDirector,
} from '@/lib/btp/btp-access';
import {
  canAccessPmePath,
  getPmeFallbackPath,
  isPmeDirector,
} from '@/lib/pme/pme-access';
import {
  canAccessOngPath,
  getOngFallbackPath,
  isOngDirector,
} from '@/lib/ong/ong-access';
import {
  canAccessEtablissementPath,
  getEtablissementFallbackPath,
  isSchoolStaffRole,
} from '@/lib/school/etablissement-access';
import type { AppRole } from '@/types/database';
import {
  learnerHasEnrollmentHistory,
  learnerNeedsSchoolOnboarding,
  isLearnerRole,
} from '@/lib/auth/learner-enrollments';
import { isOrganizationMemberRole } from '@/lib/auth/org-member-roles';
import {
  isDirectorOnboardingPath,
  isDirectorOrStaffIntent,
} from '@/lib/auth/account-intent';
import { resolvePostAuthDestination } from '@/lib/auth/post-auth-redirect';
import {
  isSurveyOnlyAllowedPath,
  isSurveyOnlyOrg,
} from '@/lib/org/survey-only-access';
import { isBillingExemptPath, BILLING_HOME_PATH } from '@/lib/billing/billing-paths';
import { isPublicApiPath } from '@/lib/http/public-api-routes';

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const isAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password');

  const isRegisterCandidat = pathname.startsWith('/register/candidat');

  const isLearnerOnboarding =
    pathname.startsWith('/inscription-etablissement') ||
    pathname.startsWith('/corriger-parcours');
  const isOnboardingRoute =
    pathname.startsWith('/rejoindre') || isLearnerOnboarding;

  const isPublicRoute =
    isAuthRoute ||
    isOnboardingRoute ||
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/auth/confirm') ||
    isPublicApiPath(pathname) ||
    pathname.startsWith('/participation-ong') ||
    pathname.startsWith('/paiement-sondage') ||
    pathname.startsWith('/payer-scolarite') ||
    pathname.startsWith('/suivi-scolarite') ||
    pathname === '/';

  const isProtectedRoute =
    !isPublicRoute &&
    !pathname.startsWith('/_next') &&
    !pathname.startsWith('/icons') &&
    !pathname.startsWith('/sw.js') &&
    !pathname.endsWith('.json') &&
    !pathname.endsWith('.html') &&
    !pathname.endsWith('.png');

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  if (user) {
    const accountIntent = (user.user_metadata?.account_intent as string) || '';

    let { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, role, onboarding_path, organizations(type)')
      .eq('id', user.id)
      .single();

    const isStaffIntent =
      isDirectorOrStaffIntent(accountIntent) ||
      isDirectorOnboardingPath(profile?.onboarding_path as string | undefined);

    const isLearnerPath =
      !isStaffIntent &&
      (accountIntent === 'learner' || profile?.onboarding_path === 'learner');

    const orgType = (profile?.organizations as { type?: string } | null)?.type;

    if (isStaffIntent && pathname.startsWith('/inscription-etablissement')) {
      const url = request.nextUrl.clone();
      url.pathname = profile?.organization_id ? sectorHomeFromOrgType(orgType) : '/rejoindre';
      if (!profile?.organization_id) url.searchParams.set('profil', 'directeur');
      return NextResponse.redirect(url);
    }

    const { data: historyRpc } = await supabase.rpc('learner_has_enrollment_history');
    const hasEnrollmentHistory =
      typeof historyRpc === 'boolean'
        ? historyRpc
        : await learnerHasEnrollmentHistory(supabase, user.id);

    if (pathname === '/' && request.nextUrl.searchParams.get('accueil') !== '1') {
      const dest = resolvePostAuthDestination({
        organizationId: profile?.organization_id,
        role: profile?.role as AppRole,
        orgType,
        accountIntent,
        onboardingPath: profile?.onboarding_path as string | undefined,
        hasEnrollmentHistory,
      });
      const url = request.nextUrl.clone();
      url.pathname = dest.split('?')[0] || dest;
      const qs = dest.includes('?') ? dest.slice(dest.indexOf('?')) : '';
      if (qs) {
        new URLSearchParams(qs.slice(1)).forEach((v, k) => url.searchParams.set(k, v));
      }
      return NextResponse.redirect(url);
    }

    const isOrgMember =
      isOrganizationMemberRole(profile?.role as AppRole) ||
      (isStaffIntent && Boolean(profile?.organization_id));

    const learnerOnboarding =
      !isOrgMember &&
      !isStaffIntent &&
      (isLearnerPath ||
        isLearnerRole(profile?.role) ||
        profile?.role === 'candidate' ||
        profile?.role === 'student');

    const learnerNeedsPicker = learnerNeedsSchoolOnboarding({
      role: profile?.role,
      organizationId: profile?.organization_id,
      accountIntent,
      onboardingPath: profile?.onboarding_path as string | undefined,
      hasEnrollmentHistory,
    });

    const needsOnboarding =
      profile?.role !== 'platform_admin' &&
      !profile?.organization_id &&
      !(learnerOnboarding && hasEnrollmentHistory);

    const learnerPortalOnly =
      !isSchoolStaffRole(profile?.role as AppRole) &&
      learnerOnboarding &&
      (Boolean(profile?.organization_id) || hasEnrollmentHistory);

    if (learnerPortalOnly && pathname.startsWith('/etablissement')) {
      if (pathname.startsWith('/etablissement/candidatures')) {
        return supabaseResponse;
      }
      const url = request.nextUrl.clone();
      url.pathname = '/etablissement/candidatures';
      return NextResponse.redirect(url);
    }

    if (learnerNeedsPicker && pathname.startsWith('/etablissement')) {
      const url = request.nextUrl.clone();
      url.pathname = '/inscription-etablissement';
      return NextResponse.redirect(url);
    }

    if (needsOnboarding && isProtectedRoute && !isOnboardingRoute) {
      const url = request.nextUrl.clone();
      url.pathname =
        accountIntent === 'staff'
          ? '/rejoindre'
          : learnerNeedsPicker
            ? '/inscription-etablissement'
            : '/rejoindre';
      return NextResponse.redirect(url);
    }

    if (isAuthRoute && !pathname.startsWith('/reset-password') && !isRegisterCandidat) {
      if (
        pathname.startsWith('/login') &&
        request.nextUrl.searchParams.get('switch') === '1'
      ) {
        return supabaseResponse;
      }

      const url = request.nextUrl.clone();
      if (isStaffIntent && !profile?.organization_id) {
        url.pathname = '/rejoindre';
        url.searchParams.set('profil', 'directeur');
      } else if (isStaffIntent || isOrgMember) {
        url.pathname = sectorHomeFromOrgType(orgType);
      } else if (learnerNeedsPicker) {
        url.pathname = '/inscription-etablissement';
      } else if (needsOnboarding) {
        url.pathname = '/rejoindre';
      } else if (learnerOnboarding) {
        url.pathname = '/etablissement/candidatures';
      } else {
        url.pathname = sectorHomeFromOrgType(orgType);
      }
      return NextResponse.redirect(url);
    }

    if (
      !needsOnboarding &&
      profile?.role !== 'platform_admin' &&
      isProtectedRoute &&
      orgType &&
      isCrossSectorPath(pathname, orgType)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = sectorHomeFromOrgType(orgType);
      return NextResponse.redirect(url);
    }

    if (
      !needsOnboarding &&
      orgType === 'school' &&
      pathname.startsWith('/etablissement') &&
      profile?.role &&
      !canAccessEtablissementPath(profile.role as AppRole, pathname)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = getEtablissementFallbackPath(profile.role as AppRole);
      return NextResponse.redirect(url);
    }

    if (
      !needsOnboarding &&
      orgType === 'ngo' &&
      profile?.organization_id &&
      pathname.startsWith('/ong')
    ) {
      const { data: surveyOnlyOrg } = await supabase
        .from('organizations')
        .select('settings')
        .eq('id', profile.organization_id)
        .maybeSingle();

      if (isSurveyOnlyOrg(surveyOnlyOrg?.settings)) {
        if (pathname === '/ong' || pathname === '/ong/') {
          const url = request.nextUrl.clone();
          url.pathname = '/ong/sondages';
          return NextResponse.redirect(url);
        }
        if (!isSurveyOnlyAllowedPath(pathname)) {
          const url = request.nextUrl.clone();
          url.pathname = '/ong/sondages';
          return NextResponse.redirect(url);
        }
      }
    }

    if (
      !needsOnboarding &&
      orgType === 'ngo' &&
      pathname.startsWith('/ong') &&
      profile?.role &&
      !canAccessOngPath(profile.role as AppRole, pathname)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = getOngFallbackPath(profile.role as AppRole);
      return NextResponse.redirect(url);
    }

    if (
      !needsOnboarding &&
      orgType === 'btp' &&
      pathname.startsWith('/btp') &&
      profile?.role &&
      !canAccessBtpPath(profile.role as AppRole, pathname)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = getBtpFallbackPath(profile.role as AppRole);
      return NextResponse.redirect(url);
    }

    if (
      !needsOnboarding &&
      orgType === 'business' &&
      pathname.startsWith('/pme') &&
      profile?.role &&
      !canAccessPmePath(profile.role as AppRole, pathname)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = getPmeFallbackPath(profile.role as AppRole);
      return NextResponse.redirect(url);
    }

    if (
      !needsOnboarding &&
      orgType === 'ngo' &&
      pathname.startsWith('/utilisateurs') &&
      profile?.role &&
      !isOngDirector(profile.role as AppRole)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = getOngFallbackPath(profile.role as AppRole);
      return NextResponse.redirect(url);
    }

    if (
      !needsOnboarding &&
      orgType === 'btp' &&
      pathname.startsWith('/utilisateurs') &&
      profile?.role &&
      !isBtpDirector(profile.role as AppRole)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = getBtpFallbackPath(profile.role as AppRole);
      return NextResponse.redirect(url);
    }

    if (
      !needsOnboarding &&
      orgType === 'business' &&
      pathname.startsWith('/utilisateurs') &&
      profile?.role &&
      !isPmeDirector(profile.role as AppRole)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = getPmeFallbackPath(profile.role as AppRole);
      return NextResponse.redirect(url);
    }

    const learnerPortalPath =
      pathname.startsWith('/etablissement/candidatures') ||
      pathname.startsWith('/inscription-etablissement') ||
      pathname.startsWith('/corriger-parcours');

    if (
      !needsOnboarding &&
      profile?.organization_id &&
      profile?.role !== 'platform_admin' &&
      isProtectedRoute &&
      !isBillingExemptPath(pathname) &&
      !learnerPortalPath &&
      !pathname.startsWith('/paiement-organisation') &&
      !pathname.startsWith('/paiement-scolarite')
    ) {
      const { data: orgRow } = await supabase
        .from('organizations')
        .select('billing_status')
        .eq('id', profile.organization_id)
        .maybeSingle();

      if (
        orgRow?.billing_status === 'pending_payment' ||
        orgRow?.billing_status === 'pending_renewal'
      ) {
        const url = request.nextUrl.clone();
        url.pathname = BILLING_HOME_PATH;
        url.searchParams.set('blocked', '1');
        return NextResponse.redirect(url);
      }

      const { data: billingOk } = await supabase.rpc('organization_platform_access_ok', {
        p_org_id: profile.organization_id,
      });
      if (billingOk === false) {
        const url = request.nextUrl.clone();
        url.pathname = BILLING_HOME_PATH;
        url.searchParams.set('blocked', '1');
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
