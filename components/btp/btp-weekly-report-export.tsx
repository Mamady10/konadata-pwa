'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check, FileText, Presentation } from 'lucide-react';
import type { WeeklyReportExportPayload } from '@/lib/btp/weekly-report-export-types';
import { downloadWeeklyReportPdf } from '@/lib/btp/export-weekly-report-pdf';
import { exportWeeklyReportPptxAction } from '@/lib/actions/btp-weekly-report-export';

function triggerDownload(base64: string, fileName: string, mimeType: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

interface Props {
  payload: WeeklyReportExportPayload;
  textFallback: string;
  archiveId?: string | null;
}

export function BtpWeeklyReportExport({ payload, textFallback, archiveId }: Props) {
  const [copied, setCopied] = useState(false);
  const [pptxLoading, setPptxLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(textFallback);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = textFallback;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handlePdf() {
    setExportError(null);
    try {
      downloadWeeklyReportPdf(payload);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export PDF impossible.');
    }
  }

  async function handlePptx() {
    setExportError(null);
    setPptxLoading(true);
    try {
      const result = await exportWeeklyReportPptxAction(payload);
      if ('error' in result) {
        setExportError(result.error);
        return;
      }
      triggerDownload(
        result.base64,
        result.fileName,
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      );
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export PowerPoint impossible.');
    } finally {
      setPptxLoading(false);
    }
  }

  return (
    <div className="space-y-2 pt-2 border-t">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copié' : 'Copier'}
        </Button>
        <Button
          type="button"
          variant="default"
          size="sm"
          className="bg-[#2563EB] hover:bg-[#2563EB]/90"
          onClick={handlePdf}
        >
          <FileText className="h-4 w-4" />
          Télécharger PDF
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-violet-200 text-violet-900 hover:bg-violet-500/10"
          onClick={handlePptx}
          disabled={pptxLoading}
        >
          <Presentation className="h-4 w-4" />
          {pptxLoading ? 'Export…' : 'Télécharger PPTX'}
        </Button>
      </div>
      {exportError && (
        <p className="text-xs text-destructive">{exportError}</p>
      )}
      {archiveId && (
        <p className="text-xs text-muted-foreground">
          Archivé — réf. {archiveId.slice(0, 8)}…
        </p>
      )}
    </div>
  );
}
