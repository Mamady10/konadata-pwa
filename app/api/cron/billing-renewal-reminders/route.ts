import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  sendBillingRenewalReminderEmail,
  type RenewalReminderKind,
} from '@/lib/email/send-billing-reminder';

export const runtime = 'nodejs';
export const maxDuration = 60;

function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  return request.headers.get('x-cron-secret') === secret;
}

type ReminderRow = {
  organization_id: string;
  organization_name: string;
  director_email: string;
  director_name: string;
  valid_until: string;
  reminder_kind: string;
  access_mode: string;
};

async function processDaysBefore(days: number) {
  const supabase = await createServiceClient();
  const { data, error } = await supabase.rpc('list_billing_renewal_reminder_targets', {
    p_days_before: days,
  });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as ReminderRow[];
  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    if (!row.director_email?.trim()) {
      failed += 1;
      continue;
    }

    const kind = row.reminder_kind as RenewalReminderKind;
    const emailRes = await sendBillingRenewalReminderEmail({
      to: row.director_email,
      directorName: row.director_name,
      orgName: row.organization_name,
      validUntil: row.valid_until,
      kind,
      accessMode: row.access_mode ?? 'annual',
    });

    if (!emailRes.ok) {
      console.error('[cron/billing-reminders]', row.organization_id, emailRes.error);
      failed += 1;
      continue;
    }

    await supabase.rpc('record_billing_renewal_reminder_sent', {
      p_org_id: row.organization_id,
      p_kind: kind,
      p_valid_until: row.valid_until,
      p_email: row.director_email,
    });
    sent += 1;
  }

  return { days, total: rows.length, sent, failed };
}

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const j30 = await processDaysBefore(30);
    const j7 = await processDaysBefore(7);
    return NextResponse.json({
      success: true,
      at: new Date().toISOString(),
      results: [j30, j7],
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur cron';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
