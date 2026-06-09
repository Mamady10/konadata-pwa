import { sendTransactionalSms } from '@/lib/auth/send-auth-otp';
import { formatCurrency } from '@/lib/utils';

export interface TuitionReminderPayload {
  phoneE164: string;
  guardianName: string | null;
  studentName: string;
  orgName: string;
  installmentLabel: string;
  dueDate: string;
  remainingGnf: number;
  reminderKind: '7d' | '1d' | 'due' | 'overdue';
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

export function buildTuitionReminderSms(p: TuitionReminderPayload): string {
  const who = p.guardianName?.trim() ? p.guardianName.trim() : 'Bonjour';
  const when =
    p.reminderKind === 'overdue'
      ? `échéance dépassée (${formatDueDate(p.dueDate)})`
      : p.reminderKind === 'due'
        ? "aujourd'hui"
        : p.reminderKind === '1d'
          ? 'demain'
          : `le ${formatDueDate(p.dueDate)}`;

  return (
    `${who} — KonaData / ${p.orgName}\n` +
    `Rappel scolarité ${p.studentName}: tranche « ${p.installmentLabel} » ${when}.\n` +
    `Solde restant: ${formatCurrency(p.remainingGnf)}.\n` +
    `Payer: ${appBaseUrl()}/payer-scolarite · Suivi: ${appBaseUrl()}/suivi-scolarite`
  );
}

export async function sendTuitionReminderSms(
  payload: TuitionReminderPayload
): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  const body = buildTuitionReminderSms(payload);
  const res = await sendTransactionalSms(payload.phoneE164, body);
  if (!res.ok && res.skipped) {
    console.log(`[tuition-reminder DEV] ${payload.phoneE164}: ${body}`);
    return { ok: true, skipped: true };
  }
  return res;
}
