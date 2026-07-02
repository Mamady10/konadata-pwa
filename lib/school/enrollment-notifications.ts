import { normalizeGuineaPhone } from '@/lib/survey/phone';
import { sendNotification } from '@/lib/notifications/send-notification';

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim()?.replace(/^/, 'https://') ||
    'http://localhost:3000'
  );
}

/** WhatsApp prioritaire (canal le plus fiable), repli SMS. */
async function notifyGuardian(
  phoneE164: string,
  text: string
): Promise<{ sent: boolean; skipped?: string }> {
  const res = await sendNotification({
    recipient: { phone: phoneE164 },
    content: { text },
    channels: ['whatsapp', 'sms'],
  });
  if (res.ok) return { sent: true };
  const lastError = res.attempts[res.attempts.length - 1]?.error;
  return { sent: false, skipped: lastError ?? 'Envoi impossible' };
}

export async function notifyEnrollmentConfirmed(params: {
  guardianPhone: string | null;
  guardianSmsConsent: boolean;
  studentName: string;
  orgName: string;
  className: string | null;
}): Promise<{ sent: boolean; skipped?: string }> {
  if (!params.guardianSmsConsent) {
    return { sent: false, skipped: 'Consentement notifications non accordé' };
  }
  if (!params.guardianPhone?.trim()) {
    return { sent: false, skipped: 'Téléphone tuteur manquant' };
  }

  const phoneE164 = normalizeGuineaPhone(params.guardianPhone);
  if (!phoneE164) {
    return { sent: false, skipped: 'Numéro invalide' };
  }

  const classPart = params.className ? ` Classe : ${params.className}.` : '';
  const body = `KonaData — ${params.orgName} : inscription confirmée pour ${params.studentName}.${classPart} Suivi : ${appBaseUrl()}/suivi-scolarite`;

  return notifyGuardian(phoneE164, body);
}

export async function notifyBulletinPublished(params: {
  guardianPhone: string | null;
  guardianSmsConsent: boolean;
  studentName: string;
  orgName: string;
  semester: string;
  isFinal: boolean;
}): Promise<{ sent: boolean; skipped?: string }> {
  if (!params.guardianSmsConsent) {
    return { sent: false, skipped: 'Consentement notifications non accordé' };
  }
  if (!params.guardianPhone?.trim()) {
    return { sent: false, skipped: 'Téléphone tuteur manquant' };
  }

  const phoneE164 = normalizeGuineaPhone(params.guardianPhone);
  if (!phoneE164) {
    return { sent: false, skipped: 'Numéro invalide' };
  }

  const kind = params.isFinal ? 'définitif' : 'provisoire';
  const portalUrl = `${appBaseUrl()}/suivi-scolarite`;
  const body = `KonaData — ${params.orgName} : bulletin ${params.semester} (${kind}) pour ${params.studentName}. Téléchargez sur ${portalUrl}`;

  return notifyGuardian(phoneE164, body);
}

export async function notifyImportWelcome(params: {
  guardianPhone: string | null;
  guardianSmsConsent: boolean;
  studentName: string;
  matricule: string | null;
  orgName: string;
  className: string | null;
}): Promise<{ sent: boolean; skipped?: string }> {
  if (!params.guardianSmsConsent) {
    return { sent: false, skipped: 'Consentement notifications non accordé' };
  }
  if (!params.guardianPhone?.trim()) {
    return { sent: false, skipped: 'Téléphone tuteur manquant' };
  }

  const phoneE164 = normalizeGuineaPhone(params.guardianPhone);
  if (!phoneE164) {
    return { sent: false, skipped: 'Numéro invalide' };
  }

  const codePart = params.matricule ? ` Code : ${params.matricule}.` : '';
  const classPart = params.className ? ` Classe : ${params.className}.` : '';
  const body = `KonaData — ${params.orgName} : ${params.studentName} est inscrit(e).${classPart}${codePart} Suivi : ${appBaseUrl()}/suivi-scolarite`;

  return notifyGuardian(phoneE164, body);
}
