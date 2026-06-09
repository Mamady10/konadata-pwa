'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AiReportDiffusion } from '@/components/ai/ai-report-diffusion';
import { Sparkles, FileText, Loader2, CheckCircle2 } from 'lucide-react';
import { SCOPE_ALL } from '@/lib/ai/sector-report-types';

export interface ScopeOption {
  id: string;
  label: string;
}

export interface ReportTypeOption {
  id: string;
  label: string;
  hint?: string;
}

interface Props {
  sectorLabel: string;
  scopeLabel: string;
  scopeOptions: ScopeOption[];
  reportTypes: ReportTypeOption[];
  onGenerate: (scopeId: string, reportType: string) => Promise<{
    error?: string;
    report?: string;
    usedLlm?: boolean;
    title?: string;
    archiveId?: string;
    archived?: boolean;
  }>;
  modelsHref?: string;
}

export function SectorAiReportPanel({
  sectorLabel,
  scopeLabel,
  scopeOptions,
  reportTypes,
  onGenerate,
  modelsHref = '/parametres/modeles',
}: Props) {
  const router = useRouter();
  const [scopeId, setScopeId] = useState('');
  const [reportType, setReportType] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [reportTitle, setReportTitle] = useState<string | null>(null);
  const [usedLlm, setUsedLlm] = useState(false);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [archivedOk, setArchivedOk] = useState(false);

  const typeDef = reportTypes.find((t) => t.id === reportType);

  async function handleGenerate() {
    if (!scopeId || !reportType) {
      setError(`Choisissez ${scopeLabel.toLowerCase()} et le type de rapport.`);
      return;
    }
    setLoading(true);
    setError(null);
    setReport(null);
    setArchiveId(null);
    setArchivedOk(false);
    const result = await onGenerate(scopeId, reportType);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setReport(result.report ?? null);
    setReportTitle(result.title ?? null);
    setUsedLlm(Boolean(result.usedLlm));
    setArchiveId(result.archiveId ?? null);
    setArchivedOk(Boolean(result.archived && result.archiveId));
    if (result.archiveId) router.refresh();
  }

  const scopeChoices: ScopeOption[] = [
    { id: SCOPE_ALL, label: `Tous — ${scopeLabel.toLowerCase()}` },
    ...scopeOptions,
  ];

  return (
    <Card className="border-primary/25 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          Rapport IA — {sectorLabel}
        </CardTitle>
        <CardDescription>
          Synthèse à partir des données Supabase, archivée automatiquement. Diffusion : copie, fichier
          .txt ou impression PDF (navigateur).{' '}
          <a href={modelsHref} className="text-primary underline">
            Modèles IA
          </a>{' '}
          pour les documents déposés. Aucune clé OpenAI requise (mode local).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{scopeLabel} *</Label>
            <Select value={scopeId} onValueChange={setScopeId}>
              <SelectTrigger>
                <SelectValue placeholder={`Choisir ${scopeLabel.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {scopeChoices.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Type de rapport *</Label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger>
                <SelectValue placeholder="Type de synthèse" />
              </SelectTrigger>
              <SelectContent>
                {reportTypes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {typeDef?.hint && (
              <p className="text-xs text-muted-foreground">{typeDef.hint}</p>
            )}
          </div>
        </div>

        <Button
          type="button"
          className="bg-[#2563EB]"
          disabled={loading || !scopeId || !reportType}
          onClick={handleGenerate}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          {loading ? 'Génération…' : 'Générer et archiver'}
        </Button>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
        )}

        {archivedOk && (
          <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            Rapport enregistré dans l&apos;historique ci-dessous. Utilisez Copier, Télécharger ou
            Imprimer pour le diffuser.
          </p>
        )}

        {report && reportTitle && (
          <div className="rounded-lg border bg-background p-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-sm">{reportTitle}</p>
              <span className="text-[10px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                {usedLlm ? 'OpenAI' : 'Mode local'}
              </span>
            </div>
            <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans max-h-[480px] overflow-y-auto">
              {report}
            </pre>
            <AiReportDiffusion title={reportTitle} content={report} archiveId={archiveId} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
