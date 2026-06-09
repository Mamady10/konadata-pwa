/**
 * Code de réinscription permanent — réutilisable d'année en année.
 * Format : {ÉTAB}-{NOM}-{NNNN}
 * Ex. LYCKAL-DIALA-2847 (Lycée Kaloum, Diallo Aminata, identifiant stable)
 */

export type PermanentReenrollmentCodeInput = {
  orgName: string;
  orgPrefix?: string | null;
  studentFullName: string;
  studentId: string;
};

const ORG_STOP_WORDS = new Set([
  'lycee',
  'lycée',
  'ecole',
  'école',
  'college',
  'collège',
  'institut',
  'de',
  'du',
  'la',
  'le',
  'les',
  'des',
  'et',
]);

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '');
}

function lettersOnly(value: string): string {
  return stripAccents(value).replace(/[^A-Za-z]/g, '').toUpperCase();
}

/** Abréviation établissement (6 car. max), sans classe ni année. */
export function orgSlugForReenrollment(orgName: string, orgPrefix?: string | null): string {
  if (orgPrefix?.trim()) {
    const p = lettersOnly(orgPrefix.trim());
    if (p.length >= 2) return p.slice(0, 6);
  }
  const words = stripAccents(orgName)
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Za-z]/g, ''))
    .filter((w) => w.length > 2 && !ORG_STOP_WORDS.has(w.toLowerCase()));

  if (words.length >= 2) {
    return (words[0].slice(0, 3) + words[1].slice(0, 3)).toUpperCase();
  }
  const compact = lettersOnly(orgName);
  return (compact || 'ECOLE').slice(0, 6);
}

/** Partie nom : nom de famille (4 car.) + initiale prénom. */
export function nameTokenForReenrollment(fullName: string): string {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => lettersOnly(p))
    .filter(Boolean);

  if (parts.length === 0) return 'ELEV';
  if (parts.length === 1) return parts[0].slice(0, 6);
  const last = parts[parts.length - 1].slice(0, 4);
  const firstInitial = parts[0].slice(0, 1);
  return `${last}${firstInitial}`.slice(0, 6);
}

/** Suffixe numérique stable dérivé de l'identifiant élève (4 chiffres). */
export function stableNumericSuffix(studentId: string, pad = 4): string {
  let h = 0;
  for (let i = 0; i < studentId.length; i++) {
    h = (h * 31 + studentId.charCodeAt(i)) >>> 0;
  }
  const mod = 10 ** pad;
  return String(h % mod).padStart(pad, '0');
}

export function buildPermanentReenrollmentCode(input: PermanentReenrollmentCodeInput): string {
  const org = orgSlugForReenrollment(input.orgName, input.orgPrefix);
  const name = nameTokenForReenrollment(input.studentFullName);
  const num = stableNumericSuffix(input.studentId);
  return `${org}-${name}-${num}`;
}

export function reenrollmentCodeFormatExample(orgName: string, orgPrefix?: string | null): string {
  return buildPermanentReenrollmentCode({
    orgName,
    orgPrefix,
    studentFullName: 'Aminata Diallo',
    studentId: '00000000-0000-4000-8000-000000000042',
  });
}
