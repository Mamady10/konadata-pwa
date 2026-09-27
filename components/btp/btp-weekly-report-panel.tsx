'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BtpWeeklyReportExport } from '@/components/btp/btp-weekly-report-export';
import { compileBtpWeeklySiteReportAction } from '@/lib/actions/btp-weekly-report';
import { getBtpPlanningRefOptionsForSite } from '@/lib/actions/btp-planning-ref';
import { getBulletinBrandingStatus, uploadBulletinLogo } from '@/lib/actions/bulletin-branding';
import { uploadBtpSiteDocument } from '@/lib/actions/storage';
import {
  getDefaultPeriodValue,
  resolveReportPeriod,
  type ReportPeriodType,
} from '@/lib/btp/report-period';
import type { WeeklyReportExportPayload } from '@/lib/btp/weekly-report-export-types';
import type { PlanningRefSlot } from '@/lib/btp/site-baseline-types';
import { CalendarRange, Camera, FileStack, Loader2, CheckCircle2, ImageUp } from 'lucide-react';

const PHOTO_MAX_DIMENSION = 1920;
const PHOTO_COMPRESS_ABOVE_BYTES = 1_200_000;

/** Réduit les photos lourdes (smartphone) avant envoi ; renvoie l'original si le navigateur ne sait pas la décoder. */
async function compressPhoto(file: File): Promise<File> {
  if (file.size <= PHOTO_COMPRESS_ABOVE_BYTES || !/^image\/(jpeg|png|webp)$/.test(file.type)) {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, PHOTO_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.82)
    );
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[a-z0-9]+$/i, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Date rattachée aux photos : aujourd'hui, ramenée dans la période choisie si besoin. */
function photoDateForPeriod(periodType: ReportPeriodType, periodValue: string): string {
  const today = todayIso();
  try {
    const { from, to } = resolveReportPeriod(periodType, periodValue);
    if (today > to) return to;
    if (today < from) return from;
  } catch {
    // Période incomplète : on garde la date du jour.
  }
  return today;
}

interface SiteOption {
  id: string;
  name: string;
}

interface Props {
  sites: SiteOption[];
  isDirector: boolean;
}

export function BtpWeeklyReportPanel({ sites, isDirector }: Props) {
  const router = useRouter();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '');
  const [periodType, setPeriodType] = useState<ReportPeriodType>('week');
  const [periodValue, setPeriodValue] = useState(getDefaultPeriodValue('week'));
  const [periodYear, setPeriodYear] = useState(String(new Date().getFullYear()));
  const [periodQuarter, setPeriodQuarter] = useState<'1' | '2' | '3' | '4'>('1');
  const [weeklyComment, setWeeklyComment] = useState('');
  const [includeFinancials, setIncludeFinancials] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [reportTitle, setReportTitle] = useState<string | null>(null);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [archived, setArchived] = useState(false);
  const [exportPayload, setExportPayload] = useState<WeeklyReportExportPayload | null>(null);
  const [hasLogo, setHasLogo] = useState<boolean | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoMessage, setLogoMessage] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isDirector) return;
    getBulletinBrandingStatus()
      .then((status) => setHasLogo(status.hasLogo))
      .catch(() => setHasLogo(null));
  }, [isDirector]);

  async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLogoUploading(true);
    setLogoMessage(null);
    const fd = new FormData();
    fd.set('file', file);
    const result = await uploadBulletinLogo(fd);
    setLogoUploading(false);
    if ('error' in result && result.error) {
      setLogoMessage(result.error);
      return;
    }
    setHasLogo(true);
    setLogoMessage('Logo enregistré : il apparaîtra sur les prochains rapports compilés.');
  }

  async function handlePhotoFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0 || !siteId) return;
    setPhotoUploading(true);
    setPhotoMessage(null);
    const photoDate = photoDateForPeriod(periodType, periodValue);
    let sent = 0;
    const failures: string[] = [];
    for (const original of files) {
      const file = await compressPhoto(original);
      const fd = new FormData();
      fd.set('site_id', siteId);
      fd.set('document_type', 'site_photo');
      fd.set('photo_date', photoDate);
      fd.set('file', file);
      try {
        const result = await uploadBtpSiteDocument(fd);
        if ('error' in result && result.error) failures.push(`${original.name} : ${result.error}`);
        else sent += 1;
      } catch {
        failures.push(`${original.name} : envoi impossible`);
      }
    }
    setPhotoUploading(false);
    setPhotoMessage(
      [
        sent > 0
          ? `${sent} photo(s) ajoutée(s) au chantier (datée(s) du ${new Date(`${photoDate}T12:00:00`).toLocaleDateString('fr-FR')}). Recompilez le rapport pour les voir.`
          : '',
        ...failures,
      ]
        .filter(Boolean)
        .join(' · ')
    );
  }

  useEffect(() => {
    if (periodType !== 'quarter') {
      setPeriodValue(getDefaultPeriodValue(periodType));
      return;
    }
    setPeriodValue(`${periodYear}-Q${periodQuarter}`);
  }, [periodType, periodYear, periodQuarter]);


  const [planningRefSlot, setPlanningRefSlot] = useState<PlanningRefSlot>(1);
  const [refOptions, setRefOptions] = useState<
    Array<{ slot: PlanningRefSlot; label: string; summary: string }>
  >([]);

  useEffect(() => {
    if (!siteId) {
      setRefOptions([]);
      return;
    }
    getBtpPlanningRefOptionsForSite(siteId).then(setRefOptions);
  }, [siteId]);

  async function handleCompile(e: React.FormEvent) {
    e.preventDefault();
    if (!siteId) {
      setError('Choisissez un chantier.');
      return;
    }
    setLoading(true);
    setError(null);
    setReport(null);
    setArchiveId(null);
    setArchived(false);
    setExportPayload(null);

    const fd = new FormData();
    fd.set('site_id', siteId);
    fd.set('period_type', periodType);
    fd.set('period_value', periodValue);
    fd.set('weekly_comment', weeklyComment);
    fd.set('planning_ref_slot', String(planningRefSlot));
    fd.set('include_financials', includeFinancials ? '1' : '0');

    const result = await compileBtpWeeklySiteReportAction(fd);
    setLoading(false);

    if ('error' in result) {
      setError(result.error);
      return;
    }

    setReport(result.report);
    setReportTitle(result.title);
    setArchiveId(result.archiveId ?? null);
    setArchived(result.archived);
    setExportPayload({
      title: result.title,
      subtitle: result.subtitle,
      periodType: result.periodType,
      periodValue: result.periodValue,
      periodLabel: result.periodLabel,
      isoWeek: result.isoWeek,
      scopeLabel: result.scopeLabel,
      orgName: result.orgName,
      sections: result.sections,
      structured: result.structured,
      stats: result.stats,
      generatedAt: new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' }),
    });
    if (result.archived) router.refresh();
  }

  if (sites.length === 0) {
    return (
      <Card className="border-amber-200/80 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileStack className="h-5 w-5 text-amber-700" />
            Rapport périodique chantier
          </CardTitle>
          <CardDescription>
            Aucun chantier n&apos;est disponible dans votre périmètre. Créez un chantier ou demandez une
            assignation pour compiler un rapport.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-emerald-200/80 bg-gradient-to-br from-emerald-500/5 to-transparent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileStack className="h-5 w-5 text-emerald-700" />
          Rapport périodique chantier
        </CardTitle>
        <CardDescription>
          Compile automatiquement les <strong>fiches journalières</strong> (Avancement), le{' '}
          <strong>carburant</strong> et les <strong>bons de livraison</strong> de la semaine
          sélectionnée (ou mois/trimestre/année) — téléchargeable en <strong>PDF</strong> et{' '}
          <strong>PowerPoint</strong>.
          {isDirector
            ? ' Archivé automatiquement après compilation.'
            : ' Transmettez le fichier au directeur pour validation officielle.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleCompile} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Chantier</Label>
            <Select value={siteId} onValueChange={setSiteId}>
              <SelectTrigger>
                <SelectValue placeholder="Chantier" />
              </SelectTrigger>
              <SelectContent>
                {sites.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <CalendarRange className="h-3.5 w-3.5" />
              Période
            </Label>
            <div className="grid gap-2 sm:grid-cols-2">
              <Select value={periodType} onValueChange={(v) => setPeriodType(v as ReportPeriodType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Type de période" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Semaine</SelectItem>
                  <SelectItem value="month">Mois</SelectItem>
                  <SelectItem value="quarter">Trimestre</SelectItem>
                  <SelectItem value="year">Année</SelectItem>
                </SelectContent>
              </Select>
              {periodType === 'week' && (
                <Input
                  type="week"
                  value={periodValue}
                  onChange={(e) => setPeriodValue(e.target.value)}
                  required
                />
              )}
              {periodType === 'month' && (
                <Input
                  type="month"
                  value={periodValue}
                  onChange={(e) => setPeriodValue(e.target.value)}
                  required
                />
              )}
              {periodType === 'year' && (
                <Input
                  type="number"
                  min={2020}
                  max={2099}
                  value={periodValue}
                  onChange={(e) => setPeriodValue(e.target.value)}
                  required
                />
              )}
              {periodType === 'quarter' && (
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    min={2020}
                    max={2099}
                    value={periodYear}
                    onChange={(e) => setPeriodYear(e.target.value)}
                    required
                  />
                  <Select value={periodQuarter} onValueChange={(v) => setPeriodQuarter(v as '1' | '2' | '3' | '4')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Trimestre" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">T1</SelectItem>
                      <SelectItem value="2">T2</SelectItem>
                      <SelectItem value="3">T3</SelectItem>
                      <SelectItem value="4">T4</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Référence planning (étude comparative)</Label>
            <Select
              value={String(planningRefSlot)}
              onValueChange={(v) => setPlanningRefSlot(v === '2' ? 2 : 1)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir la référence" />
              </SelectTrigger>
              <SelectContent>
                {(refOptions.length > 0
                  ? refOptions
                  : [
                      { slot: 1 as PlanningRefSlot, label: 'Référence 1', summary: 'Dates / jalons' },
                      { slot: 2 as PlanningRefSlot, label: 'Référence 2', summary: 'À configurer' },
                    ]
                ).map((opt) => (
                  <SelectItem key={opt.slot} value={String(opt.slot)}>
                    Ref {opt.slot} — {opt.summary}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Choisissez sur quel planning baser la comparaison planifié vs réel dans ce rapport.
            </p>
          </div>
          <label className="sm:col-span-2 flex cursor-pointer items-start gap-3 rounded-lg border bg-background/60 p-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-primary"
              checked={includeFinancials}
              onChange={(e) => setIncludeFinancials(e.target.checked)}
            />
            <span>
              <span className="font-medium">Afficher les données financières</span>
              <span className="block text-xs text-muted-foreground">
                Budget, coût dépensé, montant restant, coûts carburant et montants des bons de livraison.
                Décochez pour un rapport sans aucun montant (ex. rapport destiné à l&apos;extérieur).
              </span>
            </span>
          </label>
          <div className="space-y-2 sm:col-span-2">
            <Label>Commentaire de synthèse (optionnel)</Label>
            <textarea
              value={weeklyComment}
              onChange={(e) => setWeeklyComment(e.target.value)}
              placeholder="Risques semaine prochaine, demandes MOA, décisions…"
              rows={2}
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>
          <div className="sm:col-span-2 flex flex-wrap items-center gap-3 rounded-lg border bg-background/60 p-3 text-sm">
            <Camera className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 min-w-[200px]">
              Photos du chantier : les photos de la période choisie (6 plus récentes) sont
              intégrées au rapport PDF et PowerPoint.
            </span>
            <label className="inline-flex">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                className="hidden"
                onChange={handlePhotoFiles}
                disabled={photoUploading || !siteId}
              />
              <span className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-xs font-medium hover:bg-muted">
                {photoUploading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {photoUploading ? 'Envoi…' : 'Ajouter des photos'}
              </span>
            </label>
            {photoMessage && <p className="w-full text-xs text-muted-foreground">{photoMessage}</p>}
          </div>
          {isDirector && (
            <div className="sm:col-span-2 flex flex-wrap items-center gap-3 rounded-lg border bg-background/60 p-3 text-sm">
              <ImageUp className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 min-w-[200px]">
                Logo de l&apos;entreprise (en-tête du rapport) :{' '}
                <strong>{hasLogo == null ? '…' : hasLogo ? 'enregistré' : 'aucun'}</strong>
              </span>
              <label className="inline-flex">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleLogoFile}
                  disabled={logoUploading}
                />
                <span className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-xs font-medium hover:bg-muted">
                  {logoUploading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {hasLogo ? 'Changer le logo' : 'Ajouter le logo'}
                </span>
              </label>
              {logoMessage && <p className="w-full text-xs text-muted-foreground">{logoMessage}</p>}
            </div>
          )}
          <div className="sm:col-span-2">
            <Button
              type="submit"
              disabled={loading}
              className="bg-emerald-700 hover:bg-emerald-800"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Compilation…
                </>
              ) : (
                <>
                  <FileStack className="h-4 w-4" />
                  Compiler le rapport
                </>
              )}
            </Button>
          </div>
        </form>

        {error && (
          <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/10 p-3">
            {error}
          </p>
        )}

        {exportPayload && (
          <p className="text-xs text-muted-foreground">
            Sources : {exportPayload.stats.dailyEntries} fiche(s) journalière(s) ·{' '}
            {exportPayload.stats.fuelLogs} relevé(s) carburant ·{' '}
            {exportPayload.stats.deliveryNotes} bon(s) de livraison ·{' '}
            {exportPayload.structured.photos?.length ?? 0} photo(s) du chantier
          </p>
        )}

        {archived && (
          <p className="text-sm text-emerald-800 flex items-center gap-2 bg-emerald-500/10 border border-emerald-200 rounded-lg p-3">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Rapport archivé — visible dans l&apos;historique ci-dessous.
          </p>
        )}

        {report && reportTitle && exportPayload && (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <pre className="text-xs whitespace-pre-wrap max-h-64 overflow-y-auto font-mono leading-relaxed">
              {report}
            </pre>
            <BtpWeeklyReportExport
              payload={exportPayload}
              textFallback={report}
              archiveId={archiveId}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
