import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { validatePassword } from '@/lib/auth/password-policy';
import {
  markEmailOtpVerified,
  verifyEmailOtpChallenge,
} from '@/lib/auth/verify-otp-challenge';
import { registerAndSignIn } from '@/lib/auth/complete-signup-session';

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
    const verified = await verifyEmailOtpChallenge(supabase, challengeId, code);
    if (!verified.ok) {
      return NextResponse.json({ error: verified.error }, { status: verified.status });
    }

    const email = verified.challenge.email!;
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', email)
      .maybeSingle();
    if (existingProfile?.id) {
      return NextResponse.json(
        { error: 'Cet email a déjà un compte. Connectez-vous.' },
        { status: 409 }
      );
    }

    const created = await registerAndSignIn({
      method: 'email',
      email,
      password,
      fullName,
      accountIntent,
      signupIntent,
    });

    if ('error' in created) {
      return NextResponse.json({ error: created.error }, { status: 400 });
    }

    await markEmailOtpVerified(supabase, challengeId);

    return NextResponse.json({ success: true, email });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
