'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  downloadCaptureStandardTemplate,
} from '@/lib/actions/capture-standard-templates';
import type { CaptureStandardTemplate } from '@/lib/documents/capture-standard-templates';
import { Download, FileSpreadsheet, FileText, PenLine } from 'lucide-react';

interface Props {
  templates: CaptureStandardTemplate[];
}

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

export function CaptureStandardTemplatesPanel({ templates }: Props) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!templates.length) return null;

  async function handleDownload(templateId: string, format: 'pdf' | 'csv') {
    setError(null);
    setLoadingId(`${templateId}-${format}`);
    const res = await downloadCaptureStandardTemplate(templateId, format);
    setLoadingId(null);
    if ('error' in res) {
      setError(res.error);
      return;
    }
    triggerDownload(res.base64, res.fileName, res.mimeType);
  }

  return (
    <Card className="border-emerald-500/40 bg-emerald-500/5">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <PenLine className="h-4 w-4 text-emerald-700" />
          Modèles de collecte KonaData (manuscrit)
        </CardTitle>
        <CardDescription>
          Formulaires vierges à imprimer ou ouvrir dans Excel — cases larges et colonnes fixes pour
          une meilleure lecture par KonaAI Vision après photo ou scan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="grid gap-3">
          {templates.map((t) => (
            <div
              key={t.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-emerald-600/20 bg-background p-4"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{t.label}</p>
                  <Badge variant="secondary" className="text-xs gap-1">
                    <PenLine className="h-3 w-3" />
                    Optimisé manuscrit
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{t.description}</p>
                <p className="text-xs text-muted-foreground mt-1">{t.hint}</p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                {t.formats.includes('pdf') && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loadingId === `${t.id}-pdf`}
                    onClick={() => handleDownload(t.id, 'pdf')}
                  >
                    <FileText className="h-4 w-4" />
                    {loadingId === `${t.id}-pdf` ? '…' : 'PDF'}
                  </Button>
                )}
                {t.formats.includes('csv') && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loadingId === `${t.id}-csv`}
                    onClick={() => handleDownload(t.id, 'csv')}
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    {loadingId === `${t.id}-csv` ? '…' : 'Excel/CSV'}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground flex items-start gap-2">
          <Download className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          Après remplissage manuel, téléversez la photo ou le scan en choisissant le même type de
          document (libellé KonaData) — vous pouvez aussi joindre un modèle IA complété en référence.
        </p>
      </CardContent>
    </Card>
  );
}
