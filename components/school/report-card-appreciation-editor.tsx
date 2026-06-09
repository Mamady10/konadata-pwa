'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { updateReportCardAppreciation } from '@/lib/actions/report-cards';
import { suggestCouncilAppreciation } from '@/lib/school/council-appreciation';
import { Pencil } from 'lucide-react';

interface Props {
  cardId: string;
  average: number | null;
  initialAppreciation: string | null;
  locked: boolean;
  onSaved?: () => void;
}

export function ReportCardAppreciationEditor({
  cardId,
  average,
  initialAppreciation,
  locked,
  onSaved,
}: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(initialAppreciation ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (locked) {
    return (
      <span className="text-xs text-muted-foreground line-clamp-2 max-w-[200px]">
        {initialAppreciation?.trim() || '—'}
      </span>
    );
  }

  if (!open) {
    return (
      <div className="flex items-start gap-1 max-w-[220px]">
        <span className="text-xs line-clamp-2 flex-1">
          {initialAppreciation?.trim() || (
            <span className="text-muted-foreground italic">À rédiger</span>
          )}
        </span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 shrink-0"
          onClick={() => {
            setText(initialAppreciation ?? suggestCouncilAppreciation(average));
            setOpen(true);
          }}
        >
          <Pencil className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  async function handleSave() {
    setLoading(true);
    setError(null);
    const res = await updateReportCardAppreciation(cardId, text);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setOpen(false);
    onSaved?.();
  }

  return (
    <div className="space-y-1 min-w-[200px]">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="flex w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        placeholder="Appréciation du conseil de classe"
      />
      <div className="flex gap-1">
        <Button size="sm" className="h-7 text-xs" onClick={() => void handleSave()} disabled={loading}>
          {loading ? '…' : 'Enregistrer'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={() => setText(suggestCouncilAppreciation(average))}
        >
          Auto
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOpen(false)}>
          Annuler
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
