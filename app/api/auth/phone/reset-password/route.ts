import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { hashOtpCode } from '@/lib/survey/security-hash';
import { findProfileByPhone, updateAuthUserPassword } from '@/lib/auth/phone-account';
import { validatePassword } from '@/lib/auth/password-policy';

export const runtime = 'nodejs';

const MAX_ATTEMPTS = 5;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const challengeId = String(body.challengeId ?? '').trim();
    const code = String(body.code ?? '').trim();
    const password = String(body.password ?? '');

    if (!challengeId || !code) {
      return NextResponse.json({ error: 'Code et session requis' }, { status: 400 });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    const supabase = await createServiceClient();

    const { data: challenge, error: fetchErr } = await supabase
      .from('auth_phone_otp_challenges')
      .select('*')
      .eq('id', challengeId)
      .maybeSingle();

    if (fetchErr?.message?.includes('auth_phone_otp')) {
      return NextResponse.json({ error: 'Migration 094 requise (OTP récupération).' }, { status: 503 });
    }
    if (fetchErr || !challenge) {
      return NextResponse.json({ error: 'Session expirée. Demandez un nouveau code.' }, { status: 404 });
    }

    if (challenge.purpose !== 'recovery') {
      return NextResponse.json({ error: 'Session invalide pour réinitialisation.' }, { status: 400 });
    }

    if (challenge.verified_at) {
      return NextResponse.json({ error: 'Code déjà utilisé.' }, { status: 400 });
    }

    if (new Date(challenge.expires_at as string).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Code expiré. Demandez un nouveau code.' }, { status: 400 });
    }

    const attempts = Number(challenge.attempts ?? 0);
    if (attempts >= MAX_ATTEMPTS) {
      return NextResponse.json({ error: 'Trop de tentatives. Demandez un nouveau code.' }, { status: 429 });
    }

    if (hashOtpCode(code) !== challenge.code_hash) {
      await supabase
        .from('auth_phone_otp_challenges')
        .update({ attempts: attempts + 1 })
        .eq('id', challengeId);
      return NextResponse.json({ error: 'Code incorrect' }, { status: 401 });
    }

    const phoneE164 = challenge.phone_e164 as string;
    const profile = await findProfileByPhone(supabase, phoneE164);
    if (!profile) {
      return NextResponse.json({ error: 'Compte introuvable pour ce numéro.' }, { status: 404 });
    }

    const updated = await updateAuthUserPassword(profile.id, password);
    if ('error' in updated) {
      return NextResponse.json({ error: updated.error }, { status: 500 });
    }

    await supabase
      .from('auth_phone_otp_challenges')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', challengeId);

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
