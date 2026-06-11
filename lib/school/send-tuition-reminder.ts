import { sendWhatsAppOtpMessage } from '@/lib/integrations/whatsapp';
import { formatCurrency } from '@/lib/utils';

export interface TuitionReminderPayload {
  phoneE164: string;
  guardianName: string | null;
  studentName: string;
  orgName: string;
  installmentLabel: string;
  dueDate: string;
  remainingGnf: number;
}

function formatDueDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
    });
  } catch {
    return iso;
  }
}

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim()?.replace(/^/, 'https://') ||
    'https://konadatagn.com'
  );
}

export function buildTuitionReminderWhatsAppMessage(p: TuitionReminderPayload): string {
  const who = p.guardianName?.trim() ? p.guardianName.trim() : 'Bonjour';

  return (
    `${who} — KonaData / ${p.orgName}\n` +
    `Rappel scolarité (${p.studentName}) : tranche « ${p.installmentLabel} » due demain (${formatDueDate(p.dueDate)}).\n` +
    `Solde restant : ${formatCurrency(p.remainingGnf)}.\n` +
    `Payer : ${appBaseUrl()}/payer-scolarite\n` +
    `Suivi : ${appBaseUrl()}/suivi-scolarite`
  );
}

/** Rappel unique J-1 — WhatsApp (Meta Cloud API). */
export async function sendTuitionReminderWhatsApp(
  payload: TuitionReminderPayload
): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  const body = buildTuitionReminderWhatsAppMessage(payload);
  const res = await sendWhatsAppOtpMessage(payload.phoneE164, body);
  if (!res.ok && res.skipped) {
    console.log(`[tuition-reminder WhatsApp DEV] ${payload.phoneE164}: ${body}`);
    return { ok: true, skipped: true };
  }
  return res;
}
