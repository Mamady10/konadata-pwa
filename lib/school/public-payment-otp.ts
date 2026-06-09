import type { createServiceClient } from '@/lib/supabase/server';
import { normalizeGuineaPhone } from '@/lib/survey/phone';

type Supabase = Awaited<ReturnType<typeof createServiceClient>>;

export function phonesMatch(a: string, b: string): boolean {
  const na = normalizeGuineaPhone(a);
  const nb = normalizeGuineaPhone(b);
  return Boolean(na && nb && na === nb);
}

export async function studentPhoneAuthorized(
  supabase: Supabase,
  studentId: string,
  phoneE164: string
): Promise<boolean> {
  const { data: student } = await supabase
    .from('school_students')
    .select('id, person_id')
    .eq('id', studentId)
    .maybeSingle();

  if (!student?.person_id) return false;

  const { data: person } = await supabase
    .from('core_persons')
    .select('phone')
    .eq('id', student.person_id)
    .maybeSingle();

  if (person?.phone && phonesMatch(person.phone as string, phoneE164)) {
    return true;
  }

  const { data: enrollments } = await supabase
    .from('school_enrollments')
    .select('guardian_phone, applicant_phone')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(5);

  for (const e of enrollments ?? []) {
    if (e.guardian_phone && phonesMatch(e.guardian_phone as string, phoneE164)) return true;
    if (e.applicant_phone && phonesMatch(e.applicant_phone as string, phoneE164)) return true;
  }

  return false;
}
