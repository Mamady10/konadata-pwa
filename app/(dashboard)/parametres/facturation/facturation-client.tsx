'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  recordSubscriptionRenewal,
  updateSchoolDefaultTuitionFee,
  claimLaunchFreeOffer,
} from '@/lib/actions/billing';
import type { OrganizationBillingStatus } from '@/lib/billing/types';
import {
  canOrganizationDirectorPay,
  isOfferAwaitingCeoValidation,
} from '@/lib/billing/offer-payment';
import { formatCurrency } from '@/lib/utils';
import {
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  GraduationCap,
  Building2,
  ArrowLeft,
  Gift,
} from 'lucide-react';

const RENEWAL_MONTH_OPTIONS = [1, 3, 6, 12] as const;

function statusBadge(status: string, accessAllowed: boolean) {
  if (!accessAllowed) {
    return <Badge variant="destructive">Accès suspendu</Badge>;
  }
  const map: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    active: 'default',
    trialing: 'secondary',
    paid: 'default',
    open: 'secondary',
    overdue: 'destructive',
    expired: 'destructive',
    past_due: 'destructive',
  };
  const labels: Record<string, string> = {
    active: 'Actif',
    trialing: 'Essai',
    paid: 'Payé',
    open: 'À payer',
    overdue: 'En retard',
    expired: 'Expiré',
    past_due: 'Impayé',
  };
  return (
    <Badge variant={map[status] ?? 'outline'}>{labels[status] ?? status}</Badge>
  );
}

interface Props {
  status: OrganizationBillingStatus;
  blocked?: boolean;
  orgName: string;
}

export function FacturationClient({ status, blocked, orgName }: Props) {
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [defaultFee, setDefaultFee] = useState(
    String(status.default_tuition_fee_gnf ?? 1_500_000)
  );
  const [paymentRef, setPaymentRef] = useState('');
  const [customMonths, setCustomMonths] = useState('');

  const isSchool =
    status.model === 'monthly_school_subscription' ||
    status.model === 'annual_school_subscription' ||
    status.model === 'per_enrolled_student' ||
    status.billing_period === 'annual';
  const invoice = status.current_invoice;
  const offerStatus = status.offer?.status;
  const offerAccessMode = status.offer?.access_mode;
  const isTrialOffer = offerAccessMode === 'trial_30d';
  const isLaunchOfferActive = offerAccessMode === 'launch_free';
  const launch = status.launch_offer;
  const canClaimLaunchOffer =
    Boolean(launch?.eligible) && status.billing_status === 'pending_payment';
  const hasPaymentLink = Boolean(status.offer?.payment_token);
  const activationMonths = status.offer?.activation_months ?? 1;
  const monthlyPrice =
    status.monthly_price_gnf ??
    status.subscription?.monthly_price_gnf ??
    0;
  const canPayNow =
    hasPaymentLink &&
    canOrganizationDirectorPay(offerStatus) &&
    Number(status.offer?.activation_amount_gnf ?? 0) > 0 &&
    (status.billing_status === 'pending_payment' ||
      status.billing_status === 'pending_renewal');
  const awaitingCeoPricing =
    (status.billing_status === 'pending_payment' ||
      status.billing_status === 'pending_renewal') &&
    isOfferAwaitingCeoValidation(offerStatus);
  const canRenewWhileActive =
    status.access_allowed &&
    status.billing_status === 'active' &&
    (isSchool ? monthlyPrice > 0 : Boolean(status.subscription));

  async function handleSchoolSettings(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const res = await updateSchoolDefaultTuitionFee(Number(defaultFee));
    setLoading(false);
    setMsg('error' in res && res.error ? res.error : 'Frais scolarité enregistrés (niveau 2 — élèves).');
  }

  async function handleRenewSubscription(months: number) {
    setLoading(true);
    const res = await recordSubscriptionRenewal(months, paymentRef || undefined);
    setLoading(false);
    if ('error' in res && res.error) setMsg(res.error);
    else {
      setMsg(`Abonnement prolongé de ${months} mois.`);
      window.location.reload();
    }
  }

  async function handleClaimLaunchOffer() {
    setLoading(true);
    setMsg(null);
    const res = await claimLaunchFreeOffer();
    setLoading(false);
    if ('error' in res && res.error) {
      setMsg(res.error);
      return;
    }
    const message =
      (res.data?.message as string | undefined) ??
      'Offre de lancement activée. Accès gratuit débloqué.';
    setMsg(message);
    window.location.reload();
  }

  function handleCustomRenewal() {
    const months = Number(customMonths);
    if (!Number.isInteger(months) || months < 1 || months > 36) {
      setMsg('Indiquez un nombre de mois entre 1 et 36.');
      return;
    }
    void handleRenewSubscription(months);
  }

  const schoolBillingLabel = (): string => {
    if (status.billing_status === 'pending_payment') {
      return awaitingCeoPricing
        ? 'Activation — validation KonaData'
        : 'Activation — paiement requis';
    }
    if (status.billing_status === 'pending_renewal') {
      return awaitingCeoPricing ? 'Renouvellement — validation KonaData' : 'Renouvellement — paiement requis';
    }
    if (status.access_allowed) return 'Actif';
    return 'Suspendu';
  };

  const renewalBlock = (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="sub_ref">Référence paiement</Label>
        <Input
          id="sub_ref"
          value={paymentRef}
          onChange={(e) => setPaymentRef(e.target.value)}
          placeholder="Optionnel"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {RENEWAL_MONTH_OPTIONS.map((months) => (
          <Button
            key={months}
            className={months === 1 ? 'bg-[#2563EB]' : undefined}
            variant={months === 1 ? 'default' : 'outline'}
            disabled={loading}
            onClick={() => handleRenewSubscription(months)}
          >
            {months} mois
            {monthlyPrice > 0 && (
              <span className="ml-1 opacity-80">
                ({formatCurrency(monthlyPrice * months)})
              </span>
            )}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-2">
          <Label htmlFor="custom_months">Autre durée (mois)</Label>
          <Input
            id="custom_months"
            type="number"
            min={1}
            max={36}
            value={customMonths}
            onChange={(e) => setCustomMonths(e.target.value)}
            placeholder="ex. 2"
            className="w-28"
          />
        </div>
        <Button variant="outline" disabled={loading} onClick={handleCustomRenewal}>
          Payer
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Vous pouvez régler plusieurs mois à l&apos;avance. Après la date de fin, l&apos;accès au
        module est bloqué jusqu&apos;au renouvellement.
      </p>
    </div>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/parametres">
            <ArrowLeft className="h-4 w-4" />
            Paramètres
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <CreditCard className="h-7 w-7 text-primary" />
          Facturation KonaData
        </h1>
        <p className="text-muted-foreground">{orgName}</p>
      </div>

      {blocked && !status.access_allowed && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 space-y-3">
          <p className="font-semibold flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {status.billing_status === 'suspended'
              ? 'Accès suspendu par KonaData'
              : 'Accès au module limité'}
          </p>
          <p className="text-sm text-muted-foreground">
            {status.billing_status === 'suspended' ? (
              <>
                Votre établissement a été temporairement bloqué par KonaData (litige ou décision
                administrative), indépendamment de la date de fin d&apos;abonnement affichée
                ci-dessous. Seule la section Paramètres reste accessible.
                {status.ceo_suspend_reason && (
                  <span className="block mt-2 font-medium text-destructive">
                    Motif : {status.ceo_suspend_reason}
                  </span>
                )}
              </>
            ) : isSchool ? (
              'Sans règlement, seule la section Paramètres reste accessible. Le reste de la plateforme est bloqué jusqu’au paiement.'
            ) : (
              'Sans règlement, seule la section Paramètres reste accessible. Le reste de la plateforme est bloqué jusqu’au renouvellement.'
            )}
          </p>
          {status.billing_status === 'suspended' && status.subscription_valid_until && (
            <p className="text-xs text-muted-foreground">
              Abonnement enregistré jusqu&apos;au{' '}
              {new Date(status.subscription_valid_until).toLocaleDateString('fr-FR')} (non utilisé
              pendant la suspension).
            </p>
          )}
        </div>
      )}

      {canClaimLaunchOffer && (
        <Card className="border-emerald-500/50 bg-emerald-500/5 shadow-sm">
          <CardContent className="pt-6 space-y-4">
            <p className="font-semibold text-lg flex items-center gap-2">
              <Gift className="h-5 w-5 text-emerald-600" />
              Offre de lancement KonaData
            </p>
            <p className="text-sm text-muted-foreground">
              Activez gratuitement votre organisation pendant{' '}
              <strong>
                {launch?.free_months ?? (isSchool ? 12 : 6)} mois
              </strong>
              {isSchool ? ' (établissements scolaires)' : ' (ONG, BTP, PME)'}.
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
              <li>Souscription possible une seule fois</li>
              <li>
                Fenêtre limitée : jusqu&apos;au{' '}
                <strong>
                  {launch?.claim_deadline
                    ? new Date(launch.claim_deadline).toLocaleDateString('fr-FR')
                    : '—'}
                </strong>{' '}
                (2 mois après inscription)
              </li>
              <li>
                Après la période gratuite, l&apos;accès continue uniquement avec un abonnement
                payant
              </li>
            </ul>
            <Button
              size="lg"
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={loading}
              onClick={() => void handleClaimLaunchOffer()}
            >
              {loading
                ? 'Activation…'
                : `Activer ${launch?.free_months ?? (isSchool ? 12 : 6)} mois gratuits`}
            </Button>
            <p className="text-xs text-muted-foreground">
              En activant, vous confirmez que cette offre ne pourra plus être demandée ensuite.
            </p>
          </CardContent>
        </Card>
      )}

      {launch && !launch.eligible && status.billing_status === 'pending_payment' && (
        <Card className="border-muted">
          <CardContent className="pt-6 space-y-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground flex items-center gap-2">
              <Gift className="h-4 w-4" />
              Offre de lancement
            </p>
            <p>
              {launch.already_claimed
                ? 'Cette organisation a déjà utilisé l’offre de lancement (une seule fois).'
                : launch.reason ??
                  'L’offre de lancement n’est plus disponible pour cette organisation.'}
            </p>
            {launch.claim_deadline && !launch.already_claimed && (
              <p className="text-xs">
                Date limite de souscription :{' '}
                {new Date(launch.claim_deadline).toLocaleDateString('fr-FR')}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {canPayNow && (
        <Card className="border-primary shadow-sm">
          <CardContent className="pt-6 space-y-4">
            <p className="font-semibold text-lg">
              {isSchool ? 'Activer votre établissement' : 'Activer votre organisation'}
            </p>
            <p className="text-sm text-muted-foreground">
              Montant validé par KonaData :{' '}
              <span className="font-bold text-foreground text-lg">
                {formatCurrency(status.offer?.activation_amount_gnf ?? 0)}
              </span>
              {activationMonths > 1 && (
                <span className="block text-xs mt-1">
                  Soit {activationMonths} mois d&apos;abonnement
                  {monthlyPrice > 0 && ` (${formatCurrency(monthlyPrice)} / mois)`}
                </span>
              )}
            </p>
            {status.offer?.ceo_notes && (
              <p className="text-sm border-l-2 border-primary pl-3">{status.offer.ceo_notes}</p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-[#2563EB]">
                <Link href={`/paiement-organisation/${status.offer!.payment_token}`}>
                  {status.billing_status === 'pending_renewal'
                    ? 'Payer pour réactiver l’accès'
                    : 'Payer et activer l’accès complet'}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {awaitingCeoPricing && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="pt-6 space-y-4">
            <p className="font-medium">En attente de validation KonaData</p>
            <p className="text-sm text-muted-foreground">
              KonaData analyse votre dossier et fixe le tarif mensuel. Le paiement reste impossible
              tant que le CEO n’a pas validé le montant sur son espace Organisations.
            </p>
            {isTrialOffer && (
              <p className="text-sm text-amber-800">
                Mode proposé : <strong>essai 30 jours</strong> — accès temporaire au module, puis
                abonnement mensuel KonaData.
              </p>
            )}
            {isTrialOffer && (
              <p className="text-sm">Tarif essai : accès 30 jours (montant mensuel fixé après l’essai).</p>
            )}
            <Button size="lg" className="w-full sm:w-auto" disabled>
              {isSchool ? 'Payer et activer l’établissement' : 'Payer et activer l’organisation'}
            </Button>
            <p className="text-xs text-muted-foreground">
              Ce bouton s’activera après validation du tarif par KonaData.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Statut</CardTitle>
            <CardDescription>Abonnement mensuel au module KonaData</CardDescription>
          </div>
          {statusBadge(
            isSchool ? schoolBillingLabel() : (status.subscription?.status ?? 'expired'),
            status.access_allowed
          )}
        </CardHeader>
        <CardContent>
          {status.access_allowed ? (
            <div className="space-y-1">
              <p className="text-sm text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                Accès plateforme actif
                {offerAccessMode === 'trial_30d' && (
                  <Badge variant="secondary" className="ml-2">
                    Essai 30 jours
                  </Badge>
                )}
                {isLaunchOfferActive && (
                  <Badge className="ml-2 bg-emerald-600 hover:bg-emerald-600">
                    Offre de lancement
                  </Badge>
                )}
              </p>
              {(status.subscription_valid_until ||
                status.launch_offer?.free_until ||
                status.subscription?.current_period_end) && (
                <p className="text-xs text-muted-foreground">
                  Valide jusqu&apos;au{' '}
                  {new Date(
                    status.subscription_valid_until ??
                      status.launch_offer?.free_until ??
                      status.subscription!.current_period_end
                  ).toLocaleDateString('fr-FR')}
                  {isLaunchOfferActive && ' (période gratuite)'}
                </p>
              )}
              {isLaunchOfferActive && (
                <p className="text-xs text-muted-foreground">
                  Après cette date, un abonnement payant sera obligatoire pour conserver l&apos;accès.
                </p>
              )}
              {monthlyPrice > 0 && (
                <p className="text-xs text-muted-foreground">
                  Tarif mensuel : {formatCurrency(monthlyPrice)}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-destructive">Accès plateforme bloqué jusqu’au règlement.</p>
          )}
        </CardContent>
      </Card>

      {isSchool ? (
        <>
          {canRenewWhileActive && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" />
                  Abonnement plateforme
                </CardTitle>
                <CardDescription>
                  {formatCurrency(monthlyPrice)} / mois — payez un ou plusieurs mois à l&apos;avance
                </CardDescription>
              </CardHeader>
              <CardContent>{renewalBlock}</CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                Scolarité élèves (niveau 2 — paiements vers l&apos;établissement)
              </CardTitle>
              <CardDescription>
                Frais que les familles paient à <strong>votre établissement</strong> (indépendant de KonaData).
                Défaut ci-dessous ; par classe dans{' '}
                <Link href="/etablissement/formations" className="text-primary underline">
                  Formations
                </Link>
                . Liens de paiement :{' '}
                <Link href="/parametres/paiements-eleves" className="text-primary underline">
                  Paiements élèves
                </Link>
                .
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Configuration complète :{' '}
                <Link href="/parametres/annee-scolaire" className="text-primary underline">
                  Année scolaire & tarifs
                </Link>
                {' · '}
                <Link href="/parametres/paiements-eleves" className="text-primary underline">
                  Paiements élèves
                </Link>
              </p>
              <form onSubmit={handleSchoolSettings} className="flex flex-wrap items-end gap-3">
                <div className="space-y-2 flex-1 min-w-[200px]">
                  <Label htmlFor="default_fee">Frais par défaut org (GNF / élève / an)</Label>
                  <Input
                    id="default_fee"
                    type="number"
                    min={0}
                    value={defaultFee}
                    onChange={(e) => setDefaultFee(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={loading} className="bg-[#2563EB]">
                  Enregistrer
                </Button>
              </form>
            </CardContent>
          </Card>

          {invoice?.status === 'paid' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dernier paiement plateforme</CardTitle>
                <CardDescription>
                  Payé le{' '}
                  {invoice.paid_at
                    ? new Date(invoice.paid_at).toLocaleDateString('fr-FR')
                    : '—'}{' '}
                  — {formatCurrency(invoice.amount_gnf)}
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </>
      ) : (
        status.subscription && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                {status.subscription.plan_name}
              </CardTitle>
              <CardDescription>
                Abonnement mensuel — {formatCurrency(status.subscription.monthly_price_gnf)} / mois
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-muted-foreground">Fin de période</dt>
                <dd>
                  {new Date(status.subscription.current_period_end).toLocaleDateString('fr-FR', {
                    dateStyle: 'long',
                  })}
                </dd>
                {status.subscription.trial_ends_at && (
                  <>
                    <dt className="text-muted-foreground">Fin essai</dt>
                    <dd>
                      {new Date(status.subscription.trial_ends_at).toLocaleDateString('fr-FR')}
                    </dd>
                  </>
                )}
              </dl>
              {canRenewWhileActive && renewalBlock}
            </CardContent>
          </Card>
        )
      )}

      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
    </div>
  );
}
