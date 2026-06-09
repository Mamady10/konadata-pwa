'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import type { DocumentAiAdaptation } from '@/lib/ai/template-adaptation-types';

interface Props {
  adaptation: DocumentAiAdaptation;
  /** Afficher le bloc déjà ouvert (ex. juste après upload). */
  defaultOpen?: boolean;
  compact?: boolean;
}

export function DocumentAiGuidance({ adaptation, defaultOpen = false, compact }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  const appliedLabel = adaptation.appliedAt
    ? new Date(adaptation.appliedAt).toLocaleString('fr-FR', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : null;

  return (
    <div
      className={
        compact
          ? 'mt-2 rounded-md border border-primary/15 bg-primary/5'
          : 'mt-3 rounded-lg border border-primary/20 bg-primary/5'
      }
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full justify-between h-auto py-2 px-3 text-left font-normal hover:bg-primary/10"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <span>
            Consignes IA
            <span className="text-muted-foreground font-normal">
              {' '}
              — modèle « {adaptation.templateFileName} »
            </span>
          </span>
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </Button>
      {open && (
        <div className="px-3 pb-3 pt-0">
          {appliedLabel && (
            <p className="text-xs text-muted-foreground mb-2">Appliqué le {appliedLabel}</p>
          )}
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{adaptation.guidance}</p>
        </div>
      )}
    </div>
  );
}
