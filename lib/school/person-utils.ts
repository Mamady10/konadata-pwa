/** Helpers affichage — schéma v2 (core_persons) */

export type CorePersonRef = {
  full_name?: string;
  email?: string | null;
  phone?: string | null;
};

export function resolvePerson(
  ref: CorePersonRef | CorePersonRef[] | null | undefined
): CorePersonRef | null {
  if (!ref) return null;
  return Array.isArray(ref) ? ref[0] ?? null : ref;
}

export function personName(
  row: { core_persons?: CorePersonRef | CorePersonRef[] | null; full_name?: string } | null | undefined
): string {
  if (!row) return '—';
  const p = resolvePerson(row.core_persons);
  return p?.full_name ?? row.full_name ?? '—';
}

export function personEmail(row: { core_persons?: CorePersonRef | CorePersonRef[] | null; email?: string } | null): string {
  const p = resolvePerson(row?.core_persons);
  return p?.email ?? row?.email ?? '—';
}

export const STUDENT_WITH_PERSON =
  '*, core_persons(full_name, email, phone, gender, date_of_birth), school_classes(name, level)';

export const TEACHER_WITH_PERSON = '*, core_persons(full_name, email, phone)';

export const STUDENT_NESTED = 'id, matricule, enrollment_status, core_persons(full_name, email, phone)';
