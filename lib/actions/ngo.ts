'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireOrgId } from '@/lib/actions/org';
import { projectStatusLabel } from '@/lib/sector/status-labels';
import { getSession } from '@/lib/actions/auth';
import { getNgoDocuments } from '@/lib/actions/storage';
import { canManageAssignments, getMyAssignedNgoProjectIds } from '@/lib/actions/assignments';
import type { PersonalDashboardLink } from '@/lib/sector/personal-dashboard-types';
import {
  getNgoSurveys as getNgoSurveysImpl,
  listNgoSurveysForUser as listNgoSurveysForUserImpl,
  createNgoSurvey as createNgoSurveyImpl,
  updateNgoSurveyStatus as updateNgoSurveyStatusImpl,
  submitNgoSurveyResponse as submitNgoSurveyResponseImpl,
} from '@/lib/actions/ngo-surveys';

async function filterProjectsByAssignment<T extends { id: string }>(projects: T[]): Promise<T[]> {
  const assigned = await getMyAssignedNgoProjectIds();
  if (assigned === null) return projects;
  if (assigned.length === 0) return [];
  const allowed = new Set(assigned);
  return projects.filter((p) => allowed.has(p.id));
}
export async function getNgoProjects(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('ngo_projects')
    .select('id, name, region, locality, budget, spent, status, progress_pct, beneficiaries, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return filterProjectsByAssignment(data ?? []);
}

export async function getNgoSurveys(orgId: string) {
  return getNgoSurveysImpl(orgId);
}

export async function listNgoSurveysForUser(orgId: string) {
  return listNgoSurveysForUserImpl(orgId);
}

export async function getNgoBeneficiaries(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('ngo_beneficiaries')
    .select('id, region, locality, category, created_at, core_persons(full_name, gender)')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getNgoPrograms(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('ngo_programs')
    .select('id, name, description, budget, donor, is_active')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getNgoCartography(orgId: string) {
  const projects = await getNgoProjects(orgId);
  const map = new Map<string, { localite: string; region: string; projets: number; beneficiaires: number }>();

  for (const p of projects) {
    const localite = p.locality ?? p.region ?? 'Non défini';
    const region = p.region ?? '—';
    const key = `${region}::${localite}`;
    const cur = map.get(key) ?? { localite, region, projets: 0, beneficiaires: 0 };
    cur.projets += 1;
    cur.beneficiaires += Number(p.beneficiaries ?? 0);
    map.set(key, cur);
  }

  return Array.from(map.values());
}

export async function getNgoDashboard(orgId: string) {
  const supabase = await createClient();

  const [projects, beneficiaries, surveys, programs] = await Promise.all([
    supabase
      .from('ngo_projects')
      .select('id, name, region, locality, budget, spent, status, progress_pct, beneficiaries')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false }),
    supabase
      .from('ngo_beneficiaries')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId),
    supabase
      .from('ngo_survey_responses')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId),
    supabase
      .from('ngo_programs')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId),
  ]);

  const projectRows = projects.data ?? [];
  const totalBudget = projectRows.reduce((s, p) => s + Number(p.budget ?? 0), 0);
  const totalSpent = projectRows.reduce((s, p) => s + Number(p.spent ?? 0), 0);
  const activeProjects = projectRows.filter((p) => p.status === 'active');
  const totalBeneficiaries = projectRows.reduce((s, p) => s + Number(p.beneficiaries ?? 0), 0)
    || beneficiaries.count
    || 0;

  const executionRate = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  const regionMap = new Map<string, number>();
  for (const p of projectRows) {
    const region = p.region ?? 'Non défini';
    regionMap.set(region, (regionMap.get(region) ?? 0) + Number(p.beneficiaries ?? 0));
  }
  const repartitionGeographique = Array.from(regionMap.entries()).map(([region, beneficiaires]) => ({
    region,
    beneficiaires,
  }));

  const budgetPrevuRealise = [
    { trimestre: 'T1', prevu: totalBudget * 0.25, realise: totalSpent * 0.3 },
    { trimestre: 'T2', prevu: totalBudget * 0.5, realise: totalSpent * 0.55 },
    { trimestre: 'T3', prevu: totalBudget * 0.75, realise: totalSpent * 0.8 },
    { trimestre: 'T4', prevu: totalBudget, realise: totalSpent },
  ];

  const localitesCouvertes = projectRows
    .filter((p) => p.locality)
    .reduce<Map<string, { localite: string; projets: number; beneficiaires: number }>>((acc, p) => {
      const key = p.locality as string;
      const cur = acc.get(key) ?? { localite: key, projets: 0, beneficiaires: 0 };
      cur.projets += 1;
      cur.beneficiaires += Number(p.beneficiaries ?? 0);
      acc.set(key, cur);
      return acc;
    }, new Map());

  return {
    kpis: {
      projets: projectRows.length,
      projetsActifs: activeProjects.length,
      beneficiaires: totalBeneficiaries,
      budgetTotal: totalBudget,
      budgetDepense: totalSpent,
      tauxExecution: executionRate,
      reponsesEnquetes: surveys.count ?? 0,
      programmes: programs.count ?? 0,
    },
    projetsActifs: activeProjects.map((p) => ({
      id: p.id,
      nom: p.name,
      region: p.region ?? '—',
      avancement: Math.round(Number(p.progress_pct ?? 0)),
      statut: projectStatusLabel(p.status),
    })),
    repartitionGeographique,
    budgetPrevuRealise,
    localitesCouvertes: Array.from(localitesCouvertes.values()),
  };
}

export interface PersonalNgoDashboard {
  userName: string;
  highlights: { label: string; value: string }[];
  links: PersonalDashboardLink[];
  projects: Array<{ id: string; name: string; meta: string; status: string }>;
}

export async function getPersonalNgoDashboard(orgId: string): Promise<PersonalNgoDashboard> {
  const session = await getSession();
  const userName = session?.profile?.full_name ?? 'Utilisateur';
  const assigned = await getMyAssignedNgoProjectIds();
  const projectIds = assigned ?? [];

  const supabase = await createClient();
  let projects: Array<{ id: string; name: string; region: string | null; status: string; progress_pct: number | null }> = [];

  if (projectIds.length > 0) {
    const { data } = await supabase
      .from('ngo_projects')
      .select('id, name, region, status, progress_pct')
      .eq('organization_id', orgId)
      .in('id', projectIds)
      .order('name');
    projects = data ?? [];
  }

  const docs = await getNgoDocuments(orgId);
  const activeCount = projects.filter((p) => p.status === 'active').length;
  const avgProgress = projects.length
    ? Math.round(
        projects.reduce((s, p) => s + Number(p.progress_pct ?? 0), 0) / projects.length
      )
    : 0;

  const highlights = [
    { label: 'Projets assignés', value: String(projects.length) },
    { label: 'Projets actifs', value: String(activeCount) },
    { label: 'Documents déposés', value: String(docs.length) },
    { label: 'Avancement moyen', value: projects.length ? `${avgProgress}%` : '—' },
  ];

  const links: PersonalDashboardLink[] = [
    {
      href: '/ong/projets',
      label: 'Mes projets',
      description: 'Consulter uniquement vos projets assignés',
    },
    {
      href: '/ong/documents',
      label: 'Documents',
      description: 'Déposer ou consulter les pièces de vos projets',
    },
    {
      href: '/ong/rapports',
      label: 'Rapports',
      description: 'Rapports liés à votre périmètre',
    },
  ];

  return {
    userName,
    highlights,
    links,
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      meta: p.region ?? '—',
      status: projectStatusLabel(p.status),
    })),
  };
}

export async function createNgoProject(formData: FormData) {
  const canManage = await canManageAssignments();
  if (!canManage) return { error: 'Seuls les directeurs peuvent créer des projets.' };

  const orgId = await requireOrgId();
  const supabase = await createClient();

  const name = (formData.get('name') as string)?.trim();
  if (!name) return { error: 'Le nom du projet est requis' };

  const { error } = await supabase.from('ngo_projects').insert({
    organization_id: orgId,
    name,
    region: (formData.get('region') as string) || null,
    locality: (formData.get('locality') as string) || null,
    budget: Number(formData.get('budget') || 0),
    status: 'active',
    progress_pct: Number(formData.get('progress_pct') || 0),
    beneficiaries: Number(formData.get('beneficiaries') || 0),
  });

  if (error) return { error: error.message };
  revalidatePath('/ong/projets');
  revalidatePath('/ong');
  return { success: true };
}

export async function createNgoSurvey(formData: FormData) {
  return createNgoSurveyImpl(formData);
}

export async function updateNgoSurveyStatus(id: string, status: string) {
  return updateNgoSurveyStatusImpl(id, status);
}

export async function submitNgoSurveyResponse(
  surveyId: string,
  answers: Record<string, unknown>,
  meta?: { locality?: string; latitude?: number; longitude?: number; respondentId?: string }
) {
  return submitNgoSurveyResponseImpl(surveyId, answers, meta);
}

export async function createNgoBeneficiary(formData: FormData) {
  const orgId = await requireOrgId();
  const supabase = await createClient();

  const fullName = (formData.get('full_name') as string)?.trim();
  if (!fullName) return { error: 'Le nom est requis' };

  const { data: person, error: personError } = await supabase
    .from('core_persons')
    .insert({
      organization_id: orgId,
      kind: 'beneficiary',
      full_name: fullName,
      gender: (formData.get('gender') as string) || null,
      email: (formData.get('email') as string) || null,
    })
    .select('id')
    .single();

  if (personError) return { error: personError.message };

  const { error } = await supabase.from('ngo_beneficiaries').insert({
    organization_id: orgId,
    person_id: person.id,
    region: (formData.get('region') as string) || null,
    locality: (formData.get('locality') as string) || null,
    category: (formData.get('category') as string) || null,
  });

  if (error) return { error: error.message };
  revalidatePath('/ong/beneficiaires');
  return { success: true };
}
