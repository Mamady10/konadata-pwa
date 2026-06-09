import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendTuitionReminderSms } from '@/lib/school/send-tuition-reminder';
import { normalizeGuineaPhone } from '@/lib/survey/phone';

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
  student_id: string;
  enrollment_id: string | null;
  student_name: string;
  guardian_phone: string;
  guardian_name: string | null;
  installment_index: number;
  installment_label: string;
  due_date: string;
  remaining_gnf: number;
  academic_year: string;
};

async function processKind(kind: '7d' | '1d' | 'due' | 'overdue') {
  const supabase = await createServiceClient();
  const { data, error } = await supabase.rpc('list_school_tuition_reminder_targets', {
    p_reminder_kind: kind,
  });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as ReminderRow[];
  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    const phoneE164 = normalizeGuineaPhone(row.guardian_phone);
    if (!phoneE164) {
      failed += 1;
      continue;
    }

    const smsRes = await sendTuitionReminderSms({
      phoneE164,
      guardianName: row.guardian_name,
      studentName: row.student_name,
      orgName: row.organization_name,
      installmentLabel: row.installment_label,
      dueDate: row.due_date,
      remainingGnf: Number(row.remaining_gnf ?? 0),
      reminderKind: kind,
    });

    if (!smsRes.ok) {
      console.error('[cron/tuition-reminders]', row.student_id, smsRes.error);
      failed += 1;
      continue;
    }

    await supabase.from('school_tuition_reminder_log').insert({
      organization_id: row.organization_id,
      student_id: row.student_id,
      enrollment_id: row.enrollment_id,
      installment_index: row.installment_index,
      reminder_kind: kind,
      phone_e164: phoneE164,
      academic_year: row.academic_year,
    });

    sent += 1;
  }

  return { kind, sent, failed, total: rows.length };
}

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const results = await Promise.all([
      processKind('7d'),
      processKind('1d'),
      processKind('due'),
      processKind('overdue'),
    ]);

    return NextResponse.json({ ok: true, results });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur cron' },
      { status: 500 }
    );
  }
}
