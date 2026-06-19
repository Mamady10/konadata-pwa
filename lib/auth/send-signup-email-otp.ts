import { getResendConfig, isResendConfigured, sendResendEmail } from '@/lib/email/resend-client';

function isDevSignupOtpMode(): boolean {
  return (
    process.env.AUTH_OTP_DEV_MODE === 'true' ||
    process.env.SURVEY_OTP_DEV_MODE === 'true' ||
    process.env.NODE_ENV === 'development'
  );
}

export async function sendSignupEmailOtp(
  email: string,
  code: string
): Promise<{ ok: boolean; error?: string; devCode?: string }> {
  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#0A192F;margin:0 0 12px">Confirmez votre inscription</h2>
      <p style="color:#334155;line-height:1.5">Utilisez ce code pour finaliser la création de votre compte KonaData :</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:4px;color:#2563EB;margin:20px 0">${code}</p>
      <p style="color:#64748B;font-size:13px">Valide 10 minutes. Si vous n'avez pas demandé ce code, ignorez cet email.</p>
    </div>
  `;

  const { apiKey } = getResendConfig();
  if (!apiKey || !isResendConfigured(apiKey)) {
    if (isDevSignupOtpMode()) {
      console.log(`[Signup Email OTP DEV] ${email}: ${code}`);
      return { ok: true, devCode: code };
    }
    return { ok: false, error: 'Envoi email non configuré (RESEND_API_KEY).' };
  }

  const sent = await sendResendEmail({
    to: email,
    subject: 'KonaData — Code de confirmation inscription',
    html,
  });

  if (!sent.ok) {
    if (isDevSignupOtpMode()) {
      console.log(`[Signup Email OTP DEV fallback] ${email}: ${code}`);
      return { ok: true, devCode: code };
    }
    return { ok: false, error: sent.error ?? 'Envoi email échoué' };
  }

  return { ok: true };
}
