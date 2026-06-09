'use client';

import { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BULLETIN_EXAM_TYPE_PRESETS } from '@/lib/school/bulletin-exam-types';
import { defaultAcademicYear } from '@/lib/school/grade-import';
import type { TeachingSlot } from '@/lib/actions/assignments';
import {
  resolveClassEducationBand,
  subjectMatchesClassBand,
} from '@/lib/school/education-level-catalog';
import {
  educationLevelBandLabel,
  firstPeriodIdForPolicy,
  isPeriodInPolicy,
  resolveGradingPolicyForClass,
  type EducationLevelBand,
  type GradingPeriodPolicyByLevel,
} from '@/lib/school/grading-period-settings';

export interface EvaluationContext {
  subjectId: string;
  classId: string;
  examType: string;
  semester: string;
  academicYear: string;
  maxScore: number;
}

export interface ClassOption {
  id: string;
  name: string;
  level?: string | null;
  education_level_band?: EducationLevelBand | null;
}

export interface SubjectOption {
  id: string;
  name: string;
  education_level_band?: EducationLevelBand | null;
}

interface Props {
  value: EvaluationContext;
  onChange: (next: EvaluationContext) => void;
  subjects: SubjectOption[];
  classes: ClassOption[];
  teachingSlots: TeachingSlot[];
  isDirector: boolean;
  gradingPeriodByLevel: GradingPeriodPolicyByLevel;
  disabled?: boolean;
}

const EXAM_PRESETS = BULLETIN_EXAM_TYPE_PRESETS;

export function isEvaluationReady(ctx: EvaluationContext): boolean {
  return Boolean(
    ctx.subjectId && ctx.classId && ctx.examType.trim() && ctx.semester && ctx.academicYear.trim()
  );
}

export function EvaluationSelector({
  value,
  onChange,
  subjects,
  classes,
  teachingSlots,
  isDirector,
  gradingPeriodByLevel,
  disabled,
}: Props) {
  const selectedClass = classes.find((c) => c.id === value.classId);
  const selectedSubject = subjects.find((s) => s.id === value.subjectId);
  const resolvedPolicy = useMemo(
    () =>
      resolveGradingPolicyForClass(
        gradingPeriodByLevel,
        selectedClass?.level,
        selectedClass?.education_level_band
      ),
    [gradingPeriodByLevel, selectedClass?.level, selectedClass?.education_level_band]
  );
  const levelBand = resolveClassEducationBand(
    selectedClass?.education_level_band,
    selectedClass?.level
  );

  const subjectsForContext = useMemo(() => {
    if (!value.classId) return subjects;
    const cls = classes.find((c) => c.id === value.classId);
    if (!cls) return subjects;
    return subjects.filter((s) =>
      subjectMatchesClassBand(s.education_level_band, cls.education_level_band, cls.level)
    );
  }, [subjects, classes, value.classId]);

  const classesForSubject = useMemo(() => {
    const base =
      !value.subjectId || isDirector
        ? classes
        : classes.filter((c) =>
            teachingSlots.some((s) => s.subjectId === value.subjectId && s.classId === c.id)
          );
    if (!value.subjectId) return base;
    const sub = subjects.find((s) => s.id === value.subjectId);
    if (!sub) return base;
    return base.filter((c) =>
      subjectMatchesClassBand(sub.education_level_band, c.education_level_band, c.level)
    );
  }, [classes, subjects, value.subjectId, isDirector, teachingSlots]);

  function patch(partial: Partial<EvaluationContext>) {
    onChange({ ...value, ...partial });
  }

  function onSubjectChange(subjectId: string) {
    const sub = subjects.find((s) => s.id === subjectId);
    const allowedClasses = (isDirector ? classes : classes.filter((c) =>
      teachingSlots.some((s) => s.subjectId === subjectId && s.classId === c.id)
    )).filter((c) =>
      subjectMatchesClassBand(sub?.education_level_band, c.education_level_band, c.level)
    );
    const allowedIds = allowedClasses.map((c) => c.id);
    const nextClassId = value.classId && allowedIds.includes(value.classId) ? value.classId : '';
    patch({ subjectId, classId: nextClassId });
  }

  function onClassChange(classId: string) {
    const cls = classes.find((c) => c.id === classId);
    const policy = resolveGradingPolicyForClass(
      gradingPeriodByLevel,
      cls?.level,
      cls?.education_level_band
    );
    const nextSemester = isPeriodInPolicy(policy, value.semester)
      ? value.semester
      : firstPeriodIdForPolicy(policy);
    const sub = subjects.find((s) => s.id === value.subjectId);
    const subjectStillValid =
      value.subjectId &&
      subjectMatchesClassBand(sub?.education_level_band, cls?.education_level_band, cls?.level);
    patch({
      classId,
      semester: nextSemester,
      subjectId: subjectStillValid ? value.subjectId : '',
    });
  }

  const periodTypeLabel = resolvedPolicy.mode === 'trimester' ? 'Trimestre' : 'Semestre';

  return (
    <div className="space-y-3">
      {value.classId && (
        <p className="text-xs text-muted-foreground">
          Niveau détecté : <strong>{educationLevelBandLabel(levelBand)}</strong> — {periodTypeLabel}
          s ({resolvedPolicy.periods.length} période
          {resolvedPolicy.periods.length > 1 ? 's' : ''})
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label>Matière *</Label>
          <Select
            value={value.subjectId || undefined}
            onValueChange={onSubjectChange}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Matière" />
            </SelectTrigger>
            <SelectContent>
              {subjectsForContext.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                  {s.education_level_band
                    ? ` (${educationLevelBandLabel(s.education_level_band)})`
                    : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Classe *</Label>
          <Select
            value={value.classId || undefined}
            onValueChange={onClassChange}
            disabled={disabled || !value.subjectId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Classe" />
            </SelectTrigger>
            <SelectContent>
              {classesForSubject.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                  {c.level ? ` (${c.level})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Type d&apos;évaluation *</Label>
          <Select
            value={
              EXAM_PRESETS.includes(value.examType as (typeof EXAM_PRESETS)[number])
                ? value.examType
                : '__custom__'
            }
            onValueChange={(v) =>
              patch({ examType: v === '__custom__' ? value.examType || 'Examen' : v })
            }
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              {EXAM_PRESETS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
              <SelectItem value="__custom__">Autre (saisie libre)</SelectItem>
            </SelectContent>
          </Select>
          {!EXAM_PRESETS.includes(value.examType as (typeof EXAM_PRESETS)[number]) && (
            <Input
              value={value.examType}
              onChange={(e) => patch({ examType: e.target.value })}
              placeholder="Libellé de l'évaluation"
              disabled={disabled}
            />
          )}
        </div>
        <div className="space-y-2">
          <Label>{periodTypeLabel} *</Label>
          <Select
            value={value.semester}
            onValueChange={(semester) => patch({ semester })}
            disabled={disabled || !value.classId}
          >
            <SelectTrigger>
              <SelectValue placeholder={value.classId ? periodTypeLabel : 'Choisir une classe'} />
            </SelectTrigger>
            <SelectContent>
              {resolvedPolicy.periods.map((p) => (
                <SelectItem key={p.period_id} value={p.period_id}>
                  {p.label} ({p.required_evaluations_per_subject} notes/matière)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Année scolaire *</Label>
          <Input
            value={value.academicYear}
            onChange={(e) => patch({ academicYear: e.target.value })}
            placeholder={defaultAcademicYear()}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label>Note sur</Label>
          <Input
            type="number"
            min={1}
            value={value.maxScore}
            onChange={(e) => patch({ maxScore: Number(e.target.value) || 20 })}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}

export function evaluationKeyFromContext(ctx: EvaluationContext) {
  return {
    classId: ctx.classId,
    subjectId: ctx.subjectId,
    examType: ctx.examType.trim(),
    semester: ctx.semester,
    academicYear: ctx.academicYear.trim(),
  };
}

export function defaultEvaluationContext(
  gradingPeriodByLevel: GradingPeriodPolicyByLevel
): EvaluationContext {
  const policy = gradingPeriodByLevel.college;
  return {
    subjectId: '',
    classId: '',
    examType: '1ère évaluation',
    semester: firstPeriodIdForPolicy(policy),
    academicYear: defaultAcademicYear(),
    maxScore: 20,
  };
}
