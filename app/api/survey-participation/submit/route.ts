import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  getClientIpFromHeaders,
  hashClientIp,
  hashDeviceFingerprint,
} from '@/lib/survey/security-hash';
import {
  checkRateLimit,
  getSurveyByPublicToken,
  parseSecuritySettings,
} from '@/lib/survey/participation-api';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = String(body.token ?? '').trim();
    const challengeId = body.challengeId ? String(body.challengeId).trim() : null;
    const deviceFingerprint = String(body.deviceFingerprint ?? '').trim();
    const answers = body.answers as Record<string, unknown> | undefined;
    const locality = body.locality ? String(body.locality).trim() : null;

    if (!token || !answers || typeof answers !== 'object') {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
    }

    const supabase = await createServiceClient();
    const { survey, error: surveyErr } = await getSurveyByPublicToken(supabase, token);
    if (surveyErr || !survey) {
      return NextResponse.json({ error: surveyErr ?? 'Sondage indisponible' }, { status: 404 });
    }

    const surveyId = String(survey.id);
    const security = parseSecuritySettings(survey.security);

    if (security.require_phone_otp && !challengeId) {
      return NextResponse.json({ error: 'Vérification téléphone requise' }, { status: 400 });
    }

    const ip = getClientIpFromHeaders(request.headers);
    const ipHash = hashClientIp(ip);
    const deviceHash = deviceFingerprint
      ? hashDeviceFingerprint(surveyId, deviceFingerprint)
      : null;

    const rate = await checkRateLimit(
      supabase,
      `submit:${surveyId}:${ipHash}`,
      security.rate_limit_submit_per_ip_hour
    );
    if (!rate.allowed) {
      return NextResponse.json({ error: rate.error }, { status: 429 });
    }

    const { data: campaignOk } = await supabase.rpc('ngo_survey_campaign_access_ok', {
      p_survey_id: surveyId,
    });
    if (campaignOk === false) {
      return NextResponse.json(
        { error: 'Cette campagne sondage est terminée.' },
        { status: 403 }
      );
    }

    const { data, error } = await supabase.rpc('submit_ngo_public_survey_response', {
      p_token: token,
      p_answers: answers,
      p_locality: locality,
      p_challenge_id: challengeId,
      p_device_hash: deviceHash,
      p_ip_hash: ipHash,
    });

    if (error?.message?.includes('submit_ngo_public_survey_response')) {
      return NextResponse.json(
        { error: 'Migration 060 requise pour la soumission sécurisée' },
        { status: 503 }
      );
    }
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const row = (data ?? {}) as Record<string, unknown>;
    if (row.error) {
      return NextResponse.json({ error: String(row.error) }, { status: 403 });
    }

    const response = NextResponse.json({ success: true, responseId: row.response_id });
    if (security.one_per_device) {
      const cookieName = `kona_srv_done_${surveyId.slice(0, 8)}`;
      const maxAge = security.device_lock_days * 24 * 60 * 60;
      response.cookies.set(cookieName, '1', {
        maxAge,
        path: '/',
        sameSite: 'lax',
        httpOnly: false,
      });
    }
    return response;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
