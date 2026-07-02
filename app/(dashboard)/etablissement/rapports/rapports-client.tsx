'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable, StatusBadge } from '@/components/dashboard/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { Calendar, Download, FileStack, Settings, Sparkles, Upload } from 'lucide-react';
import type { SchoolFinanceOverview } from '@/lib/actions/school';
import type { DocumentAiAdaptation } from '@/lib/ai/template-adaptation-types';
import type { CaptureExtractionResult } from '@/lib/ai/extraction/capture-extract-types';
import { DocumentAiGuidance } from '@/components/documents/document-ai-guidance';
import { CaptureExtractionView } from '@/components/documents/capture-extraction-view';
import { DirectorAiModelsLink } from '@/components/documents/director-ai-models-link';
import { uploadSchoolCaptureDocument } from '@/lib/actions/storage';
import { reRunCaptureExtraction } from '@/lib/actions/capture-extraction';
import { SectorAiReportPanel } from '@/components/ai/sector-ai-report-panel';
import { generateSchoolAiReport, generateSchoolMonthlyReport } from '@/lib/actions/ai-reports';
import { exportMepsSchoolStats } from '@/lib/actions/school-compliance';
import {
  SCHOOL_AI_REPORT_TYPES,
  type SchoolAiReportType,
} from '@/lib/ai/sector-report-types';
import { AiReportHistory } from '@/components/ai/ai-report-history';
import { AiReportDiffusion } from '@/components/ai/ai-report-diffusion';
import { SchoolDirectorReport } from '@/components/etablissement/school-director-report';
import { downloadTextAsPdf } from '@/lib/reports/download-text-as-pdf';
import type { AiGeneratedReportRow } from '@/lib/actions/ai-report-archive';

const CATEGORY_LABELS: Record<string, string> = {
  school_report: 'Bulletin / Notes',
  invoice: 'Facture',
  other: 'Document',
};

interface ReportRow {
  id: string;
  title: string;
  type: string;
  size: string;
  date: string;
  category: string;
  documentType: string | null;
  status: string;
  aiAdaptation: DocumentAiAdaptation | null;
  captureExtraction: CaptureExtractionResult | null;
}

interface CaptureTypeOption {
  id: string;
  label: string;
  hint?: string;
}

interface ClassOption {
  id: string;
  name: string;
}

interface Props {
  documents: ReportRow[];
  captureDocumentTypes: CaptureTypeOption[];
  financeOverview: SchoolFinanceOverview | null;
  showFinance: boolean;
  isDirector: boolean;
  canUploadCapture: boolean;
  classes: ClassOption[];
  reportHistory: AiGeneratedReportRow[];
  stats: {
    totalStudents: number;
    totalPayments: number;
    amountCollected: number;
    reportCards: number;
  };
}

export function RapportsEtablissementClient({
  documents,
  captureDocumentTypes,
  financeOverview,
  showFinance,
  isDirector,
  canUploadCapture,
  classes,
  reportHistory,
  stats,
}: Props) {
  const router = useRouter();
  const [documentType, setDocumentType] = useState('');
  const [classId, setClassId] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyMsg, setMonthlyMsg] = useState<string | null>(null);
  const [monthlyReport, setMonthlyReport] = useState<{ title: string; content: string; archiveId: string } | null>(null);
  const [mepsLoading, setMepsLoading] = useState(false);
  const [mepsMsg, setMepsMsg] = useState<string | null>(null);

  const docsWithAi = documents.filter((d) => d.aiAdaptation);
  const docsWithCapture = documents.filter((d) => d.captureExtraction);
  const selectedCaptureType = captureDocumentTypes.find((t) => t.id === documentType);

  async function handleCaptureUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !documentType) return;
    setUploadError(null);
    setUploading(true);
    const fd = new FormData();
    fd.set('file', file);
    fd.set('document_type', documentType);
    if (classId) fd.set('class_id', classId);
    const res = await uploadSchoolCaptureDocument(fd);
    if (res.error) setUploadError(res.error);
    else router.refresh();
    setUploading(false);
    e.target.value = '';
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <FileStack className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Rapports Établissement</h1>
          <Badge variant="success">Supabase</Badge>
        </div>
        <p className="text-muted-foreground">Documents et synthèses académiques</p>
        {isDirector && (
          <DirectorAiModelsLink hint="bulletins et rapports type pour l'adaptation des documents déposés" />
        )}
      </div>

      {isDirector && <SchoolDirectorReport />}

      {isDirector && (
        <Card className="border-primary/25 bg-primary/[0.03]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Rapport mensuel direction (texte / IA)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Synthèse KonaAI du mois en cours : inscriptions, encaissements, notes saisies et
              bulletins — tout l&apos;établissement, en un clic.
            </p>
            <Button
              className="bg-[#2563EB]"
              disabled={monthlyLoading}
              onClick={async () => {
                setMonthlyLoading(true);
                setMonthlyMsg(null);
                const res = await generateSchoolMonthlyReport();
                setMonthlyLoading(false);
                if ('error' in res && res.error) setMonthlyMsg(res.error);
                else if ('title' in res) {
                  setMonthlyMsg(`Rapport archivé : ${res.title}`);
                  setMonthlyReport({ title: res.title, content: res.report, archiveId: res.archiveId });
                }
                router.refresh();
              }}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {monthlyLoading ? 'Génération…' : 'Générer le rapport du mois'}
            </Button>
            {monthlyMsg && (
              <p className={`text-sm ${monthlyMsg.startsWith('Rapport') ? 'text-emerald-700' : 'text-destructive'}`}>
                {monthlyMsg}
              </p>
            )}
            {monthlyReport && (
              <AiReportDiffusion
                title={monthlyReport.title}
                content={monthlyReport.content}
                archiveId={monthlyReport.archiveId}
              />
            )}
          </CardContent>
        </Card>
      )}

      {isDirector && (
        <Card className="border-emerald-500/25 bg-emerald-500/[0.03]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Download className="h-5 w-5 text-emerald-700" />
              Export MEPS / bailleurs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Fiche statistique MEPPSA : effectifs H/F, enseignants, taux de réussite, présences,
              encaissements et bulletins définitifs — par classe.
            </p>
            <Button variant="ghost" size="sm" asChild className="px-0 h-auto text-primary">
              <Link href="/parametres/meps">
                <Settings className="h-3.5 w-3.5 mr-1" />
                Paramètres établissement MEPS
              </Link>
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={mepsLoading}
                onClick={async () => {
                  setMepsLoading(true);
                  setMepsMsg(null);
                  const res = await exportMepsSchoolStats();
                  setMepsLoading(false);
                  if ('error' in res && res.error) setMepsMsg(res.error);
                  else {
                    const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = res.fileName;
                    a.click();
                    URL.revokeObjectURL(url);
                    setMepsMsg(`${res.rowCount} classe(s) exportée(s).`);
                  }
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                {mepsLoading ? 'Export…' : 'Télécharger le CSV'}
              </Button>
              <Button
                variant="outline"
                disabled={mepsLoading}
                onClick={async () => {
                  setMepsLoading(true);
                  setMepsMsg(null);
                  const res = await exportMepsSchoolStats();
                  setMepsLoading(false);
                  if ('error' in res && res.error) setMepsMsg(res.error);
                  else {
                    await downloadTextAsPdf({
                      title: 'Export MEPS / bailleurs',
                      content: res.csv,
                      fileName: res.fileName.replace(/\.csv$/i, '.pdf'),
                      metaLine: `${res.rowCount} classe(s) — KonaData`,
                    });
                    setMepsMsg(`${res.rowCount} classe(s) exportée(s) en PDF.`);
                  }
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                {mepsLoading ? 'Export…' : 'Télécharger le PDF'}
              </Button>
            </div>
            {mepsMsg && (
              <p className={`text-sm ${mepsMsg.includes('exportée') ? 'text-emerald-700' : 'text-destructive'}`}>
                {mepsMsg}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {isDirector && (
        <SectorAiReportPanel
          sectorLabel="Établissement"
          scopeLabel="Périmètre"
          scopeOptions={classes.map((c) => ({ id: c.id, label: c.name }))}
          reportTypes={SCHOOL_AI_REPORT_TYPES}
          onGenerate={(scopeId, reportType) =>
            generateSchoolAiReport(scopeId, reportType as SchoolAiReportType)
          }
        />
      )}

      {isDirector && (
        <AiReportHistory history={reportHistory} sectorLabel="Établissement" />
      )}

      {canUploadCapture && captureDocumentTypes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="h-5 w-5" />
              Modèles KonaData (scan / CSV)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Téléversez une grille de notes, une liste de classe ou un registre de présence — les données
              seront structurées automatiquement.
            </p>
            {uploadError && (
              <p className="text-sm text-destructive">{uploadError}</p>
            )}
            <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
              <div className="space-y-2">
                <Label>Type de modèle *</Label>
                <Select value={documentType} onValueChange={setDocumentType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir" />
                  </SelectTrigger>
                  <SelectContent>
                    {captureDocumentTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedCaptureType?.hint && (
                  <p className="text-xs text-muted-foreground">{selectedCaptureType.hint}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Classe (optionnel)</Label>
                <Select value={classId} onValueChange={setClassId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pour import élèves" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <label>
              <Button asChild disabled={uploading || !documentType} className="cursor-pointer">
                <span>
                  <Upload className="h-4 w-4" />
                  {uploading ? 'Envoi…' : 'Choisir le fichier'}
                </span>
              </Button>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.csv,.xls,.xlsx,.jpg,.jpeg,.png"
                onChange={handleCaptureUpload}
                disabled={uploading || !documentType}
              />
            </label>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-4 sm:grid-cols-4 flex-1">
        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">Élèves inscrits</p>
          <p className="text-2xl font-bold">{stats.totalStudents}</p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">Paiements enregistrés</p>
          <p className="text-2xl font-bold">{stats.totalPayments}</p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">Montant encaissé</p>
          <p className="text-2xl font-bold">{formatCurrency(stats.amountCollected)}</p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">Bulletins générés</p>
          <p className="text-2xl font-bold">{stats.reportCards}</p>
        </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() =>
            void downloadTextAsPdf({
              title: 'Synthèse établissement',
              content: [
                `Élèves inscrits : ${stats.totalStudents}`,
                `Paiements enregistrés : ${stats.totalPayments}`,
                `Montant encaissé : ${formatCurrency(stats.amountCollected)}`,
                `Bulletins générés : ${stats.reportCards}`,
              ].join('\n'),
              metaLine: 'Rapports Établissement — KonaData',
            })
          }
        >
          <Download className="h-4 w-4 mr-1" />
          Synthèse PDF
        </Button>
      </div>

      {showFinance && financeOverview && (
        <DataTable
          title="Synthèse financière par classe"
          data={financeOverview.rows.map((r) => ({
            id: r.classId,
            classe: r.className,
            inscrits: r.enrolledCount,
            candidatures: r.pendingCandidates,
            attendu: r.expectedAmount,
            encaisse: r.collectedAmount,
            ecart: r.gap,
          }))}
          columns={[
            { key: 'classe', label: 'Classe' },
            { key: 'inscrits', label: 'Inscrits' },
            { key: 'candidatures', label: 'Candidatures' },
            { key: 'attendu', label: 'Attendu', render: (i) => formatCurrency(i.attendu as number) },
            { key: 'encaisse', label: 'Encaissé', render: (i) => formatCurrency(i.encaisse as number) },
            { key: 'ecart', label: 'Écart', render: (i) => formatCurrency(i.ecart as number) },
          ]}
        />
      )}

      <DataTable
        title="Documents archivés"
        data={documents.map((d) => ({
          ...d,
          categoryLabel: CATEGORY_LABELS[d.category] ?? d.category,
          hasAi: d.aiAdaptation ? 'Oui' : '—',
        }))}
        columns={[
          { key: 'title', label: 'Document' },
          { key: 'type', label: 'Format' },
          { key: 'categoryLabel', label: 'Catégorie' },
          { key: 'size', label: 'Taille' },
          { key: 'date', label: 'Date' },
          { key: 'hasAi', label: 'Consignes IA' },
          {
            key: 'status',
            label: 'Statut',
            render: () => <StatusBadge status="Archivé" />,
          },
        ]}
      />

      {docsWithCapture.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Données structurées KonaData</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {docsWithCapture.map((d) => (
              <div key={d.id} className="border-b pb-4 last:border-0 last:pb-0">
                <p className="font-medium text-sm">{d.title}</p>
                <p className="text-xs text-muted-foreground mb-2">{d.date}</p>
                {d.captureExtraction && (
                  <CaptureExtractionView
                    extraction={d.captureExtraction}
                    documentId={d.id}
                    classes={classes}
                    onReExtract={reRunCaptureExtraction}
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {docsWithAi.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Consignes IA par document</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {docsWithAi.map((d) => (
              <div key={d.id} className="border-b pb-4 last:border-0 last:pb-0">
                <p className="font-medium text-sm">{d.title}</p>
                <p className="text-xs text-muted-foreground mb-2">{d.date}</p>
                {d.aiAdaptation && <DocumentAiGuidance adaptation={d.aiAdaptation} defaultOpen />}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {documents.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Aucun document — téléversez des fichiers via Candidatures ou Data Factory.
        </p>
      )}
    </div>
  );
}
