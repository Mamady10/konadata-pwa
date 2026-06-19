import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  generateOtpCode,
  hashClientIp,
  hashOtpCode,
  hashSurveyValue,
  getClientIpFromHeaders,
} from '@/lib/survey/security-hash';
import { sendSignupEmailOtp } from '@/lib/auth/send-signup-email-otp';
import { checkSignupOtpRateLimit } from '@/lib/auth/signup-otp-rate-limit';
import { isSyntheticPhoneEmail } from '@/lib/auth/phone-email';

export const runtime = 'nodejs';

function hashEmail(email: string): string {
  return hashSurveyValue('email', email.toLowerCase());
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const emailRaw = String(body.email ?? '').trim().toLowerCase();

    if (!emailRaw) {
      return NextResponse.json({ error: 'Email requis' }, { status: 400 });
    }
    if (isSyntheticPhoneEmail(emailRaw)) {
      return NextResponse.json({ error: 'Adresse email invalide.' }, { status: 400 });
    }

    const supabase = await createServiceClient();
    const ipHash = hashClientIp(getClientIpFromHeaders(request.headers));
    const rate = await checkSignupOtpRateLimit(supabase, ipHash, 'auth_email_otp_challenges');
    if (!rate.allowed) {
      return NextResponse.json({ error: rate.error }, { status: 429 });
    }

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', emailRaw)
      .maybeSingle();
    if (existingProfile?.id) {
      return NextResponse.json(
        { error: 'Cet email a déjà un compte. Connectez-vous.' },
        { status: 409 }
      );
    }

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { data: challenge, error: insertErr } = await supabase
      .from('auth_email_otp_challenges')
      .insert({
        email: emailRaw,
        email_hash: hashEmail(emailRaw),
        code_hash: hashOtpCode(code),
        purpose: 'signup',
        ip_hash: ipHash,
        expires_at: expiresAt,
      })
      .select('id')
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    const sendResult = await sendSignupEmailOtp(emailRaw, code);
    if (!sendResult.ok) {
      return NextResponse.json({ error: sendResult.error ?? 'Envoi email échoué' }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      challengeId: challenge.id,
      channel: 'email',
      maskedEmail: maskEmail(emailRaw),
      ...(sendResult.devCode ? { devCode: sendResult.devCode } : {}),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
