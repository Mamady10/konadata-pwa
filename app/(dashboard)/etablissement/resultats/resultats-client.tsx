'use client';

import { useEffect, useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/dashboard/data-table';
import { personName } from '@/lib/school/person-utils';
import type { TeachingSlot } from '@/lib/actions/assignments';
import { AlertCircle, Grid3X3, FileSpreadsheet, Paperclip } from 'lucide-react';
import {
  defaultEvaluationContext,
  evaluationKeyFromContext,
  isEvaluationReady,
  type ClassOption,
  type EvaluationContext,
} from './evaluation-selector';
import { getGradeEvaluationSettings } from '@/lib/actions/grade-evaluations';
import { defaultMaxScoreForEducationBand } from '@/lib/school/evaluation-defaults';
import { resolveClassEducationBand } from '@/lib/school/education-level-catalog';
import { parseEducationLevelBand } from '@/lib/school/education-level-catalog';
import {
  gradingPeriodLabel,
  resolveGradingPolicyForClass,
  type EducationLevelBand,
  type GradingPeriodPolicyByLevel,
} from '@/lib/school/grading-period-settings';
import { ResultatsGridTab } from './resultats-grid-tab';
import { ResultatsImportTab } from './resultats-import-tab';
import { ResultatsAttachmentsTab } from './resultats-attachments-tab';
import { PageLoadErrors } from '@/components/school/page-load-errors';

const ALL_FILTER = '__all__';

interface Props {
  grades: Array<Record<string, unknown>>;
  students: Array<{ id: string; full_name: string; matricule?: string; class_id?: string }>;
  subjects: Array<{ id: string; name: string; education_level_band?: EducationLevelBand | null }>;
  allSubjects: Array<{ id: string; name: string; education_level_band?: EducationLevelBand | null }>;
  classes: ClassOption[];
  teachingSlots: TeachingSlot[];
  isDirector: boolean;
  canEnterGrades: boolean;
  hasAssignments: boolean;
  gradingPeriodByLevel: GradingPeriodPolicyByLevel;
  loadErrors?: string[];
}

export function ResultatsClient({
  grades,
  students,
  subjects,
  allSubjects,
  classes,
  teachingSlots,
  isDirector,
  canEnterGrades,
  hasAssignments,
  gradingPeriodByLevel,
  loadErrors = [],
}: Props) {
  const [evaluation, setEvaluation] = useState<EvaluationContext>(() =>
    defaultEvaluationContext(gradingPeriodByLevel)
  );
  const [filterClassId, setFilterClassId] = useState(ALL_FILTER);
  const [filterSubjectId, setFilterSubjectId] = useState(ALL_FILTER);
  const [filterPeriodId, setFilterPeriodId] = useState(ALL_FILTER);

  useEffect(() => {
    if (!isEvaluationReady(evaluation)) return;
    let cancelled = false;
    const cls = classes.find((c) => c.id === evaluation.classId);
    const band = resolveClassEducationBand(cls?.education_level_band, cls?.level);
    const defaults = {
      maxScore: defaultMaxScoreForEducationBand(band),
      coefficient: 1,
    };

    void getGradeEvaluationSettings(evaluationKeyFromContext(evaluation), defaults).then((res) => {
      if (cancelled || !res || 'error' in res) return;
      setEvaluation((prev) => {
        if (
          prev.classId === evaluation.classId &&
          prev.subjectId === evaluation.subjectId &&
          prev.examType === evaluation.examType &&
          prev.semester === evaluation.semester &&
          prev.academicYear === evaluation.academicYear &&
          prev.maxScore === res.maxScore &&
          prev.coefficient === res.coefficient
        ) {
          return prev;
        }
        return { ...prev, maxScore: res.maxScore, coefficient: res.coefficient };
      });
    });

    return () => {
      cancelled = true;
    };
  }, [
    evaluation.classId,
    evaluation.subjectId,
    evaluation.examType,
    evaluation.semester,
    evaluation.academicYear,
    classes,
  ]);

  const initialScores = useMemo(() => {
    if (!evaluation.classId || !evaluation.subjectId) return {};
    const key = evaluationKeyFromContext(evaluation);
    const map: Record<string, { score: number | null; maxScore: number }> = {};
    for (const g of grades) {
      if (
        (g.class_id as string) === key.classId &&
        (g.subject_id as string) === key.subjectId &&
        (g.exam_type as string) === key.examType &&
        ((g.semester as string) || 'S1') === key.semester &&
        (g.academic_year as string) === key.academicYear
      ) {
        map[g.student_id as string] = {
          score: g.score != null ? Number(g.score) : null,
          maxScore: Number(g.max_score) || 20,
        };
      }
    }
    return map;
  }, [grades, evaluation]);

  const displayGrades = useMemo(() => {
    return grades.filter((g) => {
      if (filterClassId !== ALL_FILTER && (g.class_id as string) !== filterClassId) return false;
      if (filterSubjectId !== ALL_FILTER && (g.subject_id as string) !== filterSubjectId) return false;
      if (filterPeriodId !== ALL_FILTER && (g.semester as string) !== filterPeriodId) return false;
      return true;
    });
  }, [grades, filterClassId, filterSubjectId, filterPeriodId]);

  const periodOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const g of grades) {
      const s = g.semester as string;
      if (s) ids.add(s);
    }
    return [...ids].sort().map((periodId) => {
      const sample = grades.find((g) => (g.semester as string) === periodId);
      const classRef = sample?.school_classes as {
        level?: string;
        education_level_band?: string;
      } | null;
      const policy = resolveGradingPolicyForClass(
        gradingPeriodByLevel,
        classRef?.level ?? null,
        parseEducationLevelBand(classRef?.education_level_band)
      );
      const label = gradingPeriodLabel(policy, periodId);
      return { periodId, label: label !== periodId ? `${label} (${periodId})` : periodId };
    });
  }, [grades, gradingPeriodByLevel]);

  const rows = displayGrades.map((g) => {
    const classRef = g.school_classes as {
      level?: string;
      education_level_band?: string;
    } | null;
    const policy = resolveGradingPolicyForClass(
      gradingPeriodByLevel,
      classRef?.level ?? null,
      parseEducationLevelBand(classRef?.education_level_band)
    );
    const period = g.semester as string;
    return {
      id: g.id as string,
      eleve: personName(g.school_students as Record<string, unknown>),
      classe: ((g.school_classes as { name?: string })?.name) || '—',
      matiere: ((g.school_subjects as { name?: string })?.name) || '—',
      note: `${g.score}/${g.max_score}`,
      type: g.exam_type as string,
      periode: gradingPeriodLabel(policy, period) || period,
    };
  });

  const subjectFilterOptions = isDirector ? allSubjects : subjects;

  return (
    <div className="space-y-6">
      <PageLoadErrors errors={loadErrors} />
      <div>
        <h1 className="text-2xl font-bold">Saisie des notes</h1>
        <p className="text-muted-foreground">
          {rows.length} note{rows.length !== 1 ? 's' : ''} enregistrée{rows.length !== 1 ? 's' : ''}
          {!isDirector && hasAssignments && ' — vos matières et classes assignées'}
        </p>
      </div>

      {!canEnterGrades && (
        <div className="flex items-center gap-2 rounded-lg bg-muted p-4 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Vous n&apos;avez pas le droit de saisir des notes sur ce compte.
        </div>
      )}

      {canEnterGrades && (
        <Tabs defaultValue="grille" className="space-y-4">
          <TabsList className="grid w-full max-w-xl grid-cols-3">
            <TabsTrigger value="grille" className="gap-1.5">
              <Grid3X3 className="h-4 w-4" />
              Grille
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-1.5">
              <FileSpreadsheet className="h-4 w-4" />
              Import Excel
            </TabsTrigger>
            <TabsTrigger value="fichiers" className="gap-1.5">
              <Paperclip className="h-4 w-4" />
              Pièces jointes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="grille">
            <ResultatsGridTab
              students={students}
              subjects={subjects}
              classes={classes}
              teachingSlots={teachingSlots}
              isDirector={isDirector}
              canEnterGrades={canEnterGrades}
              hasAssignments={hasAssignments}
              initialScores={initialScores}
              evaluation={evaluation}
              onEvaluationChange={setEvaluation}
              gradingPeriodByLevel={gradingPeriodByLevel}
            />
          </TabsContent>

          <TabsContent value="import">
            <ResultatsImportTab
              students={students}
              subjects={subjects}
              classes={classes}
              teachingSlots={teachingSlots}
              isDirector={isDirector}
              canEnterGrades={canEnterGrades}
              evaluation={evaluation}
              onEvaluationChange={setEvaluation}
              gradingPeriodByLevel={gradingPeriodByLevel}
            />
          </TabsContent>

          <TabsContent value="fichiers">
            <ResultatsAttachmentsTab
              subjects={subjects}
              classes={classes}
              teachingSlots={teachingSlots}
              isDirector={isDirector}
              canEnterGrades={canEnterGrades || isDirector}
              evaluation={evaluation}
              onEvaluationChange={setEvaluation}
              gradingPeriodByLevel={gradingPeriodByLevel}
            />
          </TabsContent>
        </Tabs>
      )}

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2 min-w-[180px]">
          <Label>Filtrer par classe</Label>
          <Select value={filterClassId} onValueChange={setFilterClassId}>
            <SelectTrigger>
              <SelectValue placeholder="Toutes les classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER}>Toutes les classes</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                  {c.level ? ` · ${c.level}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 min-w-[180px]">
          <Label>Filtrer par matière</Label>
          <Select value={filterSubjectId} onValueChange={setFilterSubjectId}>
            <SelectTrigger>
              <SelectValue placeholder="Toutes les matières" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER}>Toutes les matières</SelectItem>
              {subjectFilterOptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 min-w-[160px]">
          <Label>Filtrer par période</Label>
          <Select value={filterPeriodId} onValueChange={setFilterPeriodId}>
            <SelectTrigger>
              <SelectValue placeholder="Toutes périodes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER}>Toutes les périodes</SelectItem>
              {periodOptions.map((p) => (
                <SelectItem key={p.periodId} value={p.periodId}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        title="Historique des notes"
        data={rows}
        columns={[
          { key: 'eleve', label: 'Élève' },
          { key: 'classe', label: 'Classe' },
          { key: 'matiere', label: 'Matière' },
          { key: 'note', label: 'Note' },
          { key: 'type', label: 'Type' },
          { key: 'periode', label: 'Période' },
        ]}
      />
    </div>
  );
}
