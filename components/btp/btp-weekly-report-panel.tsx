'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AiReportDiffusion } from '@/components/ai/ai-report-diffusion';
import { compileBtpWeeklySiteReportAction } from '@/lib/actions/btp-weekly-report';
import { getCurrentIsoWeekValue } from '@/lib/btp/week-period';
import { CalendarRange, FileStack, Loader2, CheckCircle2 } from 'lucide-react';

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
  const [isoWeek, setIsoWeek] = useState(getCurrentIsoWeekValue());
  const [weeklyComment, setWeeklyComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [reportTitle, setReportTitle] = useState<string | null>(null);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [archived, setArchived] = useState(false);
  const [stats, setStats] = useState<{
    dailyEntries: number;
    fuelLogs: number;
    deliveryNotes: number;
  } | null>(null);

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
    setStats(null);

    const fd = new FormData();
    fd.set('site_id', siteId);
    fd.set('iso_week', isoWeek);
    fd.set('weekly_comment', weeklyComment);

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
    setStats({
      dailyEntries: result.stats.dailyEntries,
      fuelLogs: result.stats.fuelLogs,
      deliveryNotes: result.stats.deliveryNotes,
    });
    if (result.archived) router.refresh();
  }

  if (sites.length === 0) {
    return null;
  }

  return (
    <Card className="border-emerald-200/80 bg-gradient-to-br from-emerald-500/5 to-transparent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileStack className="h-5 w-5 text-emerald-700" />
          Rapport hebdomadaire chantier
        </CardTitle>
        <CardDescription>
          Compile automatiquement les <strong>fiches journalières</strong> (Avancement), le{' '}
          <strong>carburant</strong> et les <strong>bons de livraison</strong> de la semaine
          sélectionnée en un seul rapport.
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
              Semaine (ISO)
            </Label>
            <Input
              type="week"
              value={isoWeek}
              onChange={(e) => setIsoWeek(e.target.value)}
              required
            />
          </div>
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
                  Compiler le rapport hebdomadaire
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

        {stats && (
          <p className="text-xs text-muted-foreground">
            Sources : {stats.dailyEntries} fiche(s) journalière(s) · {stats.fuelLogs} relevé(s)
            carburant · {stats.deliveryNotes} bon(s) de livraison
          </p>
        )}

        {archived && (
          <p className="text-sm text-emerald-800 flex items-center gap-2 bg-emerald-500/10 border border-emerald-200 rounded-lg p-3">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Rapport archivé — visible dans l&apos;historique ci-dessous.
          </p>
        )}

        {report && reportTitle && (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <pre className="text-xs whitespace-pre-wrap max-h-64 overflow-y-auto font-mono leading-relaxed">
              {report}
            </pre>
            <AiReportDiffusion title={reportTitle} content={report} archiveId={archiveId} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
