'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable } from '@/components/dashboard/data-table';
import { Badge } from '@/components/ui/badge';
import { generateReportCards } from '@/lib/actions/school';
import {
  applyDefaultAppreciationsForClass,
  exportClassCouncilCsv,
  exportClassReportCardsZip,
  getClassReportCardCompleteness,
  getReportCardPdfBase64,
  listClassBulletinExamTypes,
  publishReportCards,
} from '@/lib/actions/report-cards';
import {
  BULLETIN_EXAM_TYPE_PRESETS,
  formatIncludedExamTypesLabel,
  normalizeExamType,
  parseIncludedExamTypes,
  resolveIncludedExamTypesForBulletin,
} from '@/lib/school/bulletin-exam-types';
import { PageLoadErrors } from '@/components/school/page-load-errors';
import { ReportCardCompletenessPanel } from '@/components/school/report-card-completeness-panel';
import { ReportCardAppreciationEditor } from '@/components/school/report-card-appreciation-editor';
import type { ReportCardsSuggestion } from '@/lib/school/grades-to-bulletins';
import { personName } from '@/lib/school/person-utils';
import { resolveClassEducationBand } from '@/lib/school/education-level-catalog';
import {
  educationLevelBandLabel,
  isPeriodInPolicy,
  resolveGradingPolicyForClass,
  type EducationLevelBand,
  type GradingPeriodPolicyByLevel,
} from '@/lib/school/grading-period-settings';
import { ReportCardGapConfirm } from '@/components/school/report-card-gap-confirm';
import type { GradeGapReport } from '@/lib/school/grade-gaps';
import Link from 'next/link';
import { DocumentAiGuidance } from '@/components/documents/document-ai-guidance';
import { Download, FileArchive, FileText, Lock, Settings, Sparkles } from 'lucide-react';
import type { BulletinBrandingStatus } from '@/lib/actions/bulletin-branding';
import type { BulletinReferenceInfo } from '@/lib/actions/bulletin-reference';

interface Props {
  reportCards: Array<Record<string, unknown>>;
  classes: Array<{
    id: string;
    name: string;
    level?: string | null;
    education_level_band?: EducationLevelBand | null;
  }>;
  canGenerate: boolean;
  ownBulletinsOnly?: boolean;
  defaultAcademicYear?: string;
  bulletinReference?: BulletinReferenceInfo;
  branding?: BulletinBrandingStatus;
  initialClassId?: string;
  initialSemester?: string;
  initialAcademicYear?: string;
  gradingPeriodByLevel: GradingPeriodPolicyByLevel;
  bulletinDefaultExamTypes?: string[];
  loadErrors?: string[];
}

type PendingAction = 'generate' | 'zip' | 'publish_final' | null;

function resolveInitialClassId(
  classes: Array<{ id: string }>,
  initial?: string
): string {
  if (!initial?.trim()) return '';
  return classes.some((c) => c.id === initial) ? initial : '';
}

function downloadBase64(base64: string, fileName: string, mime: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function BulletinsClient({
  reportCards,
  classes,
  canGenerate,
  ownBulletinsOnly,
  defaultAcademicYear = '2025-2026',
  bulletinReference,
  branding,
  initialClassId,
  initialSemester,
  initialAcademicYear,
  gradingPeriodByLevel,
  bulletinDefaultExamTypes = [],
  loadErrors = [],
}: Props) {
  const router = useRouter();
  const pdfBlocked = Boolean(branding && !branding.readyForPdf);

  const resolveInitialPeriod = (
    initial?: string,
    classLevel?: string | null,
    classBand?: EducationLevelBand | null
  ) => {
    const policy = resolveGradingPolicyForClass(gradingPeriodByLevel, classLevel, classBand);
    if (initial && policy.periods.some((p) => p.period_id === initial)) return initial;
    return policy.periods[0]?.period_id ?? 'S1';
  };

  const [classId, setClassId] = useState(() => resolveInitialClassId(classes, initialClassId));
  const initialClass = classes.find(
    (c) => c.id === resolveInitialClassId(classes, initialClassId)
  );
  const [semester, setSemester] = useState<string>(() =>
    resolveInitialPeriod(
      initialSemester,
      initialClass?.level,
      initialClass?.education_level_band
    )
  );

  const selectedClass = classes.find((c) => c.id === classId);
  const resolvedPolicy = resolveGradingPolicyForClass(
    gradingPeriodByLevel,
    selectedClass?.level,
    selectedClass?.education_level_band
  );
  const periodOptions = resolvedPolicy.periods;
  const levelBand = resolveClassEducationBand(
    selectedClass?.education_level_band,
    selectedClass?.level
  );
  const [academicYear, setAcademicYear] = useState(initialAcademicYear?.trim() || defaultAcademicYear);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [aiGuidance, setAiGuidance] = useState<string | null>(null);
  const [completeness, setCompleteness] = useState<ReportCardsSuggestion | null>(null);
  const [completenessLoading, setCompletenessLoading] = useState(false);
  const [completenessError, setCompletenessError] = useState<string | null>(null);
  const [tableKey, setTableKey] = useState(0);
  const [gapConfirmOpen, setGapConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [gapSummary, setGapSummary] = useState('');
  const [gapReport, setGapReport] = useState<GradeGapReport | null>(null);
  const [gapMessage, setGapMessage] = useState('');
  const [availableExamTypes, setAvailableExamTypes] = useState<string[]>([]);
  const [selectedExamTypes, setSelectedExamTypes] = useState<Set<string>>(new Set());
  const [examTypesLoading, setExamTypesLoading] = useState(false);

  function includedExamTypesPayload(): string[] | null {
    if (selectedExamTypes.size === 0) return null;
    const allSelected =
      availableExamTypes.length > 0 &&
      availableExamTypes.every((t) =>
        selectedExamTypes.has(normalizeExamType(t))
      );
    if (allSelected && bulletinDefaultExamTypes.length === 0) return null;
    return [...selectedExamTypes];
  }

  useEffect(() => {
    if (!canGenerate || !classId || ownBulletinsOnly) {
      setAvailableExamTypes([]);
      setSelectedExamTypes(new Set());
      return;
    }
    let cancelled = false;
    setExamTypesLoading(true);
    void listClassBulletinExamTypes({ classId, semester, academicYear }).then((res) => {
      if (cancelled) return;
      if ('error' in res && res.error) {
        const types = [...BULLETIN_EXAM_TYPE_PRESETS];
        setAvailableExamTypes(types);
        const resolved = resolveIncludedExamTypesForBulletin(
          null,
          bulletinDefaultExamTypes,
          types
        );
        setSelectedExamTypes(
          new Set(resolved ?? types.map((t) => normalizeExamType(t)))
        );
      } else {
        const types =
          res.examTypes?.length ? res.examTypes : [...BULLETIN_EXAM_TYPE_PRESETS];
        setAvailableExamTypes(types);
        const resolved = resolveIncludedExamTypesForBulletin(
          null,
          bulletinDefaultExamTypes,
          types
        );
        setSelectedExamTypes(
          new Set(resolved ?? types.map((t) => normalizeExamType(t)))
        );
      }
      setExamTypesLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [canGenerate, classId, semester, academicYear, ownBulletinsOnly, bulletinDefaultExamTypes]);

  useEffect(() => {
    if (!canGenerate || !classId || ownBulletinsOnly) {
      setCompleteness(null);
      return;
    }
    let cancelled = false;
    setCompletenessLoading(true);
    setCompletenessError(null);
    void getClassReportCardCompleteness({
      classId,
      semester,
      academicYear,
      includedExamTypes: includedExamTypesPayload(),
    }).then((res) => {
      if (cancelled) return;
      if (res && 'error' in res && res.error) {
        setCompleteness(null);
        setCompletenessError(res.error);
      } else {
        setCompleteness(res);
        setCompletenessError(null);
      }
      setCompletenessLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [
    canGenerate,
    classId,
    semester,
    academicYear,
    ownBulletinsOnly,
    selectedExamTypes,
    availableExamTypes,
  ]);

  useEffect(() => {
    if (!isPeriodInPolicy(resolvedPolicy, semester)) {
      setSemester(periodOptions[0]?.period_id ?? 'S1');
    }
  }, [classId, resolvedPolicy, semester, periodOptions]);

  function openGapConfirm(
    action: PendingAction,
    result: {
      needsConfirmation?: boolean;
      gapSummary?: string;
      gapReport?: GradeGapReport;
      message?: string;
    }
  ) {
    if (!result.needsConfirmation) return false;
    setPendingAction(action);
    setGapSummary(result.gapSummary ?? '');
    setGapReport(result.gapReport ?? null);
    setGapMessage(result.message ?? 'Notes manquantes détectées.');
    setGapConfirmOpen(true);
    return true;
  }

  async function runGenerate(force = false) {
    if (!classId) return;
    setLoading(true);
    setMessage(null);
    const result = await generateReportCards(classId, semester, academicYear, {
      force,
      includedExamTypes: includedExamTypesPayload(),
    });
    if (openGapConfirm('generate', result)) {
      setLoading(false);
      return;
    }
    if (result.error) {
      setMessage(result.error);
      setAiGuidance(null);
    } else {
      const c = result.completeness;
      const extra = c ? ` — complétude moyenne ${c.averagePct}%` : '';
      setMessage(`${result.count} bulletins provisoires générés / mis à jour${extra}`);
      setAiGuidance(result.aiBulletinGuidance ?? null);
      router.refresh();
    }
    setLoading(false);
  }

  async function handleGenerate() {
    await runGenerate(false);
  }

  async function handlePublish(mode: 'draft' | 'final', force = false) {
    if (!classId) {
      setMessage('Choisissez une classe.');
      return;
    }
    setLoading(true);
    const result = await publishReportCards({
      classId,
      semester,
      academicYear,
      mode,
      sendSms: mode === 'final',
      force,
      includedExamTypes: includedExamTypesPayload(),
    });
    if (mode === 'final' && openGapConfirm('publish_final', result)) {
      setLoading(false);
      return;
    }
    setLoading(false);
    if ('error' in result && result.error) {
      setMessage(result.error);
    } else if ('success' in result && result.success) {
      const archiveNote =
        mode === 'final' && result.archived != null
          ? ` — ${result.archived} PDF archivé(s)`
          : '';
      setMessage(
        mode === 'final'
          ? `${result.count} bulletins définitifs publiés — ${result.smsSent ?? 0} SMS envoyés${archiveNote}`
          : `${result.count} bulletins repassés en provisoire`
      );
      router.refresh();
    }
  }

  async function handleZipExport(force = false) {
    if (!classId) return;
    setLoading(true);
    const result = await exportClassReportCardsZip({
      classId,
      semester,
      academicYear,
      force,
      includedExamTypes: includedExamTypesPayload(),
    });
    if (openGapConfirm('zip', result)) {
      setLoading(false);
      return;
    }
    setLoading(false);
    if ('error' in result && result.error) {
      setMessage(result.error);
      return;
    }
    if (result.base64 && result.fileName) {
      downloadBase64(result.base64, result.fileName, 'application/zip');
      setMessage(`Archive ZIP : ${result.count} bulletin(s)`);
    }
  }

  async function handleGapConfirmContinue() {
    setGapConfirmOpen(false);
    const action = pendingAction;
    setPendingAction(null);
    if (action === 'generate') await runGenerate(true);
    else if (action === 'zip') await handleZipExport(true);
    else if (action === 'publish_final') await handlePublish('final', true);
  }

  async function handleDownloadOne(cardId: string) {
    setLoading(true);
    const result = await getReportCardPdfBase64(cardId);
    setLoading(false);
    if ('error' in result && result.error) {
      setMessage(result.error);
      return;
    }
    if (result.base64 && result.fileName) {
      downloadBase64(result.base64, result.fileName, 'application/pdf');
    }
  }

  async function handleCouncilExport() {
    if (!classId) return;
    setLoading(true);
    const result = await exportClassCouncilCsv({ classId, semester, academicYear });
    setLoading(false);
    if ('error' in result && result.error) {
      setMessage(result.error);
      return;
    }
    if (result.base64 && result.fileName) {
      downloadBase64(result.base64, result.fileName, 'text/csv');
      setMessage(`Conseil de classe exporté (${result.count} élève(s))`);
    }
  }

  async function handleApplyDefaultAppreciations() {
    if (!classId) return;
    setLoading(true);
    const res = await applyDefaultAppreciationsForClass({
      classId,
      semester,
      academicYear,
      onlyEmpty: true,
    });
    setLoading(false);
    if ('error' in res && res.error) setMessage(res.error);
    else if ('success' in res && res.success) {
      setMessage(`${res.updated} appréciation(s) générée(s) automatiquement`);
      setTableKey((k) => k + 1);
      router.refresh();
    }
  }

  const filteredCards = reportCards.filter((r) => {
    if (!classId) return true;
    if ((r.class_id as string) !== classId) return false;
    if ((r.semester as string) !== semester) return false;
    if ((r.academic_year as string) !== academicYear) return false;
    return true;
  });

  const rows = filteredCards.map((r) => ({
    id: r.id as string,
    eleve: personName(r.school_students as Record<string, unknown>),
    matricule: ((r.school_students as { matricule?: string })?.matricule) || '—',
    classe: ((r.school_classes as { name?: string })?.name) || '—',
    moyenne: r.average_score != null ? Number(r.average_score).toFixed(2) : '—',
    moyenneNum: r.average_score != null ? Number(r.average_score) : null,
    completude:
      r.grades_completeness_pct != null ? `${Number(r.grades_completeness_pct)}%` : '—',
    rang: r.rank ?? '—',
    semestre: `${r.semester as string} · ${r.academic_year as string}`,
    statut:
      (r.publication_status as string) === 'final' ? 'Définitif' : 'Provisoire',
    rawStatus: (r.publication_status as string) || 'draft',
    appreciation: (r.appreciation as string) ?? null,
    archived: Boolean((r.file_path as string)?.trim()),
    notesRetenues:
      formatIncludedExamTypesLabel(parseIncludedExamTypes(r.included_exam_types), 3) ??
      'Toutes',
    date: new Date(r.generated_at as string).toLocaleDateString('fr-FR'),
  }));

  return (
    <div className="space-y-6">
      <ReportCardGapConfirm
        open={gapConfirmOpen}
        title="Notes manquantes"
        message={gapMessage}
        gapSummary={gapSummary}
        gapReport={gapReport}
        loading={loading}
        onCancel={() => {
          setGapConfirmOpen(false);
          setPendingAction(null);
        }}
        onConfirm={() => void handleGapConfirmContinue()}
      />
      <PageLoadErrors errors={loadErrors} />
      <div>
        <h1 className="text-2xl font-bold">{ownBulletinsOnly ? 'Mon bulletin' : 'Bulletins PDF'}</h1>
        <p className="text-muted-foreground">
          {ownBulletinsOnly
            ? 'Consultez et téléchargez votre bulletin lorsqu\'il a été publié'
            : 'Génération, publication provisoire ou définitive, export PDF'}
        </p>
      </div>

      {!ownBulletinsOnly && (
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Générer & publier (direction)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canGenerate && (
            <p className="text-sm text-muted-foreground">
              Seuls les directeurs peuvent générer les bulletins.
            </p>
          )}
          {canGenerate && (
            <>
            <p className="text-sm text-muted-foreground">
              Modèle bulletin PDF :{' '}
              <Link href="/parametres/bulletin" className="text-primary underline">
                Paramètres → Modèle bulletin
              </Link>
            </p>
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label>Classe</Label>
                <Select value={classId} onValueChange={setClassId}>
                  <SelectTrigger className="w-[200px]"><SelectValue placeholder="Classe" /></SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  {resolvedPolicy.mode === 'trimester' ? 'Trimestre' : 'Semestre'}
                  {selectedClass ? (
                    <span className="ml-1 font-normal text-muted-foreground">
                      ({educationLevelBandLabel(levelBand)})
                    </span>
                  ) : null}
                </Label>
                <Select value={semester} onValueChange={setSemester}>
                  <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {periodOptions.map((p) => (
                      <SelectItem key={p.period_id} value={p.period_id}>
                        {p.label} ({p.required_evaluations_per_subject} notes/matière)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Année scolaire</Label>
                <Select value={academicYear} onValueChange={setAcademicYear}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[defaultAcademicYear, '2024-2025', '2026-2027'].filter(
                      (v, i, a) => a.indexOf(v) === i
                    ).map((y) => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2 rounded-lg border p-4">
              <Label>Types de notes pour la moyenne</Label>
              <p className="text-xs text-muted-foreground">
                Seules les évaluations cochées entrent dans le calcul du bulletin, la complétude et
                les alertes notes manquantes.
              </p>
              {examTypesLoading ? (
                <p className="text-sm text-muted-foreground">Chargement des types disponibles…</p>
              ) : availableExamTypes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucune note saisie pour cette classe et période — les presets standards sont proposés.
                </p>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {(availableExamTypes.length > 0 ? availableExamTypes : []).map((type) => {
                  const norm = normalizeExamType(type);
                  const checked = selectedExamTypes.has(norm);
                  return (
                    <label
                      key={type}
                      className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-muted/40 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300"
                        checked={checked}
                        onChange={() => {
                          setSelectedExamTypes((prev) => {
                            const next = new Set(prev);
                            if (next.has(norm)) next.delete(norm);
                            else next.add(norm);
                            return next;
                          });
                        }}
                      />
                      {type}
                    </label>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setSelectedExamTypes(
                      new Set(availableExamTypes.map((t) => normalizeExamType(t)))
                    )
                  }
                  disabled={availableExamTypes.length === 0}
                >
                  Tout sélectionner
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedExamTypes(new Set())}
                >
                  Toutes les notes
                </Button>
              </div>
              {selectedExamTypes.size > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedExamTypes.size} type{selectedExamTypes.size > 1 ? 's' : ''} retenu
                  {selectedExamTypes.size > 1 ? 's' : ''} : {[...selectedExamTypes].join(', ')}
                </p>
              )}
            </div>
            <ReportCardCompletenessPanel
              completeness={completeness}
              loading={completenessLoading}
            />
            {completenessError && (
              <p className="text-sm text-destructive">{completenessError}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleGenerate}
                disabled={loading || !classId || pdfBlocked}
                className="bg-[#2563EB]"
              >
                <FileText className="h-4 w-4" />
                {loading ? '…' : 'Générer / recalculer (provisoire)'}
              </Button>
              <Button
                variant="outline"
                onClick={() => void handleCouncilExport()}
                disabled={loading || !classId}
              >
                <Download className="h-4 w-4" />
                Conseil CSV
              </Button>
              <Button
                variant="outline"
                onClick={() => handlePublish('final')}
                disabled={loading || !classId || pdfBlocked}
              >
                <Lock className="h-4 w-4" />
                Publier définitif + SMS
              </Button>
              <Button
                variant="outline"
                onClick={handleZipExport}
                disabled={loading || !classId || pdfBlocked}
              >
                <FileArchive className="h-4 w-4" />
                ZIP classe
              </Button>
              <Button
                variant="outline"
                onClick={() => void handleApplyDefaultAppreciations()}
                disabled={loading || !classId}
              >
                Appréciations auto
              </Button>
            </div>
            </>
          )}
        </CardContent>
      </Card>
      )}

      {canGenerate && branding && !branding.readyForPdf && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950">
          Export PDF bloqué : joignez le{' '}
          {branding.missing.includes('logo') && branding.missing.includes('cachet')
            ? 'logo et le cachet'
            : branding.missing.includes('logo')
              ? 'logo'
              : 'cachet'}{' '}
          dans{' '}
          <Link href="/parametres/bulletin" className="underline font-medium">
            Paramètres → Modèle bulletin
          </Link>
          .
        </div>
      )}

      {canGenerate && (
        <Card className="border-violet-500/25 bg-violet-500/[0.03]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-700" />
              Modèle bulletin (téléchargements PDF)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {bulletinReference?.hasReference ? (
              <p className="text-muted-foreground">
                Les PDF élève et ZIP suivent le modèle joint :{' '}
                <span className="font-medium text-foreground">{bulletinReference.fileName}</span>
                {bulletinReference.syncedAt && (
                  <>
                    {' '}
                    (sync.{' '}
                    {new Date(bulletinReference.syncedAt).toLocaleDateString('fr-FR')})
                  </>
                )}
              </p>
            ) : (
              <p className="text-amber-800">
                Aucun modèle joint — déposez votre bulletin type pour aligner les téléchargements.
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {bulletinReference?.downloadUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={bulletinReference.downloadUrl} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4" />
                    Télécharger le modèle
                  </a>
                </Button>
              )}
              <Button variant="ghost" size="sm" asChild>
                <Link href="/parametres/bulletin">
                  <Settings className="h-4 w-4" />
                  Gérer le modèle
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {message && <div className="rounded-lg bg-primary/10 p-3 text-sm text-primary">{message}</div>}
      {aiGuidance && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Consignes IA (modèle bulletin)</CardTitle>
          </CardHeader>
          <CardContent>
            <DocumentAiGuidance
              adaptation={{
                templateFileName: 'Bulletin scolaire',
                guidance: aiGuidance,
                appliedAt: null,
              }}
              defaultOpen
            />
          </CardContent>
        </Card>
      )}

      {ownBulletinsOnly && rows.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
          Votre bulletin n&apos;est pas encore disponible.
        </div>
      )}

      <DataTable
        key={tableKey}
        title={ownBulletinsOnly ? 'Mon bulletin' : 'Bulletins générés'}
        data={rows}
        columns={[
          { key: 'eleve', label: 'Élève' },
          { key: 'matricule', label: 'Matricule' },
          { key: 'classe', label: 'Classe' },
          { key: 'moyenne', label: 'Moyenne /20' },
          ...(canGenerate ? [{ key: 'completude', label: 'Complétude' }] : []),
          { key: 'rang', label: 'Rang' },
          { key: 'semestre', label: 'Période' },
          ...(canGenerate ? [{ key: 'notesRetenues', label: 'Notes retenues' }] : []),
          ...(canGenerate
            ? [
                {
                  key: 'appreciation',
                  label: 'Appréciation',
                  render: (item: (typeof rows)[number]) => (
                    <ReportCardAppreciationEditor
                      cardId={item.id}
                      average={item.moyenneNum}
                      initialAppreciation={item.appreciation}
                      locked={item.rawStatus === 'final'}
                      onSaved={() => setTableKey((k) => k + 1)}
                    />
                  ),
                },
              ]
            : []),
          {
            key: 'statut',
            label: 'Statut',
            render: (item) => (
              <div className="flex flex-col gap-0.5">
                <Badge variant={item.rawStatus === 'final' ? 'success' : 'warning'}>
                  {String(item.statut)}
                </Badge>
                {item.archived && item.rawStatus === 'final' && (
                  <span className="text-[10px] text-muted-foreground">PDF archivé</span>
                )}
              </div>
            ),
          },
          { key: 'date', label: 'Date' },
          {
            key: 'pdf',
            label: 'PDF',
            render: (item) => (
              <Button
                size="sm"
                variant="ghost"
                className="h-7"
                disabled={loading || pdfBlocked}
                onClick={() => handleDownloadOne(item.id as string)}
              >
                <Download className="h-3 w-3 mr-1" />
                PDF
              </Button>
            ),
          },
        ]}
      />
    </div>
  );
}
