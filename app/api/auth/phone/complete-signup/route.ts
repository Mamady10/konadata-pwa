import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { validatePassword } from '@/lib/auth/password-policy';
import {
  markPhoneOtpVerified,
  verifyPhoneOtpChallenge,
} from '@/lib/auth/verify-otp-challenge';
import { registerAndSignIn } from '@/lib/auth/complete-signup-session';
import { findProfileByPhone } from '@/lib/auth/phone-account';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const challengeId = String(body.challengeId ?? '').trim();
    const code = String(body.code ?? '').trim();
    const password = String(body.password ?? '');
    const fullName = String(body.fullName ?? '').trim();
    const accountIntent = String(body.accountIntent ?? 'director').trim();
    const signupIntent = body.signupIntent ? String(body.signupIntent).trim() : undefined;

    if (!challengeId || !code) {
      return NextResponse.json({ error: 'Code et session OTP requis' }, { status: 400 });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }
    if (!fullName) {
      return NextResponse.json({ error: 'Nom complet requis.' }, { status: 400 });
    }

    const supabase = await createServiceClient();
    const verified = await verifyPhoneOtpChallenge(supabase, challengeId, code, 'signup');
    if (!verified.ok) {
      return NextResponse.json({ error: verified.error }, { status: verified.status });
    }

    const phoneE164 = verified.challenge.phoneE164!;
    const existing = await findProfileByPhone(supabase, phoneE164);
    if (existing) {
      return NextResponse.json(
        { error: 'Ce numéro a déjà un compte. Connectez-vous.' },
        { status: 409 }
      );
    }

    const created = await registerAndSignIn({
      method: 'phone',
      phoneE164,
      password,
      fullName,
      accountIntent,
      signupIntent,
    });

    if ('error' in created) {
      return NextResponse.json({ error: created.error }, { status: 400 });
    }

    await markPhoneOtpVerified(supabase, challengeId);

    return NextResponse.json({ success: true, phoneE164 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
