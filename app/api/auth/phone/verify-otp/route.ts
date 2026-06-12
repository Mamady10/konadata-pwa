import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { hashOtpCode } from '@/lib/survey/security-hash';
import {
  establishSessionForEmail,
  findProfileByPhone,
  syncProfilePhone,
} from '@/lib/auth/phone-account';

export const runtime = 'nodejs';

const MAX_ATTEMPTS = 5;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const challengeId = String(body.challengeId ?? '').trim();
    const code = String(body.code ?? '').trim();
    const fullName = String(body.fullName ?? '').trim();
    const accountIntent = String(body.accountIntent ?? 'director').trim();
    const signupIntent = body.signupIntent ? String(body.signupIntent).trim() : undefined;

    if (!challengeId || !code) {
      return NextResponse.json({ error: 'Code et session OTP requis' }, { status: 400 });
    }

    const supabase = await createServiceClient();

    const { data: challenge, error: fetchErr } = await supabase
      .from('auth_phone_otp_challenges')
      .select('*')
      .eq('id', challengeId)
      .maybeSingle();

    if (fetchErr?.message?.includes('auth_phone_otp')) {
      return NextResponse.json({ error: 'Migration 068 requise' }, { status: 503 });
    }
    if (fetchErr || !challenge) {
      return NextResponse.json({ error: 'Session OTP introuvable' }, { status: 404 });
    }

    if (challenge.verified_at) {
      return NextResponse.json({ error: 'Code déjà utilisé' }, { status: 400 });
    }

    if (new Date(challenge.expires_at as string).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Code expiré. Demandez un nouveau code.' }, { status: 400 });
    }

    const attempts = Number(challenge.attempts ?? 0);
    if (attempts >= MAX_ATTEMPTS) {
      return NextResponse.json({ error: 'Trop de tentatives. Demandez un nouveau code.' }, { status: 429 });
    }

    const codeHash = hashOtpCode(code);
    if (codeHash !== challenge.code_hash) {
      await supabase
        .from('auth_phone_otp_challenges')
        .update({ attempts: attempts + 1 })
        .eq('id', challengeId);
      return NextResponse.json({ error: 'Code incorrect' }, { status: 401 });
    }

    const phoneE164 = challenge.phone_e164 as string;
    const purpose = challenge.purpose as 'login' | 'signup' | 'recovery';

    if (purpose === 'signup') {
      return NextResponse.json(
        { error: 'Inscription par OTP désactivée. Créez un compte avec mot de passe.' },
        { status: 410 }
      );
    }

    if (purpose === 'recovery') {
      return NextResponse.json(
        { error: 'Utilisez la page mot de passe oublié pour définir un nouveau mot de passe.' },
        { status: 400 }
      );
    }

    const existing = await findProfileByPhone(supabase, phoneE164);
    if (!existing) {
      return NextResponse.json({ error: 'Compte introuvable' }, { status: 404 });
    }
    const email = existing.email;
    if (fullName) {
      await syncProfilePhone(existing.id, phoneE164, fullName);
    } else {
      await syncProfilePhone(existing.id, phoneE164);
    }

    await supabase
      .from('auth_phone_otp_challenges')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', challengeId);

    const session = await establishSessionForEmail(email);
    if ('error' in session) {
      return NextResponse.json({ error: session.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      phoneE164,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
