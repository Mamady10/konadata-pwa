import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { hashOtpCode } from '@/lib/survey/security-hash';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const challengeId = String(body.challengeId ?? '').trim();
    const studentId = String(body.studentId ?? '').trim();
    const code = String(body.code ?? '').trim();
    const amount = Number(body.amountGnf ?? 0);
    const enrollmentId = body.enrollmentId ? String(body.enrollmentId) : null;

    if (!challengeId || !studentId || !code) {
      return NextResponse.json({ error: 'Code de vérification requis' }, { status: 400 });
    }

    const supabase = await createServiceClient();

    const { data: challenge, error: fetchErr } = await supabase
      .from('school_payment_otp_challenges')
      .select('*')
      .eq('id', challengeId)
      .eq('student_id', studentId)
      .maybeSingle();

    if (fetchErr || !challenge) {
      return NextResponse.json({ error: 'Session OTP invalide' }, { status: 400 });
    }

    if (challenge.verified_at) {
      return NextResponse.json({ error: 'Code déjà utilisé' }, { status: 400 });
    }

    if (new Date(challenge.expires_at as string) < new Date()) {
      return NextResponse.json({ error: 'Code expiré — demandez un nouveau SMS' }, { status: 400 });
    }

    if (hashOtpCode(code) !== challenge.code_hash) {
      return NextResponse.json({ error: 'Code incorrect' }, { status: 401 });
    }

    await supabase
      .from('school_payment_otp_challenges')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', challengeId);

    const { data: linkData, error: linkErr } = await supabase.rpc(
      'create_school_student_payment_link_public',
      {
        p_student_id: studentId,
        p_challenge_id: challengeId,
        p_amount: amount > 0 ? amount : null,
        p_enrollment_id: enrollmentId,
      }
    );

    if (linkErr) {
      return NextResponse.json({ error: linkErr.message }, { status: 400 });
    }

    const token = (linkData as { payment_token?: string })?.payment_token;
    if (!token) {
      return NextResponse.json({ error: 'Impossible de créer le lien de paiement' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      paymentToken: token,
      redirectUrl: `/paiement-scolarite/${token}`,
      ...(linkData as Record<string, unknown>),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
