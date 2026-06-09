export type ResendSendResult = {
  ok: boolean;
  error?: string;
  skipped?: boolean;
  id?: string;
};

export function getResendConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim() || 'KonaData <onboarding@resend.dev>';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const contactInbox =
    process.env.KONA_CONTACT_INBOX?.trim() ||
    process.env.RESEND_REPLY_TO?.trim() ||
    null;

  return { apiKey, from, appUrl, contactInbox };
}

export function isResendConfigured(apiKey?: string | null): boolean {
  return Boolean(apiKey?.startsWith('re_'));
}

function parseResendError(status: number, body: string, from: string): string {
  let detail = body.slice(0, 300);
  try {
    const parsed = JSON.parse(body) as { message?: string };
    if (parsed.message) detail = parsed.message;
  } catch {
    // keep raw body
  }
  if (status === 403 && from.includes('resend.dev')) {
    detail +=
      ' — En mode test (onboarding@resend.dev), Resend n’envoie qu’à l’email de votre compte Resend.';
  }
  return detail;
}

export async function sendResendEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<ResendSendResult> {
  const { apiKey, from } = getResendConfig();

  if (!apiKey) {
    return {
      ok: false,
      skipped: true,
      error: 'RESEND_API_KEY vide — ajoutez votre clé re_… dans .env.local puis redémarrez le serveur.',
    };
  }

  if (!isResendConfigured(apiKey)) {
    return {
      ok: false,
      skipped: true,
      error: 'RESEND_API_KEY invalide (doit commencer par re_).',
    };
  }

  const recipients = (Array.isArray(params.to) ? params.to : [params.to])
    .map((e) => e.trim())
    .filter(Boolean);

  if (!recipients.length) {
    return { ok: false, error: 'Aucun destinataire email.' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject: params.subject,
        html: params.html,
        ...(params.replyTo ? { reply_to: params.replyTo } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return {
        ok: false,
        error: `Envoi email échoué (${res.status}): ${parseResendError(res.status, body, from)}`,
      };
    }

    let id: string | undefined;
    try {
      const json = (await res.json()) as { id?: string };
      id = json.id;
    } catch {
      // response may be empty
    }

    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur réseau email' };
  }
}
