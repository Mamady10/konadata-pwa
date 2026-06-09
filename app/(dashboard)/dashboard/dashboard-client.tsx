'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

type GlobalDashboardVariant = 'platform-unavailable' | 'unconfigured';

interface Props {
  variant: GlobalDashboardVariant;
}

export function GlobalDashboardClient({ variant }: Props) {
  const isPlatform = variant === 'platform-unavailable';

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-2xl font-bold tracking-tight">
          {isPlatform ? 'Tableau de bord — Plateforme' : 'Accueil'}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isPlatform
            ? 'Les statistiques multi-organisations ne sont pas disponibles pour le moment.'
            : 'Votre espace de travail n\'est pas encore configuré.'}
        </p>
      </motion.div>

      <div className="rounded-xl border border-dashed p-12 text-center max-w-lg">
        <h2 className="text-lg font-semibold">
          {isPlatform ? 'Données plateforme indisponibles' : 'Organisation requise'}
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          {isPlatform
            ? 'Vérifiez la connexion Supabase et les droits du compte administrateur plateforme. Aucune donnée fictive n\'est affichée.'
            : 'Rejoignez une organisation avec votre code d\'accès pour accéder au tableau de bord de votre secteur.'}
        </p>
        {!isPlatform && (
          <Link
            href="/rejoindre"
            className="inline-block mt-6 text-primary font-medium underline underline-offset-4"
          >
            Rejoindre une organisation
          </Link>
        )}
      </div>
    </div>
  );
}
