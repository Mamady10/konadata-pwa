import { NextRequest, NextResponse } from 'next/server';
import { sendContactFormEmails } from '@/lib/email/send-contact';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = String(body.name ?? '').trim();
    const email = String(body.email ?? '').trim();
    const message = String(body.message ?? '').trim();
    const organization = String(body.organization ?? '').trim();

    if (!name || !email || !message) {
      return NextResponse.json(
        { success: false, error: 'Nom, email et message sont obligatoires.' },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Adresse email invalide.' },
        { status: 400 }
      );
    }

    if (message.length > 5000) {
      return NextResponse.json(
        { success: false, error: 'Message trop long (5000 caractères max).' },
        { status: 400 }
      );
    }

    const { inbox, confirmation } = await sendContactFormEmails({
      name,
      email,
      message,
      organization: organization || undefined,
    });

    if (!inbox.ok && inbox.skipped) {
      console.warn('[API /contact] Resend non configuré — message non envoyé par email');
    } else if (!inbox.ok) {
      console.error('[API /contact] inbox', inbox.error);
      return NextResponse.json(
        { success: false, error: inbox.error ?? 'Envoi email impossible.' },
        { status: 502 }
      );
    }

    if (!confirmation.ok && !confirmation.skipped) {
      console.warn('[API /contact] confirmation non envoyée', confirmation.error);
    }

    try {
      const supabase = await createServiceClient();
      if (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
        const { error: dbErr } = await supabase.from('contact_messages').insert({
          name,
          email: email.toLowerCase(),
          organization: organization || null,
          message,
        });
        if (dbErr && !dbErr.message.includes('contact_messages')) {
          console.warn('[API /contact] stockage', dbErr.message);
        }
      }
    } catch (e) {
      console.warn('[API /contact] stockage ignoré', e);
    }

    return NextResponse.json(
      { success: true, message: 'Message reçu avec succès.' },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: 'Corps de requête invalide.' },
      { status: 400 }
    );
  }
}
