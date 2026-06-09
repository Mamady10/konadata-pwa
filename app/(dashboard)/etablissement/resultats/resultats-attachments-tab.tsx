'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  listGradeEvaluationDocuments,
  uploadGradeEvaluationDocument,
  deleteGradeEvaluationDocument,
  type GradeEvaluationDocument,
} from '@/lib/actions/grade-evaluations';
import { ReportCardsCta } from '@/components/school/report-cards-cta';
import type { ReportCardsSuggestion } from '@/lib/school/grades-to-bulletins';
import {
  applyScanGradesToDatabase,
  generateAndArchiveBulletinFromScan,
  reindexGradeScanDocument,
} from '@/lib/actions/grade-scan-production';
import { GRADE_EVALUATION_UPLOAD_ACCEPT } from '@/lib/school/grade-evaluation-upload';
import {
  EvaluationSelector,
  evaluationKeyFromContext,
  isEvaluationReady,
  type ClassOption,
  type EvaluationContext,
} from './evaluation-selector';
import type { GradingPeriodPolicyByLevel } from '@/lib/school/grading-period-settings';
import type { TeachingSlot } from '@/lib/actions/assignments';
import { FileImage, Paperclip, Trash2, Upload, Sparkles, RefreshCw } from 'lucide-react';

interface Props {
  subjects: Array<{ id: string; name: string }>;
  classes: ClassOption[];
  teachingSlots: TeachingSlot[];
  isDirector: boolean;
  canEnterGrades: boolean;
  evaluation: EvaluationContext;
  onEvaluationChange: (ctx: EvaluationContext) => void;
  gradingPeriodByLevel: GradingPeriodPolicyByLevel;
}

function statusLabel(s: GradeEvaluationDocument['extractionStatus']): string {
  if (s === 'ok') return 'Texte extrait (OCR)';
  if (s === 'needs_vision') return 'OCR requis (OpenAI Vision)';
  if (s === 'failed') return 'Extraction échouée';
  return 'Indexation en cours…';
}

export function ResultatsAttachmentsTab({
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
  const [docs, setDocs] = useState<GradeEvaluationDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyDocId, setBusyDocId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reportCardsHint, setReportCardsHint] = useState<ReportCardsSuggestion | null>(null);

  async function refreshDocs() {
    if (!isEvaluationReady(evaluation)) {
      setDocs([]);
      return;
    }
    setLoading(true);
    const result = await listGradeEvaluationDocuments(evaluationKeyFromContext(evaluation));
    setLoading(false);
    if (Array.isArray(result)) setDocs(result);
    else if (result?.error) setError(result.error);
  }

  useEffect(() => {
    refreshDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    evaluation.classId,
    evaluation.subjectId,
    evaluation.examType,
    evaluation.semester,
    evaluation.academicYear,
  ]);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isEvaluationReady(evaluation)) {
      setError('Définissez matière, classe et évaluation avant d\'ajouter un fichier.');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);
    const fd = new FormData();
    fd.set('file', file);
    fd.set('label', label || file.name);
    const result = await uploadGradeEvaluationDocument(
      evaluationKeyFromContext(evaluation),
      fd
    );
    setUploading(false);
    e.target.value = '';

    if (result && 'error' in result) {
      setError(result.error);
      return;
    }
    setLabel('');
    setSuccess('Fichier envoyé — extraction OCR lancée automatiquement.');
    router.refresh();
    await refreshDocs();
  }

  async function onDelete(linkId: string) {
    const result = await deleteGradeEvaluationDocument(linkId);
    if (result && 'error' in result) setError(result.error);
    else await refreshDocs();
  }

  async function onReindex(documentId: string) {
    setBusyDocId(documentId);
    setError(null);
    const res = await reindexGradeScanDocument(documentId);
    setBusyDocId(null);
    if ('error' in res) setError(res.error);
    else {
      setSuccess(`Extraction : ${res.charCount} caractères lus.`);
      await refreshDocs();
    }
  }

  async function onProduceBulletin(documentId: string) {
    setBusyDocId(documentId);
    setError(null);
    setSuccess(null);
    const res = await generateAndArchiveBulletinFromScan(documentId);
    setBusyDocId(null);
    if ('error' in res) {
      setError(res.error);
      return;
    }
    setSuccess(
      `Bulletin produit : ${res.title}. ${res.parsedStudent ? `Élève : ${res.parsedStudent}. ` : ''}` +
        `${res.subjectsCount} matière(s). → ${res.reportPath}`
    );
    router.refresh();
  }

  async function onApplyGrades(documentId: string) {
    setBusyDocId(documentId);
    setError(null);
    const res = await applyScanGradesToDatabase(documentId);
    setBusyDocId(null);
    if ('error' in res) setError(res.error);
    else {
      setSuccess(`${res.saved} note(s) importée(s) en base.${res.skipped ? ` ${res.skipped} ignorée(s).` : ''}`);
      setReportCardsHint(
        'reportCards' in res && res.reportCards ? res.reportCards : null
      );
    }
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Paperclip className="h-5 w-5" />
          Pièces jointes (scan, photo, PDF, manuscrit)
        </CardTitle>
        <CardDescription>
          L&apos;enseignant dépose la feuille ; l&apos;OCR extrait le texte à l&apos;upload. Le directeur
          produit le bulletin selon le modèle IA (Paramètres → Modèles IA).
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

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Libellé (optionnel)</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex. Bulletin MADY KABA — 1er trimestre"
              disabled={!canEnterGrades}
            />
          </div>
          <div className="space-y-2">
            <Label>Fichier</Label>
            <label className="flex">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={uploading || !canEnterGrades || !isEvaluationReady(evaluation)}
                asChild
              >
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? 'Envoi + OCR…' : 'Photo manuscrit, PDF, Excel…'}
                </span>
              </Button>
              <input
                type="file"
                className="hidden"
                accept={GRADE_EVALUATION_UPLOAD_ACCEPT}
                onChange={onUpload}
                disabled={!canEnterGrades}
              />
            </label>
            <p className="text-xs text-muted-foreground">
              Manuscrit : photo JPG/PNG. Nécessite <code className="text-xs">OPENAI_API_KEY</code> pour la lecture.
            </p>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-emerald-700">{success}</p>}
        <ReportCardsCta suggestion={reportCardsHint} />

        {isDirector && (
          <p className="text-xs text-muted-foreground rounded-lg border bg-muted/30 p-3">
            <strong>Direction :</strong> après dépôt enseignant, utilisez{' '}
            <strong>Produire bulletin IA</strong> pour générer le document selon votre modèle.
            Option <strong>Importer notes en base</strong> pour enregistrer les notes extraites.
            Historique :{' '}
            <Link href="/etablissement/rapports" className="text-primary underline">
              Rapports
            </Link>
            .
          </p>
        )}

        <div className="space-y-2">
          <h3 className="text-sm font-medium">
            Fichiers de cette évaluation {loading ? '(chargement…)' : `(${docs.length})`}
          </h3>
          {docs.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <FileImage className="h-4 w-4" />
              Aucune pièce jointe pour le moment.
            </p>
          )}
          <ul className="divide-y rounded-lg border space-y-0">
            {docs.map((d) => (
              <li key={d.id} className="p-3 text-sm space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{d.label || d.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.fileName} · {new Date(d.createdAt).toLocaleString('fr-FR')}
                    </p>
                    <p className="text-xs mt-1">
                      <span
                        className={
                          d.extractionStatus === 'ok'
                            ? 'text-emerald-700'
                            : d.extractionStatus === 'needs_vision'
                              ? 'text-amber-700'
                              : 'text-muted-foreground'
                        }
                      >
                        {statusLabel(d.extractionStatus)}
                        {d.charCount > 0 ? ` · ${d.charCount} car.` : ''}
                        {d.studentName ? ` · Élève détecté : ${d.studentName}` : ''}
                      </span>
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive shrink-0"
                    onClick={() => onDelete(d.id)}
                    disabled={!canEnterGrades}
                    title="Retirer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyDocId === d.documentId}
                    onClick={() => onReindex(d.documentId)}
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    Relancer OCR
                  </Button>
                  {isDirector && (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        className="bg-[#2563EB]"
                        disabled={busyDocId === d.documentId}
                        onClick={() => onProduceBulletin(d.documentId)}
                      >
                        <Sparkles className="h-3.5 w-3.5 mr-1" />
                        Produire bulletin IA
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={busyDocId === d.documentId}
                        onClick={() => onApplyGrades(d.documentId)}
                      >
                        Importer notes en base
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
