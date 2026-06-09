'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { getOrganizationDocumentUrl } from '@/lib/actions/storage';
import { Download, ExternalLink, Loader2 } from 'lucide-react';

interface Props {
  documentId: string;
  fileName: string;
  size?: 'sm' | 'default';
}

export function DocumentFileActions({ documentId, fileName, size = 'sm' }: Props) {
  const [loading, setLoading] = useState<'open' | 'download' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolveUrl() {
    const res = await getOrganizationDocumentUrl(documentId);
    if ('error' in res) {
      setError(res.error);
      return null;
    }
    setError(null);
    return res;
  }

  async function handleOpen() {
    setLoading('open');
    try {
      const res = await resolveUrl();
      if (res) window.open(res.url, '_blank', 'noopener,noreferrer');
    } finally {
      setLoading(null);
    }
  }

  async function handleDownload() {
    setLoading('download');
    try {
      const res = await resolveUrl();
      if (!res) return;
      const response = await fetch(res.url);
      if (!response.ok) {
        setError('Téléchargement impossible.');
        return;
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = res.fileName || fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex flex-wrap items-center gap-1">
        <Button
          type="button"
          size={size}
          variant="outline"
          className="h-7 text-xs"
          disabled={loading !== null}
          onClick={() => void handleOpen()}
        >
          {loading === 'open' ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <ExternalLink className="h-3 w-3" />
          )}
          Ouvrir
        </Button>
        <Button
          type="button"
          size={size}
          variant="outline"
          className="h-7 text-xs"
          disabled={loading !== null}
          onClick={() => void handleDownload()}
        >
          {loading === 'download' ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Download className="h-3 w-3" />
          )}
          Télécharger
        </Button>
      </div>
      {error && <p className="text-[10px] text-destructive max-w-[200px]">{error}</p>}
    </div>
  );
}
