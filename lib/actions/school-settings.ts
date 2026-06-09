'use server';

import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/actions/auth';
import { requireOrgId } from '@/lib/actions/org';
import { revalidatePath } from 'next/cache';
import {
  mergeSchoolOrgSettingsPatch,
  parseSchoolOrgSettings,
  type SchoolBulletinTemplate,
  type SchoolOrgSettings,
} from '@/lib/school/school-org-settings';
import { mergeBulletinTemplatePatch } from '@/lib/school/bulletin-template';
import {
  mergeMepsSettingsPatch,
  parseMepsSettings,
  type SchoolMepsSettings,
} from '@/lib/school/meps-settings';
import { getEtablissementCapabilities } from '@/lib/school/etablissement-access';

export async function getSchoolOrgSettings(): Promise<{
  settings: SchoolOrgSettings;
  error?: string;
}> {
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('organizations')
    .select('settings, type')
    .eq('id', orgId)
    .single();

  if (error) return { settings: parseSchoolOrgSettings(null), error: error.message };
  if (data?.type !== 'school') {
    return { settings: parseSchoolOrgSettings(null), error: 'Réservé aux établissements' };
  }

  return {
    settings: parseSchoolOrgSettings((data.settings as Record<string, unknown>) ?? null),
  };
}

export async function updateSchoolOrgSettings(patch: Partial<SchoolOrgSettings>) {
  const session = await getSession();
  const caps = getEtablissementCapabilities(session?.profile?.role);
  if (!caps.isDirector) {
    return { error: 'Seul le directeur peut modifier ces paramètres.' };
  }

  const orgId = await requireOrgId();
  const supabase = await createClient();

  const { data: org, error: loadErr } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', orgId)
    .single();

  if (loadErr) return { error: loadErr.message };

  const nextSettings = mergeSchoolOrgSettingsPatch(
    (org?.settings as Record<string, unknown>) ?? null,
    patch
  );

  const { error } = await supabase
    .from('organizations')
    .update({ settings: nextSettings })
    .eq('id', orgId);

  if (error) return { error: error.message };

  revalidatePath('/parametres/paiements-eleves');
  revalidatePath('/parametres/annee-scolaire');
  revalidatePath('/parametres/bulletin');
  revalidatePath('/etablissement/bulletins');
  revalidatePath('/etablissement');
  return { success: true };
}

export async function updateGradingPeriodByLevel(
  byLevel: SchoolOrgSettings['grading_period_by_level']
) {
  return updateSchoolOrgSettings({ grading_period_by_level: byLevel });
}

export async function updateBulletinDefaultExamTypes(examTypes: string[]) {
  const unique = [...new Set(examTypes.map((t) => t.trim()).filter(Boolean))];
  return updateSchoolOrgSettings({ bulletin_default_exam_types: unique });
}

export async function updateBulletinTemplate(patch: Partial<SchoolBulletinTemplate>) {
  const session = await getSession();
  const caps = getEtablissementCapabilities(session?.profile?.role);
  if (!caps.isDirector) {
    return { error: 'Seul le directeur peut modifier le modèle bulletin.' };
  }

  const orgId = await requireOrgId();
  const supabase = await createClient();

  const { data: org, error: loadErr } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', orgId)
    .single();

  if (loadErr) return { error: loadErr.message };

  const nextSettings = mergeBulletinTemplatePatch(
    (org?.settings as Record<string, unknown>) ?? null,
    patch
  );

  const { error } = await supabase
    .from('organizations')
    .update({ settings: nextSettings })
    .eq('id', orgId);

  if (error) return { error: error.message };

  revalidatePath('/parametres/bulletin');
  revalidatePath('/etablissement/bulletins');
  return { success: true };
}

export async function getMepsSettings(): Promise<{
  settings: SchoolMepsSettings;
  orgName: string;
  error?: string;
}> {
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('organizations')
    .select('name, settings, address, type')
    .eq('id', orgId)
    .single();

  if (error) {
    return { settings: parseMepsSettings(null), orgName: '', error: error.message };
  }
  if (data?.type !== 'school') {
    return { settings: parseMepsSettings(null), orgName: '', error: 'Réservé aux établissements' };
  }

  return {
    orgName: (data.name as string) ?? '',
    settings: parseMepsSettings(
      (data.settings as Record<string, unknown>) ?? null,
      (data.address as string) ?? null
    ),
  };
}

export async function updateMepsSettings(patch: Partial<SchoolMepsSettings>) {
  const session = await getSession();
  const caps = getEtablissementCapabilities(session?.profile?.role);
  if (!caps.isDirector) {
    return { error: 'Seul le directeur peut modifier les paramètres MEPS.' };
  }

  const orgId = await requireOrgId();
  const supabase = await createClient();

  const { data: org, error: loadErr } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', orgId)
    .single();

  if (loadErr) return { error: loadErr.message };

  const nextSettings = mergeMepsSettingsPatch(
    (org?.settings as Record<string, unknown>) ?? null,
    patch
  );

  const { error } = await supabase
    .from('organizations')
    .update({ settings: nextSettings })
    .eq('id', orgId);

  if (error) return { error: error.message };

  revalidatePath('/parametres/meps');
  revalidatePath('/etablissement/rapports');
  return { success: true };
}
