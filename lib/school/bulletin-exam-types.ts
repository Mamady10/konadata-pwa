/** Types d'évaluation pris en compte dans les bulletins. */

export const BULLETIN_EXAM_TYPE_PRESETS = [
  '1ère évaluation',
  '2ème évaluation',
  'Devoir',
  'Composition',
  'Examen',
  'Interrogation',
] as const;

export type BulletinExamTypePreset = (typeof BULLETIN_EXAM_TYPE_PRESETS)[number];

export function normalizeExamType(raw: unknown): string {
  if (typeof raw !== 'string') return 'default';
  const t = raw.trim();
  return t || 'default';
}

export function parseIncludedExamTypes(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const out = raw
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter(Boolean);
  return out.length > 0 ? [...new Set(out)] : null;
}

export function isExamTypeIncluded(
  examType: string,
  included: string[] | null | undefined
): boolean {
  if (!included || included.length === 0) return true;
  const norm = normalizeExamType(examType);
  return included.some((x) => normalizeExamType(x) === norm);
}

export function filterByIncludedExamTypes<T extends { examType: string }>(
  rows: T[],
  included: string[] | null | undefined
): T[] {
  if (!included?.length) return rows;
  return rows.filter((r) => isExamTypeIncluded(r.examType, included));
}

/** Fusionne types saisis, évaluations définies et presets courants. */
export function mergeDistinctExamTypes(...sources: Array<string[] | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const source of sources) {
    for (const raw of source ?? []) {
      const norm = normalizeExamType(raw);
      const key = norm.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(norm === 'default' ? raw.trim() || 'default' : norm);
    }
  }
  return out.sort((a, b) => a.localeCompare(b, 'fr'));
}

export function formatIncludedExamTypesLabel(
  included: string[] | null | undefined,
  maxItems = 4
): string | null {
  if (!included?.length) return null;
  if (included.length <= maxItems) return included.join(', ');
  return `${included.slice(0, maxItems).join(', ')} +${included.length - maxItems}`;
}

export function resolveIncludedExamTypesForBulletin(
  explicit: string[] | null | undefined,
  orgDefault: string[] | null | undefined,
  available: string[]
): string[] | null {
  const pick = explicit ?? orgDefault;
  if (!pick?.length) return null;
  const filtered = pick.filter((t) =>
    available.some((a) => normalizeExamType(a) === normalizeExamType(t))
  );
  return filtered.length > 0 ? filtered : null;
}
