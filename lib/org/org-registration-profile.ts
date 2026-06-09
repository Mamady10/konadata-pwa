import type { OrganizationType } from '@/types/database';

export interface RequestedAiPlan {
  tier: string;
  monthly_credits: number;
  max_requests_per_day: number;
}

export interface OrgApplicationProfile {
  contact_title?: string;
  legal_name?: string;
  address?: string;
  website?: string;
  organization_summary?: string;
  heard_from?: string;
  expected_go_live?: string;
  requested_ai_plan?: RequestedAiPlan;
  school?: {
    levels_offered?: string;
    estimated_classes?: number | null;
    has_student_database?: boolean;
    prior_system_name?: string;
  };
  btp?: {
    active_sites_count?: number | null;
    team_size?: number | null;
    main_activity?: string;
  };
  ngo?: {
    active_projects_count?: number | null;
    beneficiaries_estimate?: number | null;
    focus_areas?: string;
  };
  pme?: {
    business_sector?: string;
    team_size?: number | null;
    uses_inventory?: boolean;
  };
  additional_notes?: string;
}

export function buildApplicationProfileFromFormData(
  formData: FormData,
  orgType: OrganizationType
): OrgApplicationProfile {
  const bool = (key: string) => formData.get(key) === 'true' || formData.get(key) === 'on';
  const num = (key: string) => {
    const v = formData.get(key) as string;
    if (!v?.trim()) return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  };
  const str = (key: string) => (formData.get(key) as string)?.trim() || undefined;

  const requestedTier = (formData.get('requested_ai_tier') as string)?.trim() || 'standard';
  const requestedCreditsRaw = formData.get('requested_ai_monthly_credits') as string;
  const requestedRequestsRaw = formData.get('requested_ai_max_requests_per_day') as string;
  const requestedCredits = requestedCreditsRaw ? parseInt(requestedCreditsRaw, 10) : null;
  const requestedRequests = requestedRequestsRaw ? parseInt(requestedRequestsRaw, 10) : null;

  const base: OrgApplicationProfile = {
    contact_title: str('contact_title'),
    legal_name: str('legal_name'),
    address: str('address'),
    website: str('website'),
    organization_summary: str('organization_summary'),
    heard_from: str('heard_from'),
    expected_go_live: str('expected_go_live'),
    additional_notes: str('additional_notes'),
    requested_ai_plan: {
      tier: requestedTier,
      monthly_credits: Number.isFinite(requestedCredits) ? requestedCredits! : 800,
      max_requests_per_day: Number.isFinite(requestedRequests) ? requestedRequests! : 80,
    },
  };

  if (orgType === 'school') {
    base.school = {
      levels_offered: str('school_levels_offered'),
      estimated_classes: num('school_estimated_classes'),
      has_student_database: bool('school_has_student_database'),
      prior_system_name: str('school_prior_system_name'),
    };
  } else if (orgType === 'btp') {
    base.btp = {
      active_sites_count: num('btp_active_sites'),
      team_size: num('btp_team_size'),
      main_activity: str('btp_main_activity'),
    };
  } else if (orgType === 'ngo') {
    base.ngo = {
      active_projects_count: num('ngo_active_projects'),
      beneficiaries_estimate: num('ngo_beneficiaries'),
      focus_areas: str('ngo_focus_areas'),
    };
  } else if (orgType === 'business') {
    base.pme = {
      business_sector: str('pme_sector'),
      team_size: num('pme_team_size'),
      uses_inventory: bool('pme_uses_inventory'),
    };
  }

  return base;
}

export const HEARD_FROM_OPTIONS = [
  { id: 'referral', label: 'Recommandation' },
  { id: 'social', label: 'Réseaux sociaux' },
  { id: 'event', label: 'Salon / événement' },
  { id: 'partner', label: 'Partenaire institutionnel' },
  { id: 'search', label: 'Recherche en ligne' },
  { id: 'other', label: 'Autre' },
] as const;

export function formatApplicationProfileForCeo(
  profile: OrgApplicationProfile | null | undefined
): { label: string; value: string }[] {
  if (!profile) return [];
  const rows: { label: string; value: string }[] = [];
  const add = (label: string, value: string | number | boolean | null | undefined) => {
    if (value === undefined || value === null || value === '') return;
    rows.push({ label, value: typeof value === 'boolean' ? (value ? 'Oui' : 'Non') : String(value) });
  };

  add('Fonction du responsable', profile.contact_title);
  add('Raison sociale / sigle officiel', profile.legal_name);
  add('Adresse', profile.address);
  add('Site web', profile.website);
  add('Présentation', profile.organization_summary);
  add('Comment nous avez-vous connu ?', profile.heard_from);
  add('Mise en service souhaitée', profile.expected_go_live);
  if (profile.requested_ai_plan) {
    add('Offre KonaAI demandée', profile.requested_ai_plan.tier);
    add('Crédits IA demandés / mois', profile.requested_ai_plan.monthly_credits);
    add('Requêtes IA max / jour', profile.requested_ai_plan.max_requests_per_day);
  }
  if (profile.school) {
    add('Niveaux / cycles', profile.school.levels_offered);
    add('Nombre de classes estimé', profile.school.estimated_classes);
    add('Base élèves existante', profile.school.has_student_database);
    add('Logiciel actuel', profile.school.prior_system_name);
  }
  if (profile.btp) {
    add('Chantiers actifs', profile.btp.active_sites_count);
    add('Effectif terrain', profile.btp.team_size);
    add('Activité principale', profile.btp.main_activity);
  }
  if (profile.ngo) {
    add('Projets actifs', profile.ngo.active_projects_count);
    add('Bénéficiaires estimés', profile.ngo.beneficiaries_estimate);
    add('Axes d’intervention', profile.ngo.focus_areas);
  }
  if (profile.pme) {
    add('Secteur d’activité', profile.pme.business_sector);
    add('Effectif', profile.pme.team_size);
    add('Gestion stocks / achats', profile.pme.uses_inventory);
  }
  add('Notes complémentaires', profile.additional_notes);
  return rows;
}
