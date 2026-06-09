import type { SupabaseClient } from '@supabase/supabase-js';

/** Au moins une demande d'inscription liée au compte (tous établissements). */
export async function learnerHasEnrollmentHistory(
  supabase: SupabaseClient,
  userId?: string
): Promise<boolean> {
  const { data: rpcData, error: rpcErr } = await supabase.rpc('learner_has_enrollment_history');
  if (!rpcErr && typeof rpcData === 'boolean') {
    return rpcData;
  }

  if (!userId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    userId = user.id;
  }

  const { data: persons, error: personErr } = await supabase
    .from('core_persons')
    .select('id')
    .eq('profile_id', userId);

  if (personErr || !persons?.length) return false;

  const personIds = persons.map((p) => p.id as string);
  const { data: students, error: studentErr } = await supabase
    .from('school_students')
    .select('id')
    .in('person_id', personIds);

  if (studentErr || !students?.length) return false;

  const studentIds = students.map((s) => s.id as string);
  const { count, error: enrErr } = await supabase
    .from('school_enrollments')
    .select('id', { count: 'exact', head: true })
    .in('student_id', studentIds);

  if (enrErr) return false;
  return (count ?? 0) > 0;
}

export function isLearnerRole(role: string | null | undefined): boolean {
  return role === 'candidate' || role === 'student';
}

/** Parcours choix établissement uniquement pour les nouveaux candidats sans historique. */
export function learnerNeedsSchoolOnboarding(options: {
  role?: string | null;
  organizationId?: string | null;
  accountIntent?: string | null;
  onboardingPath?: string | null;
  hasEnrollmentHistory: boolean;
}): boolean {
  const staffRoles = new Set([
    'org_admin',
    'deputy_director',
    'registrar',
    'accountant',
    'teacher',
    'ngo_staff',
    'btp_staff',
    'pme_staff',
    'platform_admin',
  ]);
  if (options.role && staffRoles.has(options.role)) return false;

  const isLearner =
    options.accountIntent === 'learner' ||
    options.onboardingPath === 'learner' ||
    isLearnerRole(options.role);

  if (!isLearner) return false;
  if (options.hasEnrollmentHistory || options.organizationId) return false;
  return true;
}
