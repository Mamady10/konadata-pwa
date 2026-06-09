'use client';

import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface Props {
  trialEndsAt?: string | null;
}

export function TrialWatermarkBanner({ trialEndsAt }: Props) {
  const endLabel = trialEndsAt
    ? new Date(trialEndsAt).toLocaleDateString('fr-FR')
    : '30 jours';

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
      <div className="flex items-center gap-2">
        <Badge variant="warning">Essai KonaData</Badge>
        <span>
          Mode pilote actif — accès complet avec filigrane essai jusqu&apos;au{' '}
          <strong>{endLabel}</strong>.
        </span>
      </div>
      <Link href="/parametres/facturation" className="text-primary font-medium underline">
        Activer l&apos;abonnement annuel
      </Link>
    </div>
  );
}
