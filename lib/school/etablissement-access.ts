import type { AppRole } from '@/types/database';

export type EtablissementPage =
  | 'dashboard'
  | 'candidatures'
  | 'etudiants'
  | 'formations'
  | 'paiements'
  | 'resultats'
  | 'bulletins'
  | 'rapports'
  | 'vie-scolaire';

const PATH_BY_PAGE: Record<EtablissementPage, string> = {
  dashboard: '/etablissement',
  candidatures: '/etablissement/candidatures',
  etudiants: '/etablissement/etudiants',
  formations: '/etablissement/formations',
  paiements: '/etablissement/paiements',
  resultats: '/etablissement/resultats',
  bulletins: '/etablissement/bulletins',
  rapports: '/etablissement/rapports',
  'vie-scolaire': '/etablissement/vie-scolaire',
};

const DIRECTOR_ROLES = new Set<AppRole>([
  'platform_admin',
  'org_admin',
  'deputy_director',
]);

/** null = accès à tout le module établissement */
const ALLOWED_HREFS_BY_ROLE: Partial<Record<AppRole, Set<string> | null>> = {
  teacher: new Set([
    PATH_BY_PAGE.dashboard,
    PATH_BY_PAGE.formations,
    PATH_BY_PAGE.resultats,
    PATH_BY_PAGE['vie-scolaire'],
  ]),
  registrar: new Set([
    PATH_BY_PAGE.dashboard,
    PATH_BY_PAGE.candidatures,
    PATH_BY_PAGE.etudiants,
    PATH_BY_PAGE.formations,
    PATH_BY_PAGE.paiements,
    PATH_BY_PAGE.rapports,
    PATH_BY_PAGE['vie-scolaire'],
  ]),
  accountant: new Set([
    PATH_BY_PAGE.dashboard,
    PATH_BY_PAGE.candidatures,
    PATH_BY_PAGE.etudiants,
    PATH_BY_PAGE.formations,
    PATH_BY_PAGE.paiements,
    PATH_BY_PAGE.rapports,
    PATH_BY_PAGE['vie-scolaire'],
  ]),
  student: new Set([
    PATH_BY_PAGE.dashboard,
    PATH_BY_PAGE.candidatures,
    PATH_BY_PAGE.bulletins,
  ]),
  candidate: new Set([
    PATH_BY_PAGE.dashboard,
    PATH_BY_PAGE.candidatures,
  ]),
};

export interface EtablissementCapabilities {
  manageEnrollments: boolean;
  manageStudents: boolean;
  manageCatalog: boolean;
  recordPayments: boolean;
  viewPayments: boolean;
  viewPaymentsByClass: boolean;
  viewEnrollmentDocuments: boolean;
  viewFinanceStats: boolean;
  viewStudentsReadOnly: boolean;
  viewFormationsReadOnly: boolean;
  enterGrades: boolean;
  generateReportCards: boolean;
  viewReports: boolean;
  manageOwnEnrollment: boolean;
  /** Créer une demande inscription / réinscription (candidat ou élève uniquement). */
  createEnrollmentRequest: boolean;
  /** Téléverser des pièces sur son dossier (candidat ou élève uniquement). */
  submitEnrollmentDocuments: boolean;
  viewOwnBulletinsOnly: boolean;
  /** KPIs et graphiques de tout l'établissement (directeur, scolarité, comptable). */
  viewOrgWideDashboard: boolean;
  isDirector: boolean;
}

export function isEtablissementDirector(role: AppRole | string | undefined): boolean {
  if (!role) return false;
  return DIRECTOR_ROLES.has(role as AppRole);
}

/** Personnel établissement (pas candidat / élève) — accès complet au module, pas le portail candidatures seul. */
export function isSchoolStaffRole(role: AppRole | string | undefined): boolean {
  if (!role) return false;
  return (
    isEtablissementDirector(role) ||
    role === 'registrar' ||
    role === 'accountant' ||
    role === 'teacher'
  );
}

export function isSelfServiceLearner(role: AppRole | string | undefined): boolean {
  return role === 'student' || role === 'candidate';
}

export function getAllowedEtablissementHrefs(
  role: AppRole | string | undefined
): Set<string> | null {
  if (!role || isEtablissementDirector(role)) return null;
  return ALLOWED_HREFS_BY_ROLE[role as AppRole] ?? null;
}

export function resolveEtablissementPage(pathname: string): EtablissementPage | null {
  if (pathname === '/etablissement' || pathname === '/etablissement/') {
    return 'dashboard';
  }
  const entries = Object.entries(PATH_BY_PAGE) as [EtablissementPage, string][];
  for (const [page, path] of entries) {
    if (page !== 'dashboard' && pathname.startsWith(path)) {
      return page;
    }
  }
  return null;
}

export function canAccessEtablissementPage(
  role: AppRole | string | undefined,
  page: EtablissementPage
): boolean {
  const allowed = getAllowedEtablissementHrefs(role);
  if (allowed === null) return true;
  if (!allowed) return false;
  return allowed.has(PATH_BY_PAGE[page]);
}

export function canAccessEtablissementPath(
  role: AppRole | string | undefined,
  pathname: string
): boolean {
  const page = resolveEtablissementPage(pathname);
  if (!page) return true;
  return canAccessEtablissementPage(role, page);
}

export function getEtablissementFallbackPath(role: AppRole | string | undefined): string {
  const allowed = getAllowedEtablissementHrefs(role);
  if (allowed === null) return PATH_BY_PAGE.dashboard;
  const order: EtablissementPage[] = [
    'dashboard',
    'candidatures',
    'etudiants',
    'formations',
    'paiements',
    'bulletins',
    'resultats',
    'rapports',
  ];
  for (const page of order) {
    if (allowed.has(PATH_BY_PAGE[page])) return PATH_BY_PAGE[page];
  }
  return '/dashboard';
}

export function filterEtablissementNav<T extends { href: string; label: string }>(
  role: AppRole | string | undefined,
  items: T[]
): T[] {
  const allowed = getAllowedEtablissementHrefs(role);
  if (allowed === null) return items;

  return items
    .filter((item) => allowed.has(item.href))
    .map((item) => {
      if (role === 'teacher' && item.href === PATH_BY_PAGE.formations) {
        return { ...item, label: 'Mes classes' };
      }
      if (role === 'accountant' && item.href === PATH_BY_PAGE.etudiants) {
        return { ...item, label: 'Effectifs élèves' };
      }
      if (role === 'accountant' && item.href === PATH_BY_PAGE.formations) {
        return { ...item, label: 'Classes' };
      }
      if (role === 'accountant' && item.href === PATH_BY_PAGE.candidatures) {
        return { ...item, label: 'Dossiers inscription' };
      }
      if (role === 'registrar' && item.href === PATH_BY_PAGE.paiements) {
        return { ...item, label: 'Paiements par classe' };
      }
      if ((role === 'student' || role === 'candidate') && item.href === PATH_BY_PAGE.candidatures) {
        return { ...item, label: 'Mon inscription' };
      }
      if (role === 'student' && item.href === PATH_BY_PAGE.bulletins) {
        return { ...item, label: 'Mon bulletin' };
      }
      return item;
    });
}

export interface EtablissementCapabilityOptions {
  /** Paramètre établissement : la scolarité peut encaisser */
  registrarCanRecordPayments?: boolean;
}

export function getEtablissementCapabilities(
  role: AppRole | string | undefined,
  options?: EtablissementCapabilityOptions
): EtablissementCapabilities {
  const director = isEtablissementDirector(role);
  if (director) {
    return {
      manageEnrollments: true,
      manageStudents: true,
      manageCatalog: true,
      recordPayments: true,
      viewPayments: true,
      viewPaymentsByClass: true,
      viewEnrollmentDocuments: true,
      viewFinanceStats: true,
      viewStudentsReadOnly: false,
      viewFormationsReadOnly: false,
      enterGrades: true,
      generateReportCards: true,
      viewReports: true,
      manageOwnEnrollment: false,
      createEnrollmentRequest: false,
      submitEnrollmentDocuments: false,
      viewOwnBulletinsOnly: false,
      viewOrgWideDashboard: true,
      isDirector: true,
    };
  }

  switch (role) {
    case 'registrar':
      return {
        manageEnrollments: true,
        manageStudents: true,
        manageCatalog: true,
        recordPayments: Boolean(options?.registrarCanRecordPayments),
        viewPayments: true,
        viewPaymentsByClass: true,
        viewEnrollmentDocuments: true,
        viewFinanceStats: false,
        viewStudentsReadOnly: false,
        viewFormationsReadOnly: false,
        enterGrades: false,
        generateReportCards: false,
        viewReports: true,
        manageOwnEnrollment: false,
        createEnrollmentRequest: false,
        submitEnrollmentDocuments: false,
        viewOwnBulletinsOnly: false,
        viewOrgWideDashboard: true,
        isDirector: false,
      };
    case 'accountant':
      return {
        manageEnrollments: false,
        manageStudents: false,
        manageCatalog: false,
        recordPayments: true,
        viewPayments: true,
        viewPaymentsByClass: true,
        viewEnrollmentDocuments: true,
        viewFinanceStats: true,
        viewStudentsReadOnly: true,
        viewFormationsReadOnly: true,
        enterGrades: false,
        generateReportCards: false,
        viewReports: true,
        manageOwnEnrollment: false,
        createEnrollmentRequest: false,
        submitEnrollmentDocuments: false,
        viewOwnBulletinsOnly: false,
        viewOrgWideDashboard: true,
        isDirector: false,
      };
    case 'teacher':
      return {
        manageEnrollments: false,
        manageStudents: false,
        manageCatalog: false,
        recordPayments: false,
        viewPayments: false,
        viewPaymentsByClass: false,
        viewEnrollmentDocuments: false,
        viewFinanceStats: false,
        viewStudentsReadOnly: false,
        viewFormationsReadOnly: false,
        enterGrades: true,
        generateReportCards: false,
        viewReports: false,
        manageOwnEnrollment: false,
        createEnrollmentRequest: false,
        submitEnrollmentDocuments: false,
        viewOwnBulletinsOnly: false,
        viewOrgWideDashboard: false,
        isDirector: false,
      };
    case 'student':
      return {
        manageEnrollments: false,
        manageStudents: false,
        manageCatalog: false,
        recordPayments: false,
        viewPayments: false,
        viewPaymentsByClass: false,
        viewEnrollmentDocuments: false,
        viewFinanceStats: false,
        viewStudentsReadOnly: false,
        viewFormationsReadOnly: false,
        enterGrades: false,
        generateReportCards: false,
        viewReports: false,
        manageOwnEnrollment: true,
        createEnrollmentRequest: true,
        submitEnrollmentDocuments: true,
        viewOwnBulletinsOnly: true,
        viewOrgWideDashboard: false,
        isDirector: false,
      };
    case 'candidate':
      return {
        manageEnrollments: false,
        manageStudents: false,
        manageCatalog: false,
        recordPayments: false,
        viewPayments: false,
        viewPaymentsByClass: false,
        viewEnrollmentDocuments: false,
        viewFinanceStats: false,
        viewStudentsReadOnly: false,
        viewFormationsReadOnly: false,
        enterGrades: false,
        generateReportCards: false,
        viewReports: false,
        manageOwnEnrollment: true,
        createEnrollmentRequest: true,
        submitEnrollmentDocuments: true,
        viewOwnBulletinsOnly: false,
        viewOrgWideDashboard: false,
        isDirector: false,
      };
    default:
      return {
        manageEnrollments: false,
        manageStudents: false,
        manageCatalog: false,
        recordPayments: false,
        viewPayments: false,
        viewPaymentsByClass: false,
        viewEnrollmentDocuments: false,
        viewFinanceStats: false,
        viewStudentsReadOnly: false,
        viewFormationsReadOnly: false,
        enterGrades: false,
        generateReportCards: false,
        viewReports: false,
        manageOwnEnrollment: false,
        createEnrollmentRequest: false,
        submitEnrollmentDocuments: false,
        viewOwnBulletinsOnly: false,
        viewOrgWideDashboard: false,
        isDirector: false,
      };
  }
}

/** @deprecated Préférer getSectorDashboardTitle(role, 'school') */
export function getDashboardTitle(role: AppRole | string | undefined): string {
  if (isEtablissementDirector(role)) return 'Tableau de bord — Direction';
  if (role === 'registrar') return 'Tableau de bord — Scolarité';
  if (role === 'accountant') return 'Tableau de bord — Comptabilité';
  if (role === 'teacher') return 'Mon espace enseignant';
  if (role === 'student') return 'Mon espace élève';
  if (role === 'candidate') return 'Mon espace candidat';
  return 'Accueil';
}
