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
import { studentPhoneAuthorized } from '@/lib/school/public-payment-otp';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const orgId = String(body.organizationId ?? '').trim();
    const studentId = String(body.studentId ?? '').trim();
    const phoneRaw = String(body.phone ?? '').trim();

    if (!orgId || !studentId || !phoneRaw) {
      return NextResponse.json({ error: 'Établissement, élève et téléphone requis' }, { status: 400 });
    }

    const phoneE164 = normalizeGuineaPhone(phoneRaw);
    if (!phoneE164) {
      return NextResponse.json({ error: 'Numéro invalide (format Guinée)' }, { status: 400 });
    }

    const supabase = await createServiceClient();

    const authorized = await studentPhoneAuthorized(supabase, studentId, phoneE164);
    if (!authorized) {
      return NextResponse.json(
        { error: 'Ce numéro ne correspond pas à la fiche élève ou tuteur enregistré(e).' },
        { status: 403 }
      );
    }

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const ipHash = hashClientIp(getClientIpFromHeaders(request.headers));

    const { data: challenge, error: insertErr } = await supabase
      .from('school_payment_otp_challenges')
      .insert({
        organization_id: orgId,
        student_id: studentId,
        phone_e164: phoneE164,
        phone_hash: hashPhoneE164(phoneE164),
        code_hash: hashOtpCode(code),
        ip_hash: ipHash,
        expires_at: expiresAt,
      })
      .select('id')
      .single();

    if (insertErr) {
      if (insertErr.message.includes('school_payment_otp')) {
        return NextResponse.json({ error: 'Migration 070 requise.' }, { status: 500 });
      }
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    const sendResult = await sendAuthOtp(phoneE164, code, 'sms', 'login');
    if (!sendResult.ok) {
      return NextResponse.json({ error: sendResult.error ?? 'Envoi SMS échoué' }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      challengeId: challenge.id,
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
