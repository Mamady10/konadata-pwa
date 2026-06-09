export function normalizeSchoolOrgName(name: string): string {
  return name.trim().toLowerCase();
}

export function formatPublicSchoolLabel(school: {
  name: string;
  city?: string | null;
  email?: string | null;
}): string {
  const parts = [school.name];
  if (school.city?.trim()) parts.push(school.city.trim());
  if (school.email?.trim()) parts.push(school.email.trim());
  return parts.join(' — ');
}

export function findDuplicateSchoolNameKeys(
  schools: Array<{ name: string }>
): Set<string> {
  const counts = new Map<string, number>();
  for (const s of schools) {
    const key = normalizeSchoolOrgName(s.name);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const dupes = new Set<string>();
  for (const [key, n] of counts) {
    if (n > 1) dupes.add(key);
  }
  return dupes;
}
