'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Copy, Download, Printer } from 'lucide-react';

interface Props {
  title: string;
  content: string;
  archiveId?: string | null;
}

function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'rapport';
}

export function AiReportDiffusion({ title, content, archiveId }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* fallback */
      const ta = document.createElement('textarea');
      ta.value = content;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleDownload() {
    const date = new Date().toISOString().slice(0, 10);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slugify(title)}-${date}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handlePrint() {
    const w = window.open('', '_blank', 'noopener,noreferrer');
    if (!w) return;
    const safeTitle = title.replace(/</g, '&lt;');
    const body = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${safeTitle}</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 2cm; line-height: 1.5; color: #111; }
        h1 { font-size: 1.25rem; margin-bottom: 0.5rem; }
        .meta { font-size: 0.85rem; color: #555; margin-bottom: 1.5rem; }
        .content { font-size: 0.95rem; white-space: pre-wrap; }
      </style></head><body>
      <h1>${safeTitle}</h1>
      <p class="meta">KonaData — ${new Date().toLocaleString('fr-FR')}${archiveId ? ` — Réf. ${archiveId.slice(0, 8)}` : ''}</p>
      <div class="content">${body}</div>
      <script>window.onload = function() { window.print(); };</script>
      </body></html>`);
    w.document.close();
  }

  return (
    <div className="flex flex-wrap gap-2 pt-2 border-t">
      <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
        {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
        {copied ? 'Copié' : 'Copier'}
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={handleDownload}>
        <Download className="h-4 w-4" />
        Télécharger (.txt)
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={handlePrint}>
        <Printer className="h-4 w-4" />
        Imprimer / PDF
      </Button>
      {archiveId && (
        <span className="text-xs text-muted-foreground self-center ml-auto">
          Archivé — réf. {archiveId.slice(0, 8)}…
        </span>
      )}
    </div>
  );
}
