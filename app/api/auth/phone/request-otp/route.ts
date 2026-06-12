import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { normalizeGuineaPhone } from '@/lib/survey/phone';
import {
  generateOtpCode,
  hashClientIp,
  hashOtpCode,
  hashPhoneE164,
  getClientIpFromHeaders,
} from '@/lib/survey/security-hash';
import { sendAuthOtp } from '@/lib/auth/send-auth-otp';
import { findProfileByPhone } from '@/lib/auth/phone-account';

export const runtime = 'nodejs';

const MAX_OTP_PER_IP_HOUR = 8;

async function checkAuthOtpRateLimit(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  ipHash: string
): Promise<{ allowed: boolean; error?: string }> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('auth_phone_otp_challenges')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', since);

  if (error?.message?.includes('auth_phone_otp')) {
    return { allowed: false, error: 'Migration 068 requise (authentification téléphone).' };
  }
  if (error) return { allowed: false, error: error.message };
  if ((count ?? 0) >= MAX_OTP_PER_IP_HOUR) {
    return { allowed: false, error: 'Trop de demandes. Réessayez dans une heure.' };
  }
  return { allowed: true };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const phoneRaw = String(body.phone ?? '').trim();
    const purposeRaw = String(body.purpose ?? 'login').trim();
    const channelRaw = String(body.channel ?? 'sms').trim();

    if (!phoneRaw) {
      return NextResponse.json({ error: 'Numéro de téléphone requis' }, { status: 400 });
    }

    const purpose =
      purposeRaw === 'recovery' ? 'recovery' : purposeRaw === 'signup' ? 'signup' : 'login';
    const phoneE164 = normalizeGuineaPhone(phoneRaw);
    if (!phoneE164) {
      return NextResponse.json(
        { error: 'Numéro invalide. Format attendu : 6XX XX XX XX (Guinée)' },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();
    const ipHash = hashClientIp(getClientIpFromHeaders(request.headers));
    const rate = await checkAuthOtpRateLimit(supabase, ipHash);
    if (!rate.allowed) {
      return NextResponse.json({ error: rate.error }, { status: 429 });
    }

    const existing = await findProfileByPhone(supabase, phoneE164);
    if (purpose === 'login' && !existing) {
      return NextResponse.json(
        { error: 'Aucun compte avec ce numéro. Créez un compte d\'abord.' },
        { status: 404 }
      );
    }
    if (purpose === 'recovery' && !existing) {
      return NextResponse.json(
        { error: 'Aucun compte avec ce numéro. Créez un compte ou vérifiez le numéro.' },
        { status: 404 }
      );
    }
    if (purpose === 'signup' && existing) {
      return NextResponse.json(
        { error: 'Ce numéro a déjà un compte. Connectez-vous avec ce numéro.' },
        { status: 409 }
      );
    }

    const channel = channelRaw === 'whatsapp' ? 'whatsapp' : 'sms';
    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const phoneHash = hashPhoneE164(phoneE164);

    const { data: challenge, error: insertErr } = await supabase
      .from('auth_phone_otp_challenges')
      .insert({
        phone_e164: phoneE164,
        phone_hash: phoneHash,
        code_hash: hashOtpCode(code),
        purpose,
        channel,
        ip_hash: ipHash,
        expires_at: expiresAt,
      })
      .select('id')
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    const sendResult = await sendAuthOtp(phoneE164, code, channel, purpose);
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
