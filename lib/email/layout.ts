import { getResendConfig } from '@/lib/email/resend-client';

/** Enveloppe HTML commune pour les emails transactionnels KonaData. */
export function konaEmailLayout(title: string, bodyHtml: string): string {
  const { appUrl } = getResendConfig();
  const siteLabel = appUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a;">
      <h1 style="color:#2563EB;font-size:20px;margin:0 0 16px;">${title}</h1>
      ${bodyHtml}
      <p style="color:#94a3b8;font-size:12px;margin-top:32px;border-top:1px solid #e2e8f0;padding-top:16px;">
        KonaData — Guinée · <a href="${appUrl}" style="color:#64748b;">${siteLabel}</a>
      </p>
    </div>
  `;
}
