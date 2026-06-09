'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { buildApplicationProfileFromFormData } from '@/lib/org/org-registration-profile';
import {
  ORG_REGISTRATION_SUCCESS_PATH,
  type OrgRegistrationResult,
} from '@/lib/org/org-registration-shared';
import type { OrganizationType } from '@/types/database';
import { sendOrgRegistrationNotifyEmail } from '@/lib/email/send-org-registration-notify';
import {
  PLATFORM_V1_AI_OFFERS_ENABLED,
  PLATFORM_V1_DEFAULT_AI_TIER,
  PLATFORM_V1_DEFAULT_AI_CREDITS,
  PLATFORM_V1_DEFAULT_AI_REQUESTS_PER_DAY,
} from '@/lib/platform/v1-product';

function mapOrgRpcError(message: string): string | null {
  const m = message.toLowerCase();
  if (m.includes('authentification requise')) {
    return 'Session non établie. Reconnectez-vous puis réessayez, ou confirmez votre email si Supabase l’exige.';
  }
  if (m.includes('déjà rattaché') || m.includes('deja rattache')) {
    return 'Ce compte est déjà lié à une organisation. Connectez-vous pour accéder à Paramètres → Facturation.';
  }
  if (
    m.includes('application_profile') ||
    m.includes('could not find the function') ||
    m.includes('does not exist')
  ) {
    return 'Base de données à jour requise (migration Supabase 047). Contactez le support KonaData.';
  }
  if (m.includes('porte déjà ce nom')) {
    return 'Un établissement scolaire porte déjà ce nom. Utilisez un nom unique (par ex. « Lycée Alpha — Conakry »).';
  }
  return null;
}

export async function completeOrganizationRegistration(
  formData: FormData
): Promise<OrgRegistrationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error:
        'Connexion requise pour finaliser l’inscription. Réessayez après vous être connecté, ou confirmez votre email.',
    };
  }

  const email = (formData.get('email') as string)?.trim() || user.email || '';
  const fullName = (formData.get('full_name') as string)?.trim();
  const organizationName = (formData.get('organization') as string)?.trim();
  const orgType = ((formData.get('organization_type') as string) || 'school') as OrganizationType;

  if (!organizationName) {
    return { error: 'Indiquez le nom de votre organisation.' };
  }

  if (orgType === 'school') {
    const { data: nameTaken, error: nameCheckErr } = await supabase.rpc('school_org_name_taken', {
      p_name: organizationName,
      p_exclude_id: null,
    });
    if (!nameCheckErr?.message?.includes('school_org_name_taken') && nameTaken) {
      return {
        error:
          'Un établissement scolaire porte déjà ce nom. Utilisez un nom unique (par ex. « Lycée Alpha — Conakry »).',
      };
    }
  }

  const declaredStudentsRaw = formData.get('declared_expected_students') as string;
  const declaredStudents = declaredStudentsRaw ? parseInt(declaredStudentsRaw, 10) : null;
  const declaredCity = (formData.get('declared_city') as string)?.trim() || null;
  const declaredPhone = (formData.get('declared_phone') as string)?.trim() || null;
  const heardFrom = (formData.get('heard_from') as string)?.trim() || null;
  const applicationProfile = buildApplicationProfileFromFormData(formData, orgType);

  if (!declaredCity) {
    return { error: 'Indiquez la ville de votre organisation.' };
  }
  if (!declaredPhone) {
    return { error: 'Indiquez un numéro de téléphone pour vous recontacter.' };
  }
  if (!heardFrom) {
    return { error: 'Indiquez comment vous avez connu KonaData.' };
  }
  const summary = applicationProfile.organization_summary?.trim();
  if (!summary || summary.length < 20) {
    return {
      error:
        'Décrivez votre organisation en quelques phrases (minimum 20 caractères) pour que KonaData puisse analyser votre demande.',
    };
  }

  const { data: orgId, error: orgError } = await supabase.rpc('create_organization_with_owner', {
    p_name: organizationName,
    p_type: orgType,
    p_email: email,
    p_phone: declaredPhone,
    p_declared_expected_students: Number.isFinite(declaredStudents) ? declaredStudents : null,
    p_declared_city: declaredCity,
    p_application_profile: applicationProfile,
  });

  if (orgError) {
    const mapped = mapOrgRpcError(orgError.message);
    if (mapped) return { error: mapped };
    return { error: orgError.message };
  }

  if (!orgId) {
    return {
      error:
        'La création de l’organisation a échoué. Vérifiez les migrations Supabase (040–047) ou contactez le support.',
    };
  }

  if (fullName) {
    await supabase.from('profiles').update({ full_name: fullName }).eq('id', user.id);
  }

  const requestedPlan = applicationProfile.requested_ai_plan;
  const aiPlanUpdate = PLATFORM_V1_AI_OFFERS_ENABLED
    ? requestedPlan
      ? {
          ai_plan_tier: requestedPlan.tier,
          ai_monthly_credits: requestedPlan.monthly_credits,
          ai_max_requests_per_day: requestedPlan.max_requests_per_day,
        }
      : null
    : {
        ai_plan_tier: PLATFORM_V1_DEFAULT_AI_TIER,
        ai_monthly_credits: PLATFORM_V1_DEFAULT_AI_CREDITS,
        ai_max_requests_per_day: PLATFORM_V1_DEFAULT_AI_REQUESTS_PER_DAY,
      };

  if (aiPlanUpdate) {
    await supabase
      .from('organization_billing_offers')
      .update(aiPlanUpdate)
      .eq('organization_id', orgId);
  }

  try {
    const notify = await sendOrgRegistrationNotifyEmail({
      orgName: organizationName,
      orgType,
      directorName: fullName || null,
      directorEmail: email,
      declaredCity,
      declaredStudents: Number.isFinite(declaredStudents) ? declaredStudents : null,
      summary: applicationProfile.organization_summary ?? null,
    });
    if (!notify.ok && !notify.skipped) {
      console.warn('[org-registration] notify CEO', notify.error);
    }
  } catch (e) {
    console.warn('[org-registration] notify CEO ignoré', e);
  }

  revalidatePath('/', 'layout');
  return { success: true, redirectTo: ORG_REGISTRATION_SUCCESS_PATH };
}
