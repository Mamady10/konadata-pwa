'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createNgoSurvey } from '@/lib/actions/ngo-surveys';
import { sendOrgRegistrationNotifyEmail } from '@/lib/email/send-org-registration-notify';
import { SURVEY_ONLY_SUCCESS_PATH } from '@/lib/org/survey-only-shared';

export type SurveyOnlyRegistrationResult =
  | { error: string }
  | {
      success: true;
      orgId: string;
      surveyId: string;
      redirectTo: string;
      awaitingCeoQuote?: boolean;
      ceoNotifyWarning?: string;
    };

export async function completeSurveyOnlyRegistration(
  formData: FormData
): Promise<SurveyOnlyRegistrationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error:
        'Connexion requise. Créez votre compte puis réessayez, ou confirmez votre email si nécessaire.',
    };
  }

  const email = (formData.get('email') as string)?.trim() || user.email || '';
  const fullName = (formData.get('full_name') as string)?.trim();
  const organizationName = (formData.get('organization') as string)?.trim();
  const declaredCity = (formData.get('declared_city') as string)?.trim();
  const declaredPhone = (formData.get('declared_phone') as string)?.trim();
  const contactTitle = (formData.get('contact_title') as string)?.trim() || 'Responsable';
  const heardFrom = (formData.get('heard_from') as string)?.trim() || 'Page d\'accueil — sondage';

  if (!organizationName) return { error: 'Indiquez le nom de votre organisation.' };
  if (!declaredCity) return { error: 'Indiquez la ville.' };
  if (!declaredPhone) return { error: 'Indiquez un numéro de téléphone.' };
  if (!fullName) return { error: 'Indiquez votre nom complet.' };

  const surveyTitle = (formData.get('survey_title') as string)?.trim();
  const question = (formData.get('question') as string)?.trim();
  const opt1 = (formData.get('option_1') as string)?.trim();
  const opt2 = (formData.get('option_2') as string)?.trim();
  const opt3 = (formData.get('option_3') as string)?.trim();
  const targetRaw = formData.get('target_responses') as string;

  if (!surveyTitle) return { error: 'Indiquez le titre du sondage.' };
  if (!question || !opt1 || !opt2 || !opt3) {
    return { error: 'La question et les 3 options du QCM sont requises.' };
  }
  if (new Set([opt1, opt2, opt3]).size < 3) {
    return { error: 'Les 3 options doivent être distinctes.' };
  }
  const target = targetRaw ? parseInt(targetRaw, 10) : 0;
  if (!Number.isFinite(target) || target < 1) {
    return { error: 'Indiquez le nombre de personnes cibles (minimum 1).' };
  }

  const applicationProfile = {
    intent: 'survey_only',
    organization_summary: `Sondage uniquement — ${organizationName} (${declaredCity})`,
    heard_from: heardFrom,
    contact_title: contactTitle,
    survey_preview: { title: surveyTitle, question, target_responses: target },
  };

  const { data: orgId, error: orgError } = await supabase.rpc(
    'create_survey_only_organization_with_owner',
    {
      p_name: organizationName,
      p_email: email,
      p_phone: declaredPhone,
      p_declared_city: declaredCity,
      p_contact_name: fullName,
      p_contact_title: contactTitle,
      p_application_profile: applicationProfile,
    }
  );

  if (orgError) {
    if (orgError.message.includes('create_survey_only_organization')) {
      return { error: 'Migration 065 requise (inscription sondage uniquement).' };
    }
    if (orgError.message.includes('déjà rattaché')) {
      return { error: 'Ce compte est déjà lié à une organisation. Connectez-vous.' };
    }
    return { error: orgError.message };
  }

  if (!orgId) return { error: 'Création de l\'organisation échouée.' };

  if (fullName) {
    await supabase.from('profiles').update({ full_name: fullName }).eq('id', user.id);
  }

  try {
    await sendOrgRegistrationNotifyEmail({
      orgName: organizationName,
      orgType: 'ngo',
      directorName: fullName,
      directorEmail: email,
      declaredCity,
      declaredStudents: null,
      summary: `Inscription sondage uniquement — campagne « ${surveyTitle} » (${target} cibles)`,
    });
  } catch {
    // non bloquant
  }

  const surveyFd = new FormData();
  surveyFd.set('title', surveyTitle);
  surveyFd.set('question', question);
  surveyFd.set('option_1', opt1);
  surveyFd.set('option_2', opt2);
  surveyFd.set('option_3', opt3);
  surveyFd.set('target_responses', String(target));
  surveyFd.set('region', (formData.get('region') as string)?.trim() || declaredCity);
  surveyFd.set('description', (formData.get('survey_description') as string)?.trim() || '');
  surveyFd.set('collection_mode', (formData.get('collection_mode') as string) || 'mixed');
  surveyFd.set('status', 'draft');

  const surveyResult = await createNgoSurvey(surveyFd);
  if (surveyResult.error || !surveyResult.surveyId) {
    return {
      error:
        surveyResult.error ??
        'Organisation créée mais le sondage n\'a pas pu être enregistré. Contactez le support.',
    };
  }

  revalidatePath('/', 'layout');
  const redirectTo = `${SURVEY_ONLY_SUCCESS_PATH}/${surveyResult.surveyId}`;

  return {
    success: true,
    orgId: orgId as string,
    surveyId: surveyResult.surveyId,
    redirectTo,
    awaitingCeoQuote: surveyResult.awaitingCeoQuote,
    ceoNotifyWarning: surveyResult.ceoNotifyWarning,
  };
}
