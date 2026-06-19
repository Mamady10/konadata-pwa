import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/** @deprecated Utiliser /api/auth/phone/complete-signup ou /api/auth/email/complete-signup après OTP. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const method = body.method === 'phone' ? 'phone' : 'email';

    return NextResponse.json(
      {
        error:
          method === 'phone'
            ? 'Confirmez votre numéro avec le code WhatsApp/SMS avant de créer le compte.'
            : 'Confirmez votre email avec le code reçu avant de créer le compte.',
      },
      { status: 400 }
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
