'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { saveGradesBatch } from '@/lib/actions/grade-evaluations';
import {
  EvaluationSelector,
  evaluationKeyFromContext,
  isEvaluationReady,
  type ClassOption,
  type EvaluationContext,
} from './evaluation-selector';
import type { GradingPeriodPolicyByLevel } from '@/lib/school/grading-period-settings';
import type { TeachingSlot } from '@/lib/actions/assignments';
import { Save, AlertCircle } from 'lucide-react';

interface StudentRow {
  id: string;
  full_name: string;
  matricule?: string;
  class_id?: string;
}

interface Props {
  students: StudentRow[];
  subjects: Array<{ id: string; name: string }>;
  classes: ClassOption[];
  teachingSlots: TeachingSlot[];
  isDirector: boolean;
  canEnterGrades: boolean;
  hasAssignments: boolean;
  initialScores: Record<string, { score: number | null; maxScore: number }>;
  evaluation: EvaluationContext;
  onEvaluationChange: (ctx: EvaluationContext) => void;
  gradingPeriodByLevel: GradingPeriodPolicyByLevel;
}

export function ResultatsGridTab({
  students,
  subjects,
  classes,
  teachingSlots,
  isDirector,
  canEnterGrades,
  hasAssignments,
  initialScores,
  evaluation,
  onEvaluationChange,
  gradingPeriodByLevel,
}: Props) {
  const router = useRouter();
  const [scores, setScores] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      evaluation.classId
        ? students.filter((s) => s.class_id === evaluation.classId)
        : [],
    [students, evaluation.classId]
  );

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const s of filtered) {
      const prev = initialScores[s.id];
      next[s.id] = prev?.score != null ? String(prev.score) : '';
    }
    setScores(next);
  }, [filtered, initialScores, evaluation.classId, evaluation.subjectId, evaluation.examType]);

  async function handleSaveAll() {
    setError(null);
    setMsg(null);
    if (!isEvaluationReady(evaluation)) {
      setError('Complétez matière, classe, type, semestre et année.');
      return;
    }
    if (!filtered.length) {
      setError('Aucun élève dans cette classe. Importez la liste via Étudiants → Import.');
      return;
    }

    setLoading(true);
    const rows = filtered.map((s) => {
      const raw = scores[s.id]?.trim().replace(',', '.');
      const score = raw === '' ? null : Number(raw);
      return {
        studentId: s.id,
        score: score === null || Number.isNaN(score) ? null : score,
        maxScore: evaluation.maxScore,
      };
    });

    const withScores = rows.filter((r) => r.score !== null);
    if (!withScores.length) {
      setError('Saisissez au moins une note.');
      setLoading(false);
      return;
    }

    const result = await saveGradesBatch(evaluationKeyFromContext(evaluation), {
      maxScore: evaluation.maxScore,
      coefficient: evaluation.coefficient,
    }, rows);
    setLoading(false);

    if (result && 'error' in result) {
      setError(result.error);
      return;
    }
    if (result && 'saved' in result) {
      setMsg(
        `${result.saved} note(s) enregistrée(s).` +
          (result.skipped ? ` ${result.skipped} ligne(s) vide(s) ignorée(s).` : '') +
          (result.errors.length ? ` Avertissements : ${result.errors.join(' ')}` : '')
      );
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      {!hasAssignments && !isDirector && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Aucune assignation classe/matière. Demandez au directeur : Utilisateurs → Assignations.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Grille — une ligne par élève</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <EvaluationSelector
            value={evaluation}
            onChange={onEvaluationChange}
            subjects={subjects}
            classes={classes}
            teachingSlots={teachingSlots}
            isDirector={isDirector}
            gradingPeriodByLevel={gradingPeriodByLevel}
            disabled={!canEnterGrades}
          />

          {evaluation.classId && filtered.length === 0 && (
            <p className="text-sm text-amber-700">
              Aucun élève dans cette classe.{' '}
              <Link href="/etablissement/etudiants/import" className="underline font-medium">
                Importer la liste (Excel)
              </Link>{' '}
              ou inscrire des élèves dans{' '}
              <Link href="/etablissement/etudiants" className="underline font-medium">
                Étudiants
              </Link>
              .
            </p>
          )}

          {filtered.length > 0 && (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Élève</th>
                    <th className="text-left p-3 font-medium w-28">Matricule</th>
                    <th className="text-left p-3 font-medium w-32">Note / {evaluation.maxScore}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id} className="border-t">
                      <td className="p-3">{s.full_name}</td>
                      <td className="p-3 text-muted-foreground">{s.matricule || '—'}</td>
                      <td className="p-3">
                        <Input
                          type="text"
                          inputMode="decimal"
                          className="h-9"
                          placeholder="—"
                          value={scores[s.id] ?? ''}
                          onChange={(e) =>
                            setScores((prev) => ({ ...prev, [s.id]: e.target.value }))
                          }
                          disabled={!canEnterGrades}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          {msg && <p className="text-sm text-emerald-700">{msg}</p>}

          <Button
            type="button"
            className="bg-[#2563EB]"
            disabled={
              loading ||
              !canEnterGrades ||
              !hasAssignments ||
              !isEvaluationReady(evaluation) ||
              !filtered.length
            }
            onClick={handleSaveAll}
          >
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Enregistrement…' : 'Enregistrer toutes les notes saisies'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
