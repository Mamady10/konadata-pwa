import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { normalizeGuineaPhone } from '@/lib/survey/phone';
import { isSyntheticPhoneEmail } from '@/lib/auth/phone-email';
import {
  findProfilesByContactEmail,
  findProfilesByPhone,
} from '@/lib/auth/contact-accounts';

export const runtime = 'nodejs';

/**
 * Liste les comptes associés à un WhatsApp ou un email de contact (partage autorisé).
 * Utilisé à la connexion / récupération pour choisir le bon compte.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const method = String(body.method ?? '').trim();
    const supabase = await createServiceClient();

    if (method === 'phone') {
      const phoneE164 = normalizeGuineaPhone(String(body.phone ?? '').trim());
      if (!phoneE164) {
        return NextResponse.json(
          { error: 'Numéro invalide. Format : 6XX XX XX XX (Guinée).' },
          { status: 400 }
        );
      }
      const accounts = await findProfilesByPhone(supabase, phoneE164);
      return NextResponse.json({
        success: true,
        accounts: accounts.map((a) => ({
          id: a.id,
          label: a.label,
          authEmail: a.authEmail,
        })),
      });
    }

    if (method === 'email') {
      const email = String(body.email ?? '').trim().toLowerCase();
      if (!email) {
        return NextResponse.json({ error: 'Email requis' }, { status: 400 });
      }
      if (isSyntheticPhoneEmail(email)) {
        return NextResponse.json({ error: 'Adresse email invalide.' }, { status: 400 });
      }
      const accounts = await findProfilesByContactEmail(supabase, email);
      return NextResponse.json({
        success: true,
        accounts: accounts.map((a) => ({
          id: a.id,
          label: a.label,
          authEmail: a.authEmail,
        })),
      });
    }

    return NextResponse.json({ error: 'Méthode invalide (phone | email).' }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
