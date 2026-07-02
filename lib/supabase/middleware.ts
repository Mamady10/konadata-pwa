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
import {
  AUTHZ_COOKIE,
  AUTHZ_TTL_MS,
  getAuthzSecret,
  signAuthz,
  verifyAuthz,
  type AuthzCacheData,
} from '@/lib/auth/authz-cache';

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

  // getClaims() vérifie le JWT localement (via JWKS mis en cache) quand le projet
  // utilise des clés de signature asymétriques — évite un aller-retour réseau vers
  // le serveur Auth à chaque navigation (contrairement à getUser()).
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as
    | { sub?: string; user_metadata?: Record<string, unknown> }
    | undefined;
  const user = claims?.sub
    ? { id: claims.sub, user_metadata: claims.user_metadata ?? {} }
    : null;

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
    pathname.startsWith('/legal/') ||
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

    // Cache d'autorisation : on évite la requête profil + les RPC facturation/CGU
    // sur chaque navigation en réutilisant un jeton signé (~60 s).
    const authzSecret = getAuthzSecret();
    let authz: AuthzCacheData | null = null;
    if (authzSecret) {
      const cached = request.cookies.get(AUTHZ_COOKIE)?.value;
      if (cached) authz = await verifyAuthz(cached, authzSecret, user.id);
    }

    if (!authz) {
      const { data: profile } = await supabase
        .from('profiles')
        .select(
          'organization_id, role, onboarding_path, is_active, organizations(type, settings, billing_status)'
        )
        .eq('id', user.id)
        .single();

      const orgRelation = profile?.organizations as
        | { type?: string; settings?: unknown; billing_status?: string }
        | null;
      const rRole = (profile?.role as string) ?? null;
      const rOrgId = (profile?.organization_id as string) ?? null;
      const rOnboarding = (profile?.onboarding_path as string) ?? null;
      const rSettings = orgRelation?.settings ?? null;
      const rBillingStatus = orgRelation?.billing_status ?? null;

      const staffIntent =
        isDirectorOrStaffIntent(accountIntent) ||
        isDirectorOnboardingPath(rOnboarding ?? undefined);
      const learnerPathLocal =
        !staffIntent && (accountIntent === 'learner' || rOnboarding === 'learner');

      const mayNeedEnrollmentHistory =
        pathname === '/' ||
        learnerPathLocal ||
        isLearnerRole(rRole) ||
        rRole === 'candidate' ||
        rRole === 'student' ||
        (!rOrgId && !staffIntent);

      let hist = false;
      if (mayNeedEnrollmentHistory) {
        const { data: historyRpc } = await supabase.rpc('learner_has_enrollment_history');
        hist =
          typeof historyRpc === 'boolean'
            ? historyRpc
            : await learnerHasEnrollmentHistory(supabase, user.id);
      }

      let billingOk = true;
      if (
        rOrgId &&
        rRole !== 'platform_admin' &&
        (rBillingStatus === 'active' || rBillingStatus === 'suspended')
      ) {
        const { data } = await supabase.rpc('organization_platform_access_ok', {
          p_org_id: rOrgId,
        });
        billingOk = data !== false;
      }

      authz = {
        sub: user.id,
        role: rRole,
        orgId: rOrgId,
        orgType: orgRelation?.type ?? null,
        isActive: profile?.is_active !== false,
        onboardingPath: rOnboarding,
        billingStatus: rBillingStatus,
        billingOk,
        cguAccepted: Boolean(
          (rSettings as Record<string, unknown> | null)?.cgu_accepted_at
        ),
        surveyOnly: isSurveyOnlyOrg(rSettings),
        hasEnrollmentHistory: hist,
      };

      if (authzSecret) {
        const signed = await signAuthz(authz, authzSecret);
        supabaseResponse.cookies.set(AUTHZ_COOKIE, signed, {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: Math.floor(AUTHZ_TTL_MS / 1000),
        });
      }
    }

    const role = authz.role;
    const organizationId = authz.orgId;
    const orgType = authz.orgType ?? undefined;
    const hasEnrollmentHistory = authz.hasEnrollmentHistory;
    const isStaffIntent =
      isDirectorOrStaffIntent(accountIntent) ||
      isDirectorOnboardingPath(authz.onboardingPath ?? undefined);
    const isLearnerPath =
      !isStaffIntent &&
      (accountIntent === 'learner' || authz.onboardingPath === 'learner');

    if (!authz.isActive && isProtectedRoute) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('blocked', '1');
      return NextResponse.redirect(url);
    }

    if (isStaffIntent && pathname.startsWith('/inscription-etablissement')) {
      const url = request.nextUrl.clone();
      url.pathname = organizationId ? sectorHomeFromOrgType(orgType) : '/rejoindre';
      if (!organizationId) url.searchParams.set('profil', 'directeur');
      return NextResponse.redirect(url);
    }

    if (pathname === '/' && request.nextUrl.searchParams.get('accueil') !== '1') {
      const dest = resolvePostAuthDestination({
        organizationId: organizationId ?? undefined,
        role: role as AppRole,
        orgType,
        accountIntent,
        onboardingPath: authz.onboardingPath ?? undefined,
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
      isOrganizationMemberRole(role as AppRole) ||
      (isStaffIntent && Boolean(organizationId));

    const learnerOnboarding =
      !isOrgMember &&
      !isStaffIntent &&
      (isLearnerPath ||
        isLearnerRole(role) ||
        role === 'candidate' ||
        role === 'student');

    const learnerNeedsPicker = learnerNeedsSchoolOnboarding({
      role,
      organizationId,
      accountIntent,
      onboardingPath: authz.onboardingPath ?? undefined,
      hasEnrollmentHistory,
    });

    const needsOnboarding =
      role !== 'platform_admin' &&
      !organizationId &&
      !(learnerOnboarding && hasEnrollmentHistory);

    const learnerPortalOnly =
      !isSchoolStaffRole(role as AppRole) &&
      learnerOnboarding &&
      (Boolean(organizationId) || hasEnrollmentHistory);

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
      if (isStaffIntent && !organizationId) {
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
      role !== 'platform_admin' &&
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
      role &&
      !canAccessEtablissementPath(role as AppRole, pathname)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = getEtablissementFallbackPath(role as AppRole);
      return NextResponse.redirect(url);
    }

    if (
      !needsOnboarding &&
      orgType === 'ngo' &&
      organizationId &&
      pathname.startsWith('/ong')
    ) {
      if (authz.surveyOnly) {
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
      role &&
      !canAccessOngPath(role as AppRole, pathname)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = getOngFallbackPath(role as AppRole);
      return NextResponse.redirect(url);
    }

    if (
      !needsOnboarding &&
      orgType === 'btp' &&
      pathname.startsWith('/btp') &&
      role &&
      !canAccessBtpPath(role as AppRole, pathname)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = getBtpFallbackPath(role as AppRole);
      return NextResponse.redirect(url);
    }

    if (
      !needsOnboarding &&
      orgType === 'business' &&
      pathname.startsWith('/pme') &&
      role &&
      !canAccessPmePath(role as AppRole, pathname)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = getPmeFallbackPath(role as AppRole);
      return NextResponse.redirect(url);
    }

    if (
      !needsOnboarding &&
      orgType === 'ngo' &&
      pathname.startsWith('/utilisateurs') &&
      role &&
      !isOngDirector(role as AppRole)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = getOngFallbackPath(role as AppRole);
      return NextResponse.redirect(url);
    }

    if (
      !needsOnboarding &&
      orgType === 'btp' &&
      pathname.startsWith('/utilisateurs') &&
      role &&
      !isBtpDirector(role as AppRole)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = getBtpFallbackPath(role as AppRole);
      return NextResponse.redirect(url);
    }

    if (
      !needsOnboarding &&
      orgType === 'business' &&
      pathname.startsWith('/utilisateurs') &&
      role &&
      !isPmeDirector(role as AppRole)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = getPmeFallbackPath(role as AppRole);
      return NextResponse.redirect(url);
    }

    const learnerPortalPath =
      pathname.startsWith('/etablissement/candidatures') ||
      pathname.startsWith('/inscription-etablissement') ||
      pathname.startsWith('/corriger-parcours');

    const isCguExemptPath =
      pathname.startsWith('/parametres/confidentialite') ||
      pathname.startsWith('/legal/') ||
      isBillingExemptPath(pathname);

    if (
      !needsOnboarding &&
      organizationId &&
      role === 'org_admin' &&
      isProtectedRoute &&
      !isCguExemptPath
    ) {
      if (!authz.cguAccepted) {
        const url = request.nextUrl.clone();
        url.pathname = '/parametres/confidentialite';
        url.searchParams.set('cgu', '1');
        return NextResponse.redirect(url);
      }
    }

    if (
      !needsOnboarding &&
      organizationId &&
      role !== 'platform_admin' &&
      isProtectedRoute &&
      !isBillingExemptPath(pathname) &&
      !learnerPortalPath &&
      !pathname.startsWith('/paiement-organisation') &&
      !pathname.startsWith('/paiement-scolarite')
    ) {
      if (
        authz.billingStatus === 'pending_payment' ||
        authz.billingStatus === 'pending_renewal'
      ) {
        const url = request.nextUrl.clone();
        url.pathname = BILLING_HOME_PATH;
        url.searchParams.set('blocked', '1');
        return NextResponse.redirect(url);
      }

      // Vérification fine (suspension / abonnement expiré) : résultat mis en cache.
      if (
        (authz.billingStatus === 'active' || authz.billingStatus === 'suspended') &&
        authz.billingOk === false
      ) {
        const url = request.nextUrl.clone();
        url.pathname = BILLING_HOME_PATH;
        url.searchParams.set('blocked', '1');
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
