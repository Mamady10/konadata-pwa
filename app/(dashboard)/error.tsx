'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[dashboard] erreur de rendu:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
        <AlertTriangle className="h-7 w-7 text-amber-500" />
      </div>
      <div>
        <h2 className="text-lg font-semibold">Impossible d&apos;afficher cette page</h2>
        <p className="text-muted-foreground mt-1 max-w-md text-sm">
          Une erreur est survenue lors du chargement. Réessayez ; si le problème
          persiste, reconnectez-vous ou contactez le support.
        </p>
        {error?.digest && (
          <p className="text-muted-foreground/70 mt-2 text-[11px]">
            Référence : {error.digest}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button onClick={reset} variant="outline">
          <RotateCcw className="h-4 w-4" /> Réessayer
        </Button>
        <Button onClick={() => (window.location.href = '/login?switch=1')}>
          Se reconnecter
        </Button>
      </div>
    </div>
  );
}
