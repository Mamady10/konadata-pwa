'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CaptureExtractionResult } from '@/lib/ai/extraction/capture-extract-types';
import { applyCaptureToDatabase } from '@/lib/actions/capture-apply';
import { ReportCardsCta } from '@/components/school/report-cards-cta';
import type { ReportCardsSuggestion } from '@/lib/school/grades-to-bulletins';
import { getCaptureApplyUi } from '@/lib/capture/capture-apply-ui';
import { Switch } from '@/components/ui/switch';
import { ChevronDown, ChevronUp, Database, RefreshCw, Table2 } from 'lucide-react';

interface ScopeOption {
  id: string;
  name: string;
}

interface Props {
  extraction: CaptureExtractionResult;
  documentId?: string;
  compact?: boolean;
  classes?: ScopeOption[];
  sites?: ScopeOption[];
  projects?: ScopeOption[];
  defaultClassId?: string | null;
  defaultSiteId?: string | null;
  defaultProjectId?: string | null;
  onReExtract?: (documentId: string) => Promise<{ error?: string }>;
}

const STATUS_LABELS: Record<CaptureExtractionResult['status'], string> = {
  ok: 'Structuré',
  partial: 'Partiel',
  failed: 'Échec',
};

const METHOD_LABELS: Record<CaptureExtractionResult['parse_method'], string> = {
  llm: 'KonaAI',
  csv: 'CSV KonaData',
  heuristic: 'Analyse locale',
};

const FIELD_LABELS: Record<string, string> = {
  date: 'Date',
  location: 'Lieu',
  participants: 'Participants',
  activities: 'Activités',
  results: 'Résultats',
  difficulties: 'Difficultés',
  recommendations: 'Recommandations',
  full_name: 'Nom',
  sex_age: 'Sexe / âge',
  phone: 'Téléphone',
  locality: 'Localité',
  project: 'Projet',
  remarks: 'Remarques',
  workforce: 'Effectif',
  tasks: 'Travaux',
  materials: 'Matériels',
  incidents: 'Incidents',
  observations: 'Observations',
};

function FieldsBlock({ fields }: { fields: Record<string, string | undefined> }) {
  const entries = Object.entries(fields).filter(([, v]) => v?.trim());
  if (!entries.length) return <p className="text-sm text-muted-foreground">Aucun champ extrait.</p>;
  return (
    <dl className="grid gap-2 sm:grid-cols-2 text-sm">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-md border px-3 py-2 bg-background/60">
          <dt className="text-xs text-muted-foreground">{FIELD_LABELS[key] ?? key}</dt>
          <dd className="font-medium whitespace-pre-wrap">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function RowsTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">Aucune ligne extraite.</p>;
  const display = rows.slice(0, 12);
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/40">
            {headers.map((h) => (
              <th key={h} className="px-2 py-1.5 text-left font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {display.map((row, i) => (
            <tr key={i} className="border-b last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="px-2 py-1.5 whitespace-nowrap">
                  {cell || '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 12 && (
        <p className="text-xs text-muted-foreground px-2 py-1.5">
          + {rows.length - 12} ligne(s) supplémentaire(s)
        </p>
      )}
    </div>
  );
}

function payloadToTable(extraction: CaptureExtractionResult): { headers: string[]; rows: string[][] } {
  const p = extraction.payload;
  if (p.shape === 'grade_sheet') {
    return {
      headers: ['Nom', 'Code', 'Maths', 'Fr.', 'Angl.', 'SVT', 'Hist-Géo', 'Moy.'],
      rows: p.rows.map((r) => [
        r.full_name,
        r.student_code ?? '',
        r.maths ?? '',
        r.francais ?? '',
        r.anglais ?? '',
        r.svt ?? '',
        r.hist_geo ?? '',
        r.moyenne ?? '',
      ]),
    };
  }
  if (p.shape === 'person_rows') {
    return {
      headers: ['Nom', 'Identifiant', 'Tél.', 'Email', 'Présent', 'Absent', 'Remarque'],
      rows: p.rows.map((r) => [
        r.full_name,
        r.identifier ?? '',
        r.phone ?? '',
        r.email ?? '',
        r.present ?? '',
        r.absent ?? '',
        r.remark ?? '',
      ]),
    };
  }
  if (p.shape === 'fuel_rows') {
    return {
      headers: ['Date', 'Engin', 'Litres', 'Index', 'Chauffeur', 'Obs.'],
      rows: p.rows.map((r) => [
        r.date ?? '',
        r.equipment ?? '',
        r.liters ?? '',
        r.meter_index ?? '',
        r.driver ?? '',
        r.remark ?? '',
      ]),
    };
  }
  if (p.shape === 'delivery_rows') {
    return {
      headers: ['Date', 'Fournisseur', 'Matériau', 'Qté', 'Unité', 'Reçu par'],
      rows: p.rows.map((r) => [
        r.date ?? '',
        r.supplier ?? '',
        r.material ?? '',
        r.quantity ?? '',
        r.unit ?? '',
        r.received_by ?? '',
      ]),
    };
  }
  if (p.shape === 'expense_rows') {
    return {
      headers: ['Date', 'Libellé', 'Montant GNF', 'Paiement', 'Justificatif'],
      rows: p.rows.map((r) => [
        r.date ?? '',
        r.label ?? '',
        r.amount_gnf ?? '',
        r.payment_mode ?? '',
        r.receipt_ref ?? '',
      ]),
    };
  }
  if (p.shape === 'purchase_rows') {
    return {
      headers: ['Réf.', 'Désignation', 'Qté', 'P.U. GNF', 'Total GNF', 'Rem.'],
      rows: p.rows.map((r) => [
        r.reference ?? '',
        r.designation ?? '',
        r.quantity ?? '',
        r.unit_price_gnf ?? '',
        r.total_gnf ?? '',
        r.remark ?? '',
      ]),
    };
  }
  if (p.shape === 'stock_rows') {
    return {
      headers: ['Réf.', 'Désignation', 'Qté comptée', 'Unité', 'Écart', 'Obs.'],
      rows: p.rows.map((r) => [
        r.reference ?? '',
        r.designation ?? '',
        r.quantity_counted ?? '',
        r.unit ?? '',
        r.variance ?? '',
        r.remark ?? '',
      ]),
    };
  }
  return { headers: [], rows: [] };
}

export function CaptureExtractionView({
  extraction,
  documentId,
  compact,
  classes,
  sites,
  projects,
  defaultClassId,
  defaultSiteId,
  defaultProjectId,
  onReExtract,
}: Props) {
  const router = useRouter();
  const applyUi = getCaptureApplyUi(extraction.kind);
  const [open, setOpen] = useState(extraction.status === 'ok');
  const [classId, setClassId] = useState(defaultClassId ?? '');
  const [siteId, setSiteId] = useState(defaultSiteId ?? '');
  const [projectId, setProjectId] = useState(defaultProjectId ?? '');
  const [examType, setExamType] = useState('Devoir');
  const [semester, setSemester] = useState('S1');
  const [academicYear, setAcademicYear] = useState('2025-2026');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [reportCardsHint, setReportCardsHint] = useState<ReportCardsSuggestion | null>(null);
  const [sendSmsToGuardians, setSendSmsToGuardians] = useState(false);

  const hasFieldPayload =
    extraction.payload.shape === 'field_report' ||
    extraction.payload.shape === 'beneficiary' ||
    extraction.payload.shape === 'daily_site_report';

  const canApply =
    extraction.status !== 'failed' &&
    (extraction.row_count > 0 || hasFieldPayload) &&
    Boolean(applyUi && documentId);

  const table = 'rows' in extraction.payload ? payloadToTable(extraction) : null;
  const fields =
    extraction.payload.shape === 'field_report' ||
    extraction.payload.shape === 'beneficiary' ||
    extraction.payload.shape === 'daily_site_report'
      ? extraction.payload.fields
      : null;

  async function handleReExtract() {
    if (!onReExtract || !documentId) return;
    setLoading(true);
    setMessage(null);
    const res = await onReExtract(documentId);
    setMessage(res.error ?? 'Extraction relancée — actualisez la page.');
    setLoading(false);
  }

  async function handleApply() {
    if (!documentId || !applyUi) return;
    setLoading(true);
    setMessage(null);
    const res = await applyCaptureToDatabase(documentId, {
      classId: classId || undefined,
      siteId: siteId || undefined,
      projectId: projectId || undefined,
      examType,
      semester,
      academicYear,
      sendSmsToGuardians: applyUi?.optionalSmsGuardians ? sendSmsToGuardians : undefined,
    });
    if (res.error) setMessage(res.error);
    else {
      setMessage(
        res.message ??
          `${res.saved ?? res.created ?? res.updated ?? 0} enregistrement(s) effectué(s).`
      );
      setReportCardsHint(res.reportCards ?? null);
      router.refresh();
    }
    setLoading(false);
  }

  const needsClass = applyUi?.needsClass && classes?.length;
  const needsSite = applyUi?.needsSite && sites?.length;
  const needsProject =
    (applyUi?.needsProject || applyUi?.optionalProject) && projects?.length;
  const showApplyForm = canApply && (needsClass || needsSite || needsProject || applyUi?.needsGradeMeta || !needsClass && !needsSite && !needsProject);

  return (
    <div
      className={
        compact
          ? 'mt-2 rounded-md border border-emerald-500/20 bg-emerald-500/5'
          : 'mt-3 rounded-lg border border-emerald-500/25 bg-emerald-500/5'
      }
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full justify-between h-auto py-2 px-3 text-left font-normal hover:bg-emerald-500/10"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2 text-sm flex-wrap">
          <Table2 className="h-4 w-4 text-emerald-700 shrink-0" />
          <span>Données structurées KonaData</span>
          <Badge variant="outline" className="text-emerald-800 border-emerald-300">
            {STATUS_LABELS[extraction.status]}
          </Badge>
          {extraction.row_count > 0 && (
            <span className="text-muted-foreground font-normal">
              {extraction.row_count} ligne{extraction.row_count > 1 ? 's' : ''}
            </span>
          )}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </Button>

      {open && (
        <div className="px-3 pb-3 pt-0 space-y-3">
          <p className="text-xs text-muted-foreground">
            Méthode : {METHOD_LABELS[extraction.parse_method]}
            {extraction.confidence > 0 ? ` · confiance ${extraction.confidence}%` : ''}
            {extraction.extracted_at
              ? ` · ${new Date(extraction.extracted_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`
              : ''}
          </p>

          {extraction.warnings.length > 0 && (
            <ul className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5 list-disc pl-5">
              {extraction.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}

          {fields && <FieldsBlock fields={fields} />}
          {table && <RowsTable headers={table.headers} rows={table.rows} />}

          {(onReExtract || showApplyForm) && (
            <div className="space-y-3 pt-1 border-t border-emerald-500/15">
              <div className="flex flex-wrap items-end gap-3">
                {onReExtract && documentId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loading}
                    onClick={handleReExtract}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Ré-extraire
                  </Button>
                )}
              </div>

              {showApplyForm && applyUi && (
                <div className="flex flex-wrap items-end gap-3">
                  {needsClass && (
                    <div className="space-y-1 min-w-[160px]">
                      <Label className="text-xs">Classe *</Label>
                      <Select value={classId} onValueChange={setClassId}>
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Choisir" />
                        </SelectTrigger>
                        <SelectContent>
                          {classes!.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {needsSite && (
                    <div className="space-y-1 min-w-[160px]">
                      <Label className="text-xs">Chantier *</Label>
                      <Select value={siteId} onValueChange={setSiteId}>
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Choisir" />
                        </SelectTrigger>
                        <SelectContent>
                          {sites!.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {needsProject && (
                    <div className="space-y-1 min-w-[160px]">
                      <Label className="text-xs">
                        Projet{applyUi.optionalProject ? ' (optionnel)' : ' *'}
                      </Label>
                      <Select value={projectId} onValueChange={setProjectId}>
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Choisir" />
                        </SelectTrigger>
                        <SelectContent>
                          {projects!.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {applyUi.optionalSmsGuardians && (
                    <div className="flex items-center gap-2 min-w-[200px]">
                      <Switch
                        checked={sendSmsToGuardians}
                        onCheckedChange={setSendSmsToGuardians}
                      />
                      <Label className="text-xs font-normal">SMS tuteurs après import</Label>
                    </div>
                  )}
                  {applyUi.needsGradeMeta && (
                    <>
                      <div className="space-y-1 min-w-[100px]">
                        <Label className="text-xs">Semestre</Label>
                        <Select value={semester} onValueChange={setSemester}>
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="S1">S1</SelectItem>
                            <SelectItem value="S2">S2</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1 min-w-[120px]">
                        <Label className="text-xs">Évaluation</Label>
                        <Input
                          className="h-8"
                          value={examType}
                          onChange={(e) => setExamType(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1 min-w-[120px]">
                        <Label className="text-xs">Année</Label>
                        <Input
                          className="h-8"
                          value={academicYear}
                          onChange={(e) => setAcademicYear(e.target.value)}
                        />
                      </div>
                    </>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    disabled={
                      loading ||
                      (applyUi.needsClass && !classId) ||
                      (applyUi.needsSite && !siteId) ||
                      (applyUi.needsProject && !projectId)
                    }
                    onClick={handleApply}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Database className="h-3.5 w-3.5" />
                    {applyUi.label}
                  </Button>
                </div>
              )}
            </div>
          )}

          {message && <p className="text-xs text-muted-foreground">{message}</p>}
          <ReportCardsCta suggestion={reportCardsHint} />
        </div>
      )}
    </div>
  );
}
