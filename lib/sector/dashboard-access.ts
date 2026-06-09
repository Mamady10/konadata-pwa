import {
  getEtablissementCapabilities,
  isEtablissementDirector,
} from '@/lib/school/etablissement-access';
import type { AppRole } from '@/types/database';

export type DashboardContext = 'global' | 'school' | 'ngo' | 'btp' | 'pme';

const ORG_LEADER_ROLES = new Set<AppRole>([
  'platform_admin',
  'org_admin',
  'deputy_director',
]);

/** KPIs couvrant toute l'organisation (pas les collaborateurs terrain). */
export function canViewOrgWideDashboard(
  role: AppRole | string | undefined,
  context: DashboardContext
): boolean {
  if (!role) return false;

  if (context === 'global') {
    return role === 'platform_admin';
  }

  if (ORG_LEADER_ROLES.has(role as AppRole)) {
    return true;
  }

  switch (context) {
    case 'school':
      return getEtablissementCapabilities(role).viewOrgWideDashboard;
    case 'ngo':
      return role !== 'ngo_staff';
    case 'btp':
      return role !== 'btp_staff';
    case 'pme':
      return role !== 'pme_staff';
    default:
      return false;
  }
}

export function getSectorDashboardTitle(
  role: AppRole | string | undefined,
  context: DashboardContext
): string {
  if (context === 'global') {
    return role === 'platform_admin'
      ? 'Tableau de bord — Plateforme'
      : 'Accueil KonaData';
  }

  if (context === 'school') {
    if (isEtablissementDirector(role)) return 'Tableau de bord — Direction';
    if (role === 'registrar') return 'Tableau de bord — Scolarité';
    if (role === 'accountant') return 'Tableau de bord — Comptabilité';
    if (role === 'teacher') return 'Mon espace enseignant';
    if (role === 'student') return 'Mon espace élève';
    if (role === 'candidate') return 'Mon espace candidat';
    return 'Accueil';
  }

  if (ORG_LEADER_ROLES.has(role as AppRole)) {
    if (context === 'ngo') return 'Tableau de bord — Direction ONG';
    if (context === 'btp') return 'Tableau de bord — Direction BTP';
    if (context === 'pme') return 'Tableau de bord — Direction PME';
    return 'Tableau de bord — Direction';
  }

  if (context === 'ngo' && role === 'ngo_staff') return 'Mon espace ONG';
  if (context === 'btp' && role === 'btp_staff') return 'Mon espace chantier';

  if (context === 'ngo') return 'Tableau de bord ONG';
  if (context === 'btp') return 'Tableau de bord BTP';
  if (context === 'pme' && role === 'pme_staff') return 'Mon espace commerce';
  if (context === 'pme') return 'Tableau de bord PME';
  return 'Accueil';
}
