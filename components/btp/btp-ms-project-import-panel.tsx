'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  importBtpSiteSchedule,
  previewBtpMsProjectXml,
  removeBtpSiteSchedule,
} from '@/lib/actions/btp-schedule';
import { CalendarRange, FileUp, Loader2, Trash2, X } from 'lucide-react';

interface ScheduleSummary {
  taskCount: number;
  projectTitle: string | null;
  importedAt: string;
}

interface PreviewData {
  projectTitle: string;
  taskCount: number;
  startDate: string | null;
  endDate: string | null;
  milestoneCount: number;
  topTasks: Array<{ name: string; startDate: string; finishDate: string; durationDays: number }>;
  warnings: string[];
}

interface Props {
  siteId: string;
  siteName: string;
  canManage: boolean;
  schedule?: ScheduleSummary | null;
}

export function BtpMsProjectImportPanel({ siteId, siteName, canManage, schedule }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  if (!canManage) {
    if (!schedule) return null;
    return (
      <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-700">
        Planning MS Project ({schedule.taskCount} tâches)
      </Badge>
    );
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setLoading(true);
    setPendingFile(file);
    const fd = new FormData();
    fd.set('file', file);
    const result = await previewBtpMsProjectXml(fd);
    setLoading(false);
    if ('error' in result) {
      setError(result.error ?? 'Prévisualisation impossible.');
      setPreview(null);
      return;
    }
    setPreview(result.preview);
    e.target.value = '';
  }

  async function handleImport() {
    if (!pendingFile) return;
    setError(null);
    setLoading(true);
    const fd = new FormData();
    fd.set('site_id', siteId);
    fd.set('file', pendingFile);
    const result = await importBtpSiteSchedule(fd);
    setLoading(false);
    if ('error' in result) {
      setError(result.error ?? 'Import impossible.');
      return;
    }
    setPreview(null);
    setPendingFile(null);
    setOpen(false);
    router.refresh();
  }

  async function handleRemove() {
    if (!confirm('Supprimer le planning importé ? Les jalons manuels restent actifs en secours.')) return;
    setLoading(true);
    const result = await removeBtpSiteSchedule(siteId);
    setLoading(false);
    if ('error' in result) {
      setError(result.error ?? 'Suppression impossible.');
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setOpen(true)}>
        <CalendarRange className="h-3.5 w-3.5" />
        {schedule ? 'Planning importé' : 'Importer planning'}
      </Button>
    );
  }

  return (
    <Card className="mt-2 border-blue-200/60">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm">Planning MS Project — {siteName}</CardTitle>
            <CardDescription className="text-xs mt-1">
              Export MS Project : Fichier → Exporter → XML. Optionnel — prioritaire sur les jalons manuels.
            </CardDescription>
          </div>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {schedule && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
            <p className="font-medium">{schedule.projectTitle ?? 'Planning actif'}</p>
            <p className="text-muted-foreground text-xs">
              {schedule.taskCount} tâches · importé le{' '}
              {new Date(schedule.importedAt).toLocaleDateString('fr-FR')}
            </p>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <input
          ref={fileRef}
          type="file"
          accept=".xml,text/xml,application/xml"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full"
          disabled={loading}
          onClick={() => fileRef.current?.click()}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
          Choisir un fichier XML
        </Button>

        {preview && (
          <div className="rounded-lg border p-3 space-y-3">
            <div>
              <p className="font-semibold">{preview.projectTitle}</p>
              <p className="text-xs text-muted-foreground">
                {preview.taskCount} tâches · {preview.milestoneCount} jalons · {preview.startDate ?? '—'} →{' '}
                {preview.endDate ?? '—'}
              </p>
            </div>
            {preview.warnings.length > 0 && (
              <ul className="text-xs text-amber-700 list-disc pl-4">
                {preview.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
            <div className="max-h-32 overflow-y-auto space-y-1">
              {preview.topTasks.map((t) => (
                <div key={`${t.name}-${t.startDate}`} className="flex justify-between gap-2 text-xs">
                  <span className="truncate">{t.name}</span>
                  <span className="text-muted-foreground shrink-0">{t.durationDays}j</span>
                </div>
              ))}
            </div>
            <Button type="button" size="sm" className="w-full bg-[#2563EB]" disabled={loading} onClick={handleImport}>
              Confirmer l&apos;import
            </Button>
          </div>
        )}

        {schedule && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full text-destructive"
            disabled={loading}
            onClick={handleRemove}
          >
            <Trash2 className="h-4 w-4" /> Supprimer le planning importé
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
