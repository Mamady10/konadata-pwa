'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, ListChecks } from 'lucide-react';
import type { SchoolOnboardingStatus } from '@/lib/actions/school-onboarding';
import { canOrganizationDirectorPay } from '@/lib/billing/offer-payment';

const ACTOR_LABELS = {
  ceo: 'CEO KonaData',
  director: 'Directeur',
  team: 'Scolarité',
};

/** Liens utiles même quand le tenant est bloqué (paiement / facturation). */
function showStepLink(
  step: { id: string; done: boolean; href: string },
  accessAllowed: boolean,
  offerStatus: string | null
): boolean {
  if (step.done) return false;
  if (accessAllowed) return true;
  if (step.id === 'ceo_offer') return true;
  if (step.id === 'director_pay') {
    return canOrganizationDirectorPay(offerStatus) || step.href.startsWith('/parametres');
  }
  if (
    step.href.startsWith('/parametres') ||
    step.href.startsWith('/paiement-scolarite')
  ) {
    return true;
  }
  return false;
}

interface Props {
  onboarding: SchoolOnboardingStatus;
  compact?: boolean;
}

export function SchoolOnboardingChecklist({ onboarding, compact }: Props) {
  const pct = Math.round((onboarding.completedCount / onboarding.totalCount) * 100);

  return (
    <Card className="border-primary/25 bg-primary/[0.02]">
      <CardHeader className={compact ? 'pb-2' : undefined}>
        <CardTitle className="text-base flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-primary" />
          Mise en route établissement
        </CardTitle>
        <CardDescription>
          {onboarding.completedCount} / {onboarding.totalCount} étapes — {pct}%
          {!onboarding.accessAllowed &&
            ' · Modules métier bloqués tant que l’abonnement n’est pas réglé (Paramètres seul)'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-[#2563EB] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <ul className="space-y-2">
          {onboarding.steps.map((step) => (
            <li
              key={step.id}
              className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${
                step.done ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border'
              }`}
            >
              {step.done ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{step.title}</span>
                  <Badge variant="outline" className="text-xs">
                    {ACTOR_LABELS[step.actor]}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-xs">{step.description}</p>
                {showStepLink(step, onboarding.accessAllowed, onboarding.offerStatus) && (
                  <Button variant="link" className="h-auto p-0 text-[#2563EB]" asChild>
                    <Link href={step.href}>
                      {step.id === 'director_pay' && step.href.includes('paiement-organisation')
                        ? 'Payer / ouvrir le lien →'
                        : step.id === 'director_pay'
                          ? 'Voir facturation (en attente CEO) →'
                          : step.id === 'fees_year'
                            ? 'Configurer tarifs & année →'
                            : step.id === 'payments_online'
                              ? 'Activer paiements familles →'
                              : 'Ouvrir →'}
                    </Link>
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground pt-2 border-t">
          Scolarité :{' '}
          <Link href="/parametres/annee-scolaire" className="text-primary underline">
            Année scolaire & tarifs
          </Link>
          {' · '}
          <Link href="/parametres/paiements-eleves" className="text-primary underline">
            Paiements élèves
          </Link>
          {' · '}
          <Link href="/etablissement/paiements" className="text-primary underline">
            Journal encaissements
          </Link>
          . Abonnement KonaData (plateforme) :{' '}
          <Link href="/parametres/facturation" className="text-primary underline">
            Facturation
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}
