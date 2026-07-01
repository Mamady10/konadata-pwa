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

    if (!challengeId || !studentId || !code) {
      return NextResponse.json({ error: 'Code de vérification requis' }, { status: 400 });
    }

    const supabase = await createServiceClient();

    const { data: challenge, error: fetchErr } = await supabase
      .from('school_guardian_portal_otp_challenges')
      .select('*')
      .eq('id', challengeId)
      .eq('student_id', studentId)
      .maybeSingle();

    if (fetchErr || !challenge) {
      return NextResponse.json({ error: 'Session OTP invalide' }, { status: 400 });
    }

    if (challenge.verified_at) {
      return NextResponse.json({ error: 'Code déjà utilisé — demandez un nouveau SMS' }, { status: 400 });
    }

    if (new Date(challenge.expires_at as string) < new Date()) {
      return NextResponse.json({ error: 'Code expiré — demandez un nouveau SMS' }, { status: 400 });
    }

    if (hashOtpCode(code) !== challenge.code_hash) {
      return NextResponse.json({ error: 'Code incorrect' }, { status: 401 });
    }

    await supabase
      .from('school_guardian_portal_otp_challenges')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', challengeId);

    const { data: portalData, error: portalErr } = await supabase.rpc(
      'lookup_guardian_school_portal_by_challenge',
      { p_challenge_id: challengeId }
    );

    if (portalErr) {
      return NextResponse.json({ error: portalErr.message }, { status: 400 });
    }

    const result = portalData as Record<string, unknown> | null;
    if (result?.error) {
      return NextResponse.json({ error: String(result.error) }, { status: 400 });
    }

    let announcements: Array<Record<string, unknown>> = [];
    const orgId = challenge.organization_id as string;
    const { data: ann } = await supabase
      .from('school_announcements')
      .select('id, title, body, category, event_date, published_at')
      .eq('organization_id', orgId)
      .eq('visible_to_parents', true)
      .order('published_at', { ascending: false })
      .limit(15);
    if (ann) announcements = ann;

    return NextResponse.json({
      success: true,
      challengeId,
      data: { ...(result as Record<string, unknown>), announcements },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
