/** Catalogue pédagogique par palier (primaire, collège, lycée, université). */

import {
  EDUCATION_LEVEL_BANDS,
  inferEducationLevelBand,
  type EducationLevelBand,
  type GradingPeriodMode,
} from '@/lib/school/grading-period-settings';

export type EducationLevelBandFilter = EducationLevelBand | 'all';

export const LEVEL_SUGGESTIONS: Record<EducationLevelBand, string[]> = {
  primaire: ['CP', 'CE1', 'CE2', 'CM1', 'CM2', '6e'],
  college: ['7e', '8e', '9e', '10e', 'BEPC'],
  lycee: ['11e', '12e', 'Seconde', 'Première', 'Terminale'],
  universite: ['L1', 'L2', 'L3', 'M1', 'M2', 'Doctorat'],
};

export interface ClassPreset {
  id: string;
  name: string;
  level: string;
  program?: string;
  department?: string;
  capacity?: number;
}

/** Modèles de classes courants par palier (ajout rapide). */
export const CLASS_PRESETS_BY_BAND: Record<EducationLevelBand, ClassPreset[]> = {
  primaire: [
    { id: 'cp-a', name: 'CP A', level: 'CP', program: 'Fondamental' },
    { id: 'cp-b', name: 'CP B', level: 'CP', program: 'Fondamental' },
    { id: 'ce1-a', name: 'CE1 A', level: 'CE1', program: 'Fondamental' },
    { id: 'ce1-b', name: 'CE1 B', level: 'CE1', program: 'Fondamental' },
    { id: 'ce2-a', name: 'CE2 A', level: 'CE2', program: 'Fondamental' },
    { id: 'ce2-b', name: 'CE2 B', level: 'CE2', program: 'Fondamental' },
    { id: 'cm1-a', name: 'CM1 A', level: 'CM1', program: 'Fondamental' },
    { id: 'cm1-b', name: 'CM1 B', level: 'CM1', program: 'Fondamental' },
    { id: 'cm2-a', name: 'CM2 A', level: 'CM2', program: 'Fondamental' },
    { id: 'cm2-b', name: 'CM2 B', level: 'CM2', program: 'Fondamental' },
  ],
  college: [
    { id: '7e-a', name: '7e A', level: '7e', program: 'Général' },
    { id: '7e-b', name: '7e B', level: '7e', program: 'Général' },
    { id: '8e-a', name: '8e A', level: '8e', program: 'Général' },
    { id: '8e-b', name: '8e B', level: '8e', program: 'Général' },
    { id: '9e-a', name: '9e A', level: '9e', program: 'Général' },
    { id: '9e-b', name: '9e B', level: '9e', program: 'Général' },
    { id: '10e-a', name: '10e A', level: '10e', program: 'Général' },
    { id: '10e-b', name: '10e B', level: '10e', program: 'Général' },
  ],
  lycee: [
    { id: '11e-a', name: '11e A', level: '11e', program: 'Général' },
    { id: '11e-b', name: '11e B', level: '11e', program: 'Général' },
    { id: '12e-a', name: '12e A', level: '12e', program: 'Général' },
    { id: '12e-b', name: '12e B', level: '12e', program: 'Général' },
    { id: '2nde-a', name: 'Seconde A', level: 'Seconde', program: 'Général' },
    { id: '2nde-b', name: 'Seconde B', level: 'Seconde', program: 'Général' },
    { id: '1ere-a', name: 'Première A', level: 'Première', program: 'Général' },
    { id: '1ere-b', name: 'Première B', level: 'Première', program: 'Général' },
    { id: 'tle-a', name: 'Terminale A', level: 'Terminale', program: 'Général' },
    { id: 'tle-b', name: 'Terminale B', level: 'Terminale', program: 'Général' },
  ],
  universite: [
    { id: 'l1-gen', name: 'L1 Général', level: 'L1', program: 'Licence' },
    { id: 'l1-info', name: 'L1 Informatique', level: 'L1', program: 'Informatique', department: 'Sciences' },
    { id: 'l1-eco', name: 'L1 Économie', level: 'L1', program: 'Économie', department: 'GES' },
    { id: 'l2-gen', name: 'L2 Général', level: 'L2', program: 'Licence' },
    { id: 'l2-info', name: 'L2 Informatique', level: 'L2', program: 'Informatique', department: 'Sciences' },
    { id: 'l3-gen', name: 'L3 Général', level: 'L3', program: 'Licence' },
    { id: 'm1-gen', name: 'M1 Général', level: 'M1', program: 'Master' },
    { id: 'm2-gen', name: 'M2 Général', level: 'M2', program: 'Master' },
  ],
};

export function classPresetsForBand(band: EducationLevelBand): ClassPreset[] {
  return CLASS_PRESETS_BY_BAND[band] ?? [];
}

export function resolveClassPresets(
  band: EducationLevelBand,
  presetIds: string[]
): ClassPreset[] {
  const byId = new Map(CLASS_PRESETS_BY_BAND[band].map((p) => [p.id, p]));
  const out: ClassPreset[] = [];
  for (const id of presetIds) {
    const preset = byId.get(id);
    if (preset) out.push(preset);
  }
  return out;
}

export interface SubjectPreset {
  id: string;
  name: string;
  code?: string;
  coefficient?: number;
}

export const SUBJECT_PRESETS_BY_BAND: Record<EducationLevelBand, SubjectPreset[]> = {
  primaire: [
    { id: 'fr', name: 'Français', code: 'FR', coefficient: 3 },
    { id: 'math', name: 'Mathématiques', code: 'MATH', coefficient: 3 },
    { id: 'sci', name: 'Sciences', code: 'SCI', coefficient: 2 },
    { id: 'hg', name: 'Histoire-Géographie', code: 'HG', coefficient: 2 },
    { id: 'ec', name: 'Éducation civique', code: 'EC', coefficient: 1 },
    { id: 'eps', name: 'EPS', code: 'EPS', coefficient: 1 },
  ],
  college: [
    { id: 'fr', name: 'Français', code: 'FR', coefficient: 3 },
    { id: 'math', name: 'Mathématiques', code: 'MATH', coefficient: 3 },
    { id: 'en', name: 'Anglais', code: 'EN', coefficient: 2 },
    { id: 'pc', name: 'Physique-Chimie', code: 'PC', coefficient: 2 },
    { id: 'svt', name: 'SVT', code: 'SVT', coefficient: 2 },
    { id: 'hg', name: 'Histoire-Géographie', code: 'HG', coefficient: 2 },
    { id: 'eps', name: 'EPS', code: 'EPS', coefficient: 1 },
  ],
  lycee: [
    { id: 'philo', name: 'Philosophie', code: 'PHILO', coefficient: 2 },
    { id: 'math', name: 'Mathématiques', code: 'MATH', coefficient: 4 },
    { id: 'pc', name: 'Physique-Chimie', code: 'PC', coefficient: 3 },
    { id: 'svt', name: 'SVT', code: 'SVT', coefficient: 3 },
    { id: 'fr', name: 'Français', code: 'FR', coefficient: 3 },
    { id: 'en', name: 'Anglais', code: 'EN', coefficient: 2 },
    { id: 'hg', name: 'Histoire-Géographie', code: 'HG', coefficient: 2 },
    { id: 'eps', name: 'EPS', code: 'EPS', coefficient: 1 },
  ],
  universite: [
    { id: 'math', name: 'Mathématiques', code: 'MATH', coefficient: 3 },
    { id: 'info', name: 'Informatique', code: 'INFO', coefficient: 3 },
    { id: 'eco', name: 'Économie', code: 'ECO', coefficient: 2 },
    { id: 'droit', name: 'Droit', code: 'DROIT', coefficient: 2 },
    { id: 'mkt', name: 'Marketing', code: 'MKT', coefficient: 2 },
    { id: 'compta', name: 'Comptabilité', code: 'CPT', coefficient: 2 },
  ],
};

export function subjectPresetsForBand(band: EducationLevelBand): SubjectPreset[] {
  return SUBJECT_PRESETS_BY_BAND[band] ?? [];
}

export function resolveSubjectPresets(
  band: EducationLevelBand,
  presetIds: string[]
): SubjectPreset[] {
  const byId = new Map(SUBJECT_PRESETS_BY_BAND[band].map((p) => [p.id, p]));
  const out: SubjectPreset[] = [];
  for (const id of presetIds) {
    const preset = byId.get(id);
    if (preset) out.push(preset);
  }
  return out;
}

export const SUBJECT_NAME_SUGGESTIONS: Record<EducationLevelBand, string[]> = {
  primaire: SUBJECT_PRESETS_BY_BAND.primaire.map((p) => p.name),
  college: SUBJECT_PRESETS_BY_BAND.college.map((p) => p.name),
  lycee: SUBJECT_PRESETS_BY_BAND.lycee.map((p) => p.name),
  universite: SUBJECT_PRESETS_BY_BAND.universite.map((p) => p.name),
};

const VALID_BANDS = new Set<EducationLevelBand>(
  EDUCATION_LEVEL_BANDS.map((b) => b.id)
);

export function parseEducationLevelBand(raw: unknown): EducationLevelBand | null {
  const v = typeof raw === 'string' ? raw.trim() : '';
  if (VALID_BANDS.has(v as EducationLevelBand)) return v as EducationLevelBand;
  return null;
}

export function resolveClassEducationBand(
  explicitBand: EducationLevelBand | null | undefined,
  classLevel: string | null | undefined
): EducationLevelBand {
  return explicitBand ?? inferEducationLevelBand(classLevel);
}

export function subjectMatchesClassBand(
  subjectBand: EducationLevelBand | null | undefined,
  classBand: EducationLevelBand | null | undefined,
  classLevel?: string | null
): boolean {
  if (!subjectBand) return true;
  const resolvedClassBand = resolveClassEducationBand(classBand ?? null, classLevel ?? null);
  return subjectBand === resolvedClassBand;
}

export function periodModeForBand(band: EducationLevelBand): GradingPeriodMode {
  return EDUCATION_LEVEL_BANDS.find((b) => b.id === band)?.defaultMode ?? 'trimester';
}

export function periodTypeLabelForBand(band: EducationLevelBand): string {
  return periodModeForBand(band) === 'trimester' ? 'Trimestres' : 'Semestres';
}
