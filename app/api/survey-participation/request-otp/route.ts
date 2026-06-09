import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { normalizeGuineaPhone } from '@/lib/survey/phone';
import {
  generateOtpCode,
  hashClientIp,
  hashDeviceFingerprint,
  hashOtpCode,
  hashPhoneE164,
  getClientIpFromHeaders,
} from '@/lib/survey/security-hash';
import { sendSurveyOtp } from '@/lib/survey/send-otp';
import {
  checkRateLimit,
  getSurveyByPublicToken,
  isParticipationLocked,
  parseSecuritySettings,
} from '@/lib/survey/participation-api';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = String(body.token ?? '').trim();
    const phoneRaw = String(body.phone ?? '').trim();
    const deviceFingerprint = String(body.deviceFingerprint ?? '').trim();
    const channelRaw = String(body.channel ?? '').trim();

    if (!token || !phoneRaw) {
      return NextResponse.json({ error: 'Token et téléphone requis' }, { status: 400 });
    }

    const phoneE164 = normalizeGuineaPhone(phoneRaw);
    if (!phoneE164) {
      return NextResponse.json(
        { error: 'Numéro invalide. Format attendu : 6XX XX XX XX (Guinée)' },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();
    const { survey, error: surveyErr } = await getSurveyByPublicToken(supabase, token);
    if (surveyErr || !survey) {
      return NextResponse.json({ error: surveyErr ?? 'Sondage indisponible' }, { status: 404 });
    }

    const surveyId = String(survey.id);
    const { data: surveyRow } = await supabase
      .from('ngo_surveys')
      .select('organization_id')
      .eq('id', surveyId)
      .maybeSingle();

    const orgId = surveyRow?.organization_id as string | undefined;
    if (!orgId) {
      return NextResponse.json({ error: 'Sondage introuvable' }, { status: 404 });
    }

    const security = parseSecuritySettings(survey.security);
    if (!security.require_phone_otp) {
      return NextResponse.json({ error: 'OTP non requis pour ce sondage' }, { status: 400 });
    }

    const ip = getClientIpFromHeaders(request.headers);
    const ipHash = hashClientIp(ip);
    const phoneHash = hashPhoneE164(phoneE164);
    const deviceHash = deviceFingerprint
      ? hashDeviceFingerprint(surveyId, deviceFingerprint)
      : null;

    const rate = await checkRateLimit(
      supabase,
      `otp:${surveyId}:${ipHash}`,
      security.rate_limit_otp_per_ip_hour
    );
    if (!rate.allowed) {
      return NextResponse.json({ error: rate.error }, { status: 429 });
    }

    if (security.one_per_device && deviceHash) {
      const deviceLocked = await isParticipationLocked(supabase, surveyId, 'device', deviceHash);
      if (deviceLocked) {
        return NextResponse.json(
          { error: 'Cet appareil a déjà participé à ce sondage' },
          { status: 403 }
        );
      }
    }

    const phoneLocked = await isParticipationLocked(supabase, surveyId, 'phone', phoneHash);
    if (phoneLocked) {
      return NextResponse.json(
        { error: 'Ce numéro a déjà participé à ce sondage' },
        { status: 403 }
      );
    }

    const channel =
      channelRaw === 'whatsapp' || security.otp_channel === 'whatsapp' ? 'whatsapp' : 'sms';

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { data: challenge, error: insertErr } = await supabase
      .from('ngo_survey_otp_challenges')
      .insert({
        organization_id: orgId,
        survey_id: surveyId,
        phone_e164: phoneE164,
        phone_hash: phoneHash,
        code_hash: hashOtpCode(code),
        channel,
        device_hash: deviceHash,
        ip_hash: ipHash,
        expires_at: expiresAt,
      })
      .select('id')
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    const sendResult = await sendSurveyOtp(
      phoneE164,
      code,
      channel,
      String(survey.title ?? 'Sondage')
    );

    if (!sendResult.ok) {
      return NextResponse.json({ error: sendResult.error ?? 'Envoi OTP échoué' }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      challengeId: challenge.id,
      channel,
      maskedPhone: phoneE164.replace(/(\+224\d{2})\d+(\d{2})/, '$1*****$2'),
      ...(sendResult.devCode ? { devCode: sendResult.devCode } : {}),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
