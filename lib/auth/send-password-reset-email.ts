import { createServiceClient } from '@/lib/supabase/server';
import { isSyntheticAuthEmail, isSyntheticPhoneEmail } from '@/lib/auth/phone-email';
import { findProfilesByContactEmail } from '@/lib/auth/contact-accounts';
import { konaEmailLayout } from '@/lib/email/layout';
import { sendResendEmail } from '@/lib/email/resend-client';

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

async function sendOneRecoveryMail(params: {
  to: string;
  authEmail: string;
  accountLabel?: string;
}): Promise<{ ok: boolean; error?: string; devResetUrl?: string }> {
  const service = await createServiceClient();
  const redirectTo = `${appBaseUrl()}/auth/confirm?next=/reset-password`;

  const { data, error } = await service.auth.admin.generateLink({
    type: 'recovery',
    email: params.authEmail,
    options: { redirectTo },
  });

  if (error || !data?.properties?.hashed_token) {
    return { ok: false, error: error?.message ?? 'generateLink recovery impossible' };
  }

  const resetUrl = buildRecoveryUrl(data.properties.hashed_token);
  const label = params.accountLabel ? ` (${params.accountLabel})` : '';

  const body = `
    <p>Bonjour,</p>
    <p>Vous avez demandé à réinitialiser votre mot de passe KonaData${label}.</p>
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
    to: params.to,
    subject: 'Réinitialisation mot de passe — KonaData',
    html: konaEmailLayout('Mot de passe oublié', body),
  });

  if (!mail.ok) {
    return { ok: false, error: mail.error, devResetUrl: resetUrl };
  }
  return { ok: true, devResetUrl: resetUrl };
}

export async function sendPasswordResetEmail(
  emailRaw: string
): Promise<SendPasswordResetEmailResult> {
  const email = emailRaw.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return { requested: true, sent: false, error: 'Email invalide' };
  }
  if (isSyntheticPhoneEmail(email) || isSyntheticAuthEmail(email)) {
    return {
      requested: true,
      sent: false,
      error: 'Compte téléphone — utilisez la récupération par WhatsApp/SMS.',
    };
  }

  const service = await createServiceClient();
  const accounts = await findProfilesByContactEmail(service, email);

  const targets =
    accounts.length > 0
      ? accounts.map((a) => ({
          authEmail: a.authEmail,
          to: email,
          label: a.label,
        }))
      : [{ authEmail: email, to: email, label: undefined as string | undefined }];

  let sentAny = false;
  let lastError: string | undefined;
  let devResetUrl: string | undefined;

  for (const target of targets) {
    const result = await sendOneRecoveryMail({
      to: target.to,
      authEmail: target.authEmail,
      accountLabel: target.label,
    });
    if (result.ok) {
      sentAny = true;
      if (result.devResetUrl) devResetUrl = result.devResetUrl;
    } else {
      lastError = result.error;
      if (result.devResetUrl) devResetUrl = result.devResetUrl;
    }
  }

  if (sentAny) {
    return { requested: true, sent: true, ...(devResetUrl ? { devResetUrl } : {}) };
  }

  if (process.env.NODE_ENV === 'development') {
    return {
      requested: true,
      sent: false,
      error: lastError ?? 'Aucun compte trouvé',
      ...(devResetUrl ? { devResetUrl } : {}),
    };
  }

  // Ne pas révéler l'existence du compte en production
  return { requested: true, sent: true };
}
