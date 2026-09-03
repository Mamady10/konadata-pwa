'use client';

import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface Props {
  trialEndsAt?: string | null;
  mode?: 'trial_30d' | 'launch_free';
}

export function TrialWatermarkBanner({ trialEndsAt, mode = 'trial_30d' }: Props) {
  const endLabel = trialEndsAt
    ? new Date(trialEndsAt).toLocaleDateString('fr-FR')
    : mode === 'launch_free'
      ? 'la fin de l’offre'
      : '30 jours';

  if (mode === 'launch_free') {
    return (
      <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-600 hover:bg-emerald-600">Offre de lancement</Badge>
          <span>
            Accès gratuit actif jusqu&apos;au <strong>{endLabel}</strong>. Offre unique — après
            cette date, un abonnement payant sera requis.
          </span>
        </div>
        <Link href="/parametres/facturation" className="text-primary font-medium underline">
          Voir la facturation
        </Link>
      </div>
    );
  }

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
        Activer l&apos;abonnement mensuel
      </Link>
    </div>
  );
}
