'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BtpPlanningRefEditor } from '@/components/btp/btp-planning-ref-editor';
import {
  closeBtpSite,
  reopenBtpSite,
  updateBtpSite,
  type BtpSiteDetailRow,
} from '@/lib/actions/btp-site-detail';
import { uploadBtpSiteDocument } from '@/lib/actions/storage';
import type { BtpSitePlanningRef } from '@/lib/btp/planning-ref';
import { formatCurrency } from '@/lib/utils';
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  HardHat,
  Loader2,
  Lock,
  Upload,
} from 'lucide-react';
import { AiReportDiffusion } from '@/components/ai/ai-report-diffusion';

interface DocRow {
  id: string;
  file_name: string;
  doc_type_label: string;
  created_at: string;
}

interface DocTypeOption {
  id: string;
  label: string;
}

interface Props {
  site: BtpSiteDetailRow;
  documents: DocRow[];
  documentTypes: DocTypeOption[];
  isDirector: boolean;
  canUpload: boolean;
}

const STATUS_OPTIONS = [
  { value: 'planning', label: 'Planification' },
  { value: 'active', label: 'En cours' },
  { value: 'paused', label: 'En pause' },
  { value: 'cancelled', label: 'Annulé' },
];

export function BtpSiteDetailClient({
  site: initialSite,
  documents: initialDocs,
  documentTypes,
  isDirector,
  canUpload,
}: Props) {
  const router = useRouter();
  const [site, setSite] = useState(initialSite);
  const [docs] = useState(initialDocs);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState(documentTypes[0]?.id ?? '');
  const [closureComment, setClosureComment] = useState(site.closure_comment ?? '');
  const [closureLoading, setClosureLoading] = useState(false);
  const [closureError, setClosureError] = useState<string | null>(null);
  const [closureReport, setClosureReport] = useState<string | null>(null);
  const [closureArchiveId, setClosureArchiveId] = useState<string | null>(site.closure_report_id);
  const [planningRefSlot, setPlanningRefSlot] = useState<1 | 2>(site.default_planning_ref_slot);

  const isClosed = site.status === 'completed';

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isDirector || isClosed) return;
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);
    const fd = new FormData(e.currentTarget);
    fd.set('site_id', site.id);
    const result = await updateBtpSite(fd);
    setSaving(false);
    if ('error' in result) {
      setSaveError(result.error);
      return;
    }
    setSaveOk(true);
    router.refresh();
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !canUpload) return;
    if (!docType) {
      setUploadError('Choisissez un type de document.');
      return;
    }
    setUploading(true);
    setUploadError(null);
    const fd = new FormData();
    fd.set('file', file);
    fd.set('site_id', site.id);
    fd.set('document_type', docType);
    const result = await uploadBtpSiteDocument(fd);
    setUploading(false);
    e.target.value = '';
    if ('error' in result) {
      setUploadError(result.error ?? 'Téléversement impossible.');
      return;
    }
    router.refresh();
  }

  async function handleClose() {
    if (!isDirector || isClosed) return;
    if (!confirm('Clôturer ce chantier ? Un dossier MOA sera généré et archivé.')) return;
    setClosureLoading(true);
    setClosureError(null);
    const fd = new FormData();
    fd.set('site_id', site.id);
    fd.set('closure_comment', closureComment);
    fd.set('planning_ref_slot', String(planningRefSlot));
    const result = await closeBtpSite(fd);
    setClosureLoading(false);
    if ('error' in result) {
      setClosureError(result.error);
      return;
    }
    setClosureReport(result.report);
    setClosureArchiveId(result.archiveId);
    setSite((s) => ({ ...s, status: 'completed', statusLabel: 'Terminé' }));
    router.refresh();
  }

  async function handleReopen() {
    if (!isDirector) return;
    if (!confirm('Rouvrir ce chantier pour modifications ?')) return;
    const result = await reopenBtpSite(site.id);
    if ('error' in result) {
      setClosureError(result.error);
      return;
    }
    setSite((s) => ({ ...s, status: 'active', statusLabel: 'En cours' }));
    setClosureReport(null);
    router.refresh();
  }

  const bd = site.budget_breakdown;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link href="/btp/chantiers">
              <ArrowLeft className="h-4 w-4" />
              Retour aux chantiers
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
              <HardHat className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{site.name}</h1>
              <p className="text-muted-foreground text-sm">
                {site.location ?? '—'} · Budget {formatCurrency(site.budget)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={isClosed ? 'secondary' : 'outline'}>{site.statusLabel}</Badge>
            <Badge variant="outline">{Math.round(site.physical_progress)} % physique</Badge>
            {site.delay_days > 0 && (
              <Badge variant="destructive">Retard {site.delay_days} j</Badge>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="infos" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="infos">Informations</TabsTrigger>
          <TabsTrigger value="documents">Documents ({docs.length})</TabsTrigger>
          <TabsTrigger value="planning">Planning</TabsTrigger>
          {isDirector && <TabsTrigger value="cloture">Clôture MOA</TabsTrigger>}
        </TabsList>

        <TabsContent value="infos">
          <Card>
            <CardHeader>
              <CardTitle>Fiche chantier</CardTitle>
              <CardDescription>
                {isDirector && !isClosed
                  ? 'Modifiez les informations puis Enregistrer.'
                  : isClosed
                    ? 'Chantier clôturé — lecture seule.'
                    : 'Consultation — contactez la direction pour modifier.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {saveError && (
                <p className="text-sm text-destructive mb-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                  {saveError}
                </p>
              )}
              {saveOk && (
                <p className="text-sm text-emerald-800 mb-3 flex items-center gap-2 bg-emerald-500/10 border border-emerald-200 rounded-lg p-3">
                  <CheckCircle2 className="h-4 w-4" />
                  Modifications enregistrées.
                </p>
              )}
              <form onSubmit={handleSave} className="space-y-4">
                <input type="hidden" name="site_id" value={site.id} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Nom du chantier *</Label>
                    <Input name="name" defaultValue={site.name} required disabled={!isDirector || isClosed} />
                  </div>
                  <div className="space-y-2">
                    <Label>Localisation</Label>
                    <Input name="location" defaultValue={site.location ?? ''} disabled={!isDirector || isClosed} />
                  </div>
                  <div className="space-y-2">
                    <Label>Client / MOA</Label>
                    <Input name="client" defaultValue={site.client ?? ''} disabled={!isDirector || isClosed} />
                  </div>
                  <div className="space-y-2">
                    <Label>N° marché</Label>
                    <Input name="contract_ref" defaultValue={site.contract_ref ?? ''} disabled={!isDirector || isClosed} />
                  </div>
                  <div className="space-y-2">
                    <Label>Statut</Label>
                    <select
                      name="status"
                      defaultValue={site.status === 'completed' ? 'active' : site.status}
                      disabled={!isDirector || isClosed}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Date de début</Label>
                    <Input name="start_date" type="date" defaultValue={site.start_date ?? ''} disabled={!isDirector || isClosed} />
                  </div>
                  <div className="space-y-2">
                    <Label>Date de fin prévue</Label>
                    <Input name="end_date" type="date" defaultValue={site.end_date ?? ''} disabled={!isDirector || isClosed} />
                  </div>
                  <div className="space-y-2">
                    <Label>Budget total (GNF)</Label>
                    <Input name="budget" type="number" min={0} defaultValue={site.budget} disabled={!isDirector || isClosed} />
                  </div>
                  <div className="space-y-2">
                    <Label>Déjà engagé au démarrage (GNF)</Label>
                    <Input name="opening_spent" type="number" min={0} defaultValue={site.opening_spent} disabled={!isDirector || isClosed} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Description</Label>
                    <textarea
                      name="description"
                      rows={2}
                      defaultValue={site.description ?? ''}
                      disabled={!isDirector || isClosed}
                      className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none disabled:opacity-60"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Destinataire rapport MOA</Label>
                    <Input name="moa_recipient" defaultValue={site.moa_recipient ?? ''} disabled={!isDirector || isClosed} />
                  </div>
                  <div className="space-y-2">
                    <Label>Seuil alerte budget (%)</Label>
                    <Input name="budget_alert_pct" type="number" min={50} max={100} defaultValue={site.budget_alert_pct} disabled={!isDirector || isClosed} />
                  </div>
                </div>
                <div className="rounded-lg border bg-muted/20 p-4 grid gap-3 sm:grid-cols-5">
                  <div className="space-y-1">
                    <Label className="text-xs">MO %</Label>
                    <Input name="budget_labor" type="number" min={0} defaultValue={bd.labor ?? 25} disabled={!isDirector || isClosed} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Matériaux %</Label>
                    <Input name="budget_materials" type="number" min={0} defaultValue={bd.materials ?? 40} disabled={!isDirector || isClosed} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Engins %</Label>
                    <Input name="budget_equipment" type="number" min={0} defaultValue={bd.equipment ?? 15} disabled={!isDirector || isClosed} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">ST %</Label>
                    <Input name="budget_subcontract" type="number" min={0} defaultValue={bd.subcontract ?? 10} disabled={!isDirector || isClosed} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">FG %</Label>
                    <Input name="budget_overhead" type="number" min={0} defaultValue={bd.overhead ?? 10} disabled={!isDirector || isClosed} />
                  </div>
                </div>
                {isDirector && !isClosed && (
                  <Button type="submit" disabled={saving} className="bg-emerald-700 hover:bg-emerald-800">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enregistrer les modifications'}
                  </Button>
                )}
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Documents du chantier
              </CardTitle>
              <CardDescription>
                Pièces rattachées à ce chantier (BL scannés, photos, rapports…).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {canUpload && !isClosed && (
                <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-4">
                  <div className="space-y-2 min-w-[200px]">
                    <Label>Type de document</Label>
                    <select
                      value={docType}
                      onChange={(e) => setDocType(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {documentTypes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label>
                    <Button asChild disabled={uploading}>
                      <span>
                        {uploading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                        Téléverser
                      </span>
                    </Button>
                    <input type="file" className="hidden" onChange={handleUpload} />
                  </label>
                </div>
              )}
              {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
              {docs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun document sur ce chantier.</p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {docs.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                      <span className="font-medium truncate">{d.file_name}</span>
                      <span className="text-muted-foreground text-xs">
                        {d.doc_type_label} · {d.created_at.slice(0, 10)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="planning">
          <Card>
            <CardHeader>
              <CardTitle>Références planning</CardTitle>
              <CardDescription>Jalons, dates ou import MS Project (XML).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <BtpPlanningRefEditor
                siteId={site.id}
                siteName={site.name}
                slot={1}
                refData={site.planningRefs.find((r) => r.slot === 1)}
                isDefaultRef={site.default_planning_ref_slot === 1}
                canManage={isDirector && !isClosed}
              />
              <BtpPlanningRefEditor
                siteId={site.id}
                siteName={site.name}
                slot={2}
                refData={site.planningRefs.find((r) => r.slot === 2)}
                isDefaultRef={site.default_planning_ref_slot === 2}
                canManage={isDirector && !isClosed}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {isDirector && (
          <TabsContent value="cloture">
            <Card className={isClosed ? 'border-emerald-200' : ''}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {isClosed ? <Lock className="h-5 w-5 text-emerald-700" /> : <CheckCircle2 className="h-5 w-5" />}
                  Clôture & dossier MOA
                </CardTitle>
                <CardDescription>
                  Génère le rapport de synthèse, liste les pièces et passe le chantier en Terminé.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {closureError && (
                  <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                    {closureError}
                  </p>
                )}
                {isClosed ? (
                  <div className="space-y-3">
                    <p className="text-sm text-emerald-800 flex items-center gap-2 bg-emerald-500/10 border border-emerald-200 rounded-lg p-3">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      Chantier clôturé
                      {site.completed_at ? ` le ${site.completed_at.slice(0, 10)}` : ''}.
                      {closureArchiveId && (
                        <span className="block text-xs mt-1 text-muted-foreground">
                          Rapport archivé — réf. {closureArchiveId.slice(0, 8)}…
                        </span>
                      )}
                    </p>
                    {site.closure_comment && (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap border rounded-lg p-3">
                        {site.closure_comment}
                      </p>
                    )}
                    <p className="text-sm">{docs.length} document(s) dans le dossier.</p>
                    <Button type="button" variant="outline" onClick={handleReopen}>
                      Rouvrir le chantier
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>Référence planning pour le rapport final</Label>
                      <select
                        value={planningRefSlot}
                        onChange={(e) => setPlanningRefSlot(Number(e.target.value) === 2 ? 2 : 1)}
                        className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value={1}>Référence 1</option>
                        <option value={2}>Référence 2</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Commentaire de clôture / réception MOA</Label>
                      <textarea
                        value={closureComment}
                        onChange={(e) => setClosureComment(e.target.value)}
                        rows={3}
                        placeholder="Réserves MOA, observations finales, date de réception…"
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {docs.length} document(s) seront listés dans le dossier. Le rapport couvre la période
                      du début du chantier à aujourd&apos;hui.
                    </p>
                    <Button
                      type="button"
                      onClick={handleClose}
                      disabled={closureLoading}
                      className="bg-emerald-700 hover:bg-emerald-800"
                    >
                      {closureLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Clôture en cours…
                        </>
                      ) : (
                        <>
                          <Lock className="h-4 w-4" />
                          Clôturer le chantier
                        </>
                      )}
                    </Button>
                  </>
                )}
                {closureReport && (
                  <div className="space-y-2">
                    <pre className="text-xs whitespace-pre-wrap max-h-64 overflow-y-auto font-mono border rounded-lg p-3 bg-muted/30">
                      {closureReport}
                    </pre>
                    <AiReportDiffusion
                      title={`Dossier de clôture — ${site.name}`}
                      content={closureReport}
                      archiveId={closureArchiveId}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
