'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireOrgId } from '@/lib/actions/org';
import { getSession } from '@/lib/actions/auth';
import { getEtablissementCapabilities } from '@/lib/school/etablissement-access';

export interface ScheduleSlotRow {
  id: string;
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_name: string;
  teacher_id: string | null;
  teacher_name: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
}

async function assertCanManageSchedules() {
  const session = await getSession();
  const caps = getEtablissementCapabilities(session?.profile?.role);
  if (!caps.isDirector && session?.profile?.role !== 'registrar') {
    return { error: 'Réservé à la direction ou la scolarité.' } as const;
  }
  return { ok: true as const };
}

export async function getClassSchedule(classId: string): Promise<
  ScheduleSlotRow[] | { error: string }
> {
  if (!classId?.trim()) return { error: 'Classe requise.' };
  const orgId = await requireOrgId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('school_schedules')
    .select(
      `id, class_id, subject_id, teacher_id, day_of_week, start_time, end_time, room,
       school_classes(name),
       school_subjects(name),
       school_teachers(core_persons(full_name))`
    )
    .eq('organization_id', orgId)
    .eq('class_id', classId)
    .order('day_of_week')
    .order('start_time');

  if (error) return { error: error.message };

  return (data ?? []).map((row) => {
    const teacher = row.school_teachers as {
      core_persons?: { full_name?: string };
    } | null;
    return {
      id: row.id as string,
      class_id: row.class_id as string,
      class_name: (row.school_classes as { name?: string })?.name ?? '—',
      subject_id: row.subject_id as string,
      subject_name: (row.school_subjects as { name?: string })?.name ?? '—',
      teacher_id: (row.teacher_id as string) ?? null,
      teacher_name: teacher?.core_persons?.full_name ?? null,
      day_of_week: row.day_of_week as number,
      start_time: String(row.start_time).slice(0, 5),
      end_time: String(row.end_time).slice(0, 5),
      room: (row.room as string) ?? null,
    };
  });
}

export async function saveScheduleSlot(input: {
  id?: string;
  classId: string;
  subjectId: string;
  teacherId?: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string;
}) {
  const guard = await assertCanManageSchedules();
  if ('error' in guard) return guard;

  const orgId = await requireOrgId();
  const supabase = await createClient();

  if (input.dayOfWeek < 0 || input.dayOfWeek > 6) {
    return { error: 'Jour invalide (0=lundi … 6=dimanche).' };
  }

  const payload = {
    organization_id: orgId,
    class_id: input.classId,
    subject_id: input.subjectId,
    teacher_id: input.teacherId || null,
    day_of_week: input.dayOfWeek,
    start_time: input.startTime,
    end_time: input.endTime,
    room: input.room?.trim() || null,
  };

  if (input.id) {
    const { error } = await supabase
      .from('school_schedules')
      .update(payload)
      .eq('id', input.id)
      .eq('organization_id', orgId);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from('school_schedules').insert(payload);
    if (error) return { error: error.message };
  }

  revalidatePath('/etablissement/vie-scolaire');
  return { success: true };
}

export async function deleteScheduleSlot(slotId: string) {
  const guard = await assertCanManageSchedules();
  if ('error' in guard) return guard;

  const orgId = await requireOrgId();
  const supabase = await createClient();
  const { error } = await supabase
    .from('school_schedules')
    .delete()
    .eq('id', slotId)
    .eq('organization_id', orgId);

  if (error) return { error: error.message };
  revalidatePath('/etablissement/vie-scolaire');
  return { success: true };
}
