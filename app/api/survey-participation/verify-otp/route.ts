import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { hashOtpCode } from '@/lib/survey/security-hash';

export const runtime = 'nodejs';

const MAX_ATTEMPTS = 5;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const challengeId = String(body.challengeId ?? '').trim();
    const code = String(body.code ?? '').trim();

    if (!challengeId || !code) {
      return NextResponse.json({ error: 'Identifiant et code requis' }, { status: 400 });
    }

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Code à 6 chiffres requis' }, { status: 400 });
    }

    const supabase = await createServiceClient();
    const { data: challenge, error } = await supabase
      .from('ngo_survey_otp_challenges')
      .select('id, code_hash, attempts, expires_at, verified_at')
      .eq('id', challengeId)
      .maybeSingle();

    if (error || !challenge) {
      return NextResponse.json({ error: 'Session OTP introuvable' }, { status: 404 });
    }

    if (challenge.verified_at) {
      return NextResponse.json({ success: true, challengeId: challenge.id, alreadyVerified: true });
    }

    if (new Date(challenge.expires_at as string) < new Date()) {
      return NextResponse.json({ error: 'Code expiré — demandez un nouveau code' }, { status: 410 });
    }

    const attempts = Number(challenge.attempts ?? 0);
    if (attempts >= MAX_ATTEMPTS) {
      return NextResponse.json({ error: 'Trop de tentatives — demandez un nouveau code' }, { status: 429 });
    }

    const codeHash = hashOtpCode(code);
    if (codeHash !== challenge.code_hash) {
      await supabase
        .from('ngo_survey_otp_challenges')
        .update({ attempts: attempts + 1 })
        .eq('id', challengeId);
      return NextResponse.json({ error: 'Code incorrect' }, { status: 401 });
    }

    await supabase
      .from('ngo_survey_otp_challenges')
      .update({ verified_at: new Date().toISOString(), attempts: attempts + 1 })
      .eq('id', challengeId);

    return NextResponse.json({ success: true, challengeId: challenge.id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
