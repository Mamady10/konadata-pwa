import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { registerAuthAccount } from '@/lib/auth/register-account';
import { normalizeGuineaPhone } from '@/lib/survey/phone';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const method = body.method === 'phone' ? 'phone' : 'email';
    const password = String(body.password ?? '');
    const fullName = String(body.fullName ?? '').trim();
    const accountIntent = body.accountIntent ? String(body.accountIntent).trim() : undefined;
    const signupIntent = body.signupIntent ? String(body.signupIntent).trim() : undefined;

    let phoneE164: string | undefined;
    if (method === 'phone') {
      const normalized = normalizeGuineaPhone(String(body.phone ?? '').trim());
      if (!normalized) {
        return NextResponse.json(
          { error: 'Numéro invalide. Format : 6XX XX XX XX (Guinée)' },
          { status: 400 }
        );
      }
      phoneE164 = normalized;
    }

    const email = method === 'email' ? String(body.email ?? '').trim() : undefined;

    const created = await registerAuthAccount({
      method,
      email,
      phoneE164,
      password,
      fullName,
      accountIntent,
      signupIntent,
    });

    if ('error' in created) {
      return NextResponse.json({ error: created.error }, { status: 400 });
    }

    const supabase = await createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: created.email,
      password,
    });

    if (signInError) {
      return NextResponse.json(
        { error: 'Compte créé mais connexion impossible. Essayez de vous connecter.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      userId: created.userId,
      method,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
