/** Métadonnées établissement pour export MEPS / MEPPSA (Guinée). */

export interface SchoolMepsSettings {
  establishment_code: string;
  commune: string;
  prefecture: string;
  circonscription: string;
  education_level: string;
}

export const DEFAULT_MEPS_SETTINGS: SchoolMepsSettings = {
  establishment_code: '',
  commune: '',
  prefecture: '',
  circonscription: '',
  education_level: 'Secondaire',
};

export const MEPS_EDUCATION_LEVELS = [
  'Préscolaire',
  'Primaire',
  'Collège',
  'Secondaire',
  'Technique',
  'Professionnel',
] as const;

export function parseMepsSettings(
  settings: Record<string, unknown> | null | undefined,
  orgAddress?: string | null
): SchoolMepsSettings {
  const school = (settings?.school as Record<string, unknown> | undefined) ?? {};
  const raw = (school.meps as Record<string, unknown> | undefined) ?? {};

  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

  return {
    establishment_code: str(raw.establishment_code),
    commune: str(raw.commune) || str(orgAddress),
    prefecture: str(raw.prefecture),
    circonscription: str(raw.circonscription),
    education_level: str(raw.education_level) || DEFAULT_MEPS_SETTINGS.education_level,
  };
}

export function mergeMepsSettingsPatch(
  current: Record<string, unknown> | null | undefined,
  patch: Partial<SchoolMepsSettings>
): Record<string, unknown> {
  const base = { ...(current ?? {}) };
  const school = { ...((base.school as Record<string, unknown>) ?? {}) };
  const meps = { ...parseMepsSettings(base), ...patch };
  school.meps = meps;
  base.school = school;
  return base;
}
