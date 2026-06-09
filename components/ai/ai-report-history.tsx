'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  deleteAiGeneratedReport,
  getAiGeneratedReport,
  type AiGeneratedReportRow,
} from '@/lib/actions/ai-report-archive';
import { AiReportDiffusion } from '@/components/ai/ai-report-diffusion';
import { Archive, Eye, Loader2, Trash2 } from 'lucide-react';

interface Props {
  history: AiGeneratedReportRow[];
  sectorLabel: string;
}

export function AiReportHistory({ history: initialHistory, sectorLabel }: Props) {
  const router = useRouter();
  const [history, setHistory] = useState(initialHistory);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<{
    id: string;
    title: string;
    content: string;
    engine: 'local' | 'openai';
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleView(id: string) {
    setLoadingId(id);
    setError(null);
    const result = await getAiGeneratedReport(id);
    setLoadingId(null);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setViewing({
      id: result.id,
      title: result.title,
      content: result.content,
      engine: result.engine,
    });
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce rapport de l\'historique ?')) return;
    const result = await deleteAiGeneratedReport(id);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setHistory((prev) => prev.filter((r) => r.id !== id));
    if (viewing?.id === id) setViewing(null);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Archive className="h-5 w-5 text-muted-foreground" />
          Historique des rapports — {sectorLabel}
        </CardTitle>
        <CardDescription>
          Chaque génération est enregistrée automatiquement. Diffusez via copie, fichier texte ou
          impression (PDF via le navigateur). Fonctionne sans clé OpenAI.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
        )}

        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
            Aucun rapport archivé. Générez un rapport ci-dessus pour le retrouver ici.
          </p>
        ) : (
          <ul className="space-y-2">
            {history.map((row) => (
              <li
                key={row.id}
                className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border p-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{row.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.scopeLabel} · {row.reportTypeLabel} ·{' '}
                    {new Date(row.createdAt).toLocaleString('fr-FR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-[10px]">
                    {row.engine === 'openai' ? 'OpenAI' : 'Local'}
                  </Badge>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loadingId === row.id}
                    onClick={() => handleView(row.id)}
                  >
                    {loadingId === row.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                    Lire
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => handleDelete(row.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {viewing && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-sm">{viewing.title}</p>
              <Badge variant="outline" className="text-[10px]">
                {viewing.engine === 'openai' ? 'OpenAI' : 'Mode local'}
              </Badge>
            </div>
            <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans max-h-[400px] overflow-y-auto bg-background rounded-md p-3 border">
              {viewing.content}
            </pre>
            <AiReportDiffusion
              title={viewing.title}
              content={viewing.content}
              archiveId={viewing.id}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
