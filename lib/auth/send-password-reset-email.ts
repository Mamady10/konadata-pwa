import { createServiceClient } from '@/lib/supabase/server';
import { isSyntheticPhoneEmail } from '@/lib/auth/phone-email';
import { konaEmailLayout } from '@/lib/email/layout';
import { getResendConfig, sendResendEmail, type ResendSendResult } from '@/lib/email/resend-client';

export interface SendPasswordResetEmailResult {
  /** Toujours true côté API pour ne pas révéler si le compte existe. */
  requested: true;
  sent: boolean;
  error?: string;
  devResetUrl?: string;
}

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://www.konadatagn.com').replace(/\/$/, '');
}

function buildRecoveryUrl(tokenHash: string): string {
  const base = appBaseUrl();
  const qs = new URLSearchParams({
    token_hash: tokenHash,
    type: 'recovery',
    next: '/reset-password',
  });
  return `${base}/auth/confirm?${qs.toString()}`;
}

export async function sendPasswordResetEmail(
  emailRaw: string
): Promise<SendPasswordResetEmailResult> {
  const email = emailRaw.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return { requested: true, sent: false, error: 'Email invalide' };
  }
  if (isSyntheticPhoneEmail(email)) {
    return {
      requested: true,
      sent: false,
      error: 'Compte téléphone — utilisez la récupération par WhatsApp/SMS.',
    };
  }

  const service = await createServiceClient();
  const redirectTo = `${appBaseUrl()}/auth/confirm?next=/reset-password`;

  const { data, error } = await service.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo },
  });

  if (error || !data?.properties?.hashed_token) {
    // Compte inconnu ou erreur Supabase — ne pas révéler en prod
    if (process.env.NODE_ENV === 'development') {
      return {
        requested: true,
        sent: false,
        error: error?.message ?? 'generateLink recovery impossible',
      };
    }
    return { requested: true, sent: true };
  }

  const resetUrl = buildRecoveryUrl(data.properties.hashed_token);

  const body = `
    <p>Bonjour,</p>
    <p>Vous avez demandé à réinitialiser votre mot de passe KonaData.</p>
    <p style="margin:28px 0;text-align:center;">
      <a href="${resetUrl}"
         style="display:inline-block;background:#2563EB;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">
        Choisir un nouveau mot de passe
      </a>
    </p>
    <p style="color:#64748b;font-size:14px;">
      Ce lien est valable 60 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
    </p>
    <p style="color:#94a3b8;font-size:12px;word-break:break-all;">
      Lien direct : ${resetUrl}
    </p>
  `;

  const mail = await sendResendEmail({
    to: email,
    subject: 'Réinitialisation mot de passe — KonaData',
    html: konaEmailLayout('Mot de passe oublié', body),
  });

  if (!mail.ok) {
    if (process.env.NODE_ENV === 'development') {
      return {
        requested: true,
        sent: false,
        error: mail.error,
        devResetUrl: resetUrl,
      };
    }
    return { requested: true, sent: false, error: mail.error };
  }

  return { requested: true, sent: true };
}
