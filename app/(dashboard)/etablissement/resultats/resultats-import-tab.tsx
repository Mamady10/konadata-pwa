'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/dashboard/data-table';
import { importGradesFromFile } from '@/lib/actions/grade-evaluations';
import { ReportCardsCta } from '@/components/school/report-cards-cta';
import type { ReportCardsSuggestion } from '@/lib/school/grades-to-bulletins';
import { parseGradeImportFile } from '@/lib/school/grade-import-file';
import {
  GRADE_IMPORT_TEMPLATE_CSV,
  MAX_GRADE_IMPORT_ROWS,
  type GradeImportRow,
} from '@/lib/school/grade-import';
import {
  EvaluationSelector,
  evaluationKeyFromContext,
  isEvaluationReady,
  type ClassOption,
  type EvaluationContext,
} from './evaluation-selector';
import type { GradingPeriodPolicyByLevel } from '@/lib/school/grading-period-settings';
import type { TeachingSlot } from '@/lib/actions/assignments';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';

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
  evaluation: EvaluationContext;
  onEvaluationChange: (ctx: EvaluationContext) => void;
  gradingPeriodByLevel: GradingPeriodPolicyByLevel;
}

export function ResultatsImportTab({
  students,
  subjects,
  classes,
  teachingSlots,
  isDirector,
  canEnterGrades,
  evaluation,
  onEvaluationChange,
  gradingPeriodByLevel,
}: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<GradeImportRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [reportCardsHint, setReportCardsHint] = useState<ReportCardsSuggestion | null>(null);

  const classStudents = useMemo(
    () =>
      evaluation.classId
        ? students.filter((s) => s.class_id === evaluation.classId)
        : [],
    [students, evaluation.classId]
  );

  const preview = useMemo(
    () =>
      rows.slice(0, 12).map((r) => ({
        id: String(r.sourceLine),
        ligne: r.sourceLine,
        matricule: r.matricule || '—',
        nom: r.full_name || '—',
        note: r.score,
        sur: r.max_score ?? evaluation.maxScore,
      })),
    [rows, evaluation.maxScore]
  );

  function downloadTemplate() {
    const blob = new Blob(['\uFEFF', GRADE_IMPORT_TEMPLATE_CSV], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modele-import-notes.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg(null);
    setLoading(true);
    try {
      const parsed = await parseGradeImportFile(file);
      setFileName(file.name);
      setRows(parsed.rows);
      setWarnings(parsed.warnings);
    } catch (err) {
      setRows([]);
      setWarnings([err instanceof Error ? err.message : 'Erreur de lecture']);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  }

  async function handleImport() {
    if (!isEvaluationReady(evaluation)) {
      setMsg('Définissez d\'abord matière, classe et évaluation.');
      return;
    }
    if (!rows.length) {
      setMsg('Chargez un fichier avec au moins une note.');
      return;
    }

    setLoading(true);
    const result = await importGradesFromFile(
      evaluationKeyFromContext(evaluation),
      { maxScore: evaluation.maxScore, coefficient: evaluation.coefficient },
      rows.slice(0, MAX_GRADE_IMPORT_ROWS),
      classStudents.map((s) => ({
        id: s.id,
        matricule: s.matricule,
        full_name: s.full_name,
      }))
    );
    setLoading(false);

    if (result && 'error' in result) {
      setMsg(result.error);
      return;
    }
    if (result && 'saved' in result) {
      setMsg(
        `${result.saved} note(s) importée(s).` +
          (result.errors.length ? ` ${result.errors.join(' ')}` : '')
      );
      setReportCardsHint(result.reportCards ?? null);
      setRows([]);
      setFileName(null);
      router.refresh();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Import Excel / CSV des notes
        </CardTitle>
        <CardDescription>
          Colonnes : <span className="font-mono">matricule</span> ou{' '}
          <span className="font-mono">nom</span>, <span className="font-mono">note</span>, optionnel{' '}
          <span className="font-mono">sur</span>. Pour une feuille scannée, utilisez l&apos;onglet
          Pièces jointes.
        </CardDescription>
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

        <p className="text-sm text-muted-foreground">
          Liste d&apos;élèves absente ?{' '}
          <Link href="/etablissement/etudiants/import" className="text-primary underline">
            Importer les élèves (Excel)
          </Link>{' '}
          avant les notes.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-1" />
            Modèle CSV
          </Button>
          <label>
            <Button type="button" variant="outline" size="sm" asChild disabled={loading}>
              <span>
                <Upload className="h-4 w-4 mr-1" />
                Choisir fichier
              </span>
            </Button>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={onFileChange}
              disabled={!canEnterGrades}
            />
          </label>
        </div>

        {fileName && (
          <p className="text-sm">
            Fichier : <strong>{fileName}</strong> — {rows.length} ligne(s)
          </p>
        )}
        {warnings.map((w) => (
          <p key={w} className="text-xs text-amber-700">
            {w}
          </p>
        ))}

        {preview.length > 0 && (
          <DataTable
            title="Aperçu"
            data={preview}
            columns={[
              { key: 'ligne', label: 'Ligne' },
              { key: 'matricule', label: 'Matricule' },
              { key: 'nom', label: 'Nom' },
              { key: 'note', label: 'Note' },
              { key: 'sur', label: 'Sur' },
            ]}
          />
        )}

        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
        <ReportCardsCta suggestion={reportCardsHint} />

        <Button
          type="button"
          className="bg-[#2563EB]"
          disabled={
            loading ||
            !canEnterGrades ||
            !rows.length ||
            !isEvaluationReady(evaluation) ||
            !classStudents.length
          }
          onClick={handleImport}
        >
          {loading ? 'Import…' : 'Importer les notes dans cette évaluation'}
        </Button>
      </CardContent>
    </Card>
  );
}
