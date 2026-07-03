'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function PmeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[PME] erreur de rendu:', error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 rounded-xl border border-dashed p-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
        <AlertTriangle className="h-7 w-7 text-amber-500" />
      </div>
      <div>
        <h2 className="text-lg font-semibold">Impossible d&apos;afficher cette section PME</h2>
        <p className="text-muted-foreground mt-1 max-w-md text-sm">
          Une erreur est survenue lors du chargement. Réessayez ; si le problème
          persiste, vérifiez que les migrations PME sont appliquées.
        </p>
        {error?.digest && (
          <p className="text-muted-foreground/70 mt-2 text-[11px]">
            Référence : {error.digest}
          </p>
        )}
      </div>
      <Button onClick={reset} variant="outline">
        <RotateCcw className="h-4 w-4" /> Réessayer
      </Button>
    </div>
  );
}
