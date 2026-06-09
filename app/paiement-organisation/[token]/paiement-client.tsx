'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { recordOfferActivationPayment } from '@/lib/actions/billing';
import { formatCurrency } from '@/lib/utils';
import { ORG_TYPE_LABELS, type OrganizationType } from '@/types/database';
import { CreditCard, CheckCircle2, Clock } from 'lucide-react';
import { sectorHomeFromOrgType } from '@/lib/sector/post-login';

interface Props {
  token: string;
  offer: Record<string, unknown>;
  orgId: string;
  isOrgAdmin: boolean;
  isPlatformAdmin: boolean;
}

export function PaiementOrganisationClient({
  offer,
  orgId,
  isOrgAdmin,
  isPlatformAdmin,
}: Props) {
  const [ref, setRef] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const orgType = offer.organization_type as OrganizationType;
  const isSchool = orgType === 'school';
  const isAnnual = offer.billing_period === 'annual' || isSchool;
  const offerStatus = offer.offer_status as string;
  const activation = Number(offer.activation_amount_gnf ?? 0);
  const showPricingBreakdown = isPlatformAdmin;
  const canPay =
    offerStatus !== 'paid' &&
    (isPlatformAdmin || (isOrgAdmin && offerStatus === 'awaiting_payment'));

  async function confirmPayment() {
    if (!orgId) return;
    setLoading(true);
    setMsg(null);
    const res = await recordOfferActivationPayment(orgId, ref || undefined);
    setLoading(false);
    if ('error' in res && res.error) {
      setMsg(res.error);
      return;
    }
    setDone(true);
    setMsg('Paiement enregistré. Votre organisation est activée.');
  }

  if (done || offerStatus === 'paid') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#F8FAFC]">
        <Card className="max-w-lg w-full">
          <CardContent className="pt-8 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <h1 className="text-xl font-bold">Organisation activée</h1>
            <p className="text-muted-foreground">Vous pouvez accéder à votre espace KonaData.</p>
            <Button asChild className="bg-[#2563EB]">
              <Link href={sectorHomeFromOrgType(orgType)}>Ouvrir mon espace</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#F8FAFC]">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Activation KonaData
            </CardTitle>
            <Badge variant="secondary">
              {offerStatus === 'draft' ? (
                <>
                  <Clock className="h-3 w-3 mr-1" />
                  En attente de tarif CEO
                </>
              ) : (
                'À payer'
              )}
            </Badge>
          </div>
          <CardDescription>
            {String(offer.organization_name)} — {ORG_TYPE_LABELS[orgType] ?? orgType}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {offerStatus === 'draft' && (
            <p className="text-sm text-muted-foreground rounded-lg bg-muted p-3">
              KonaData valide votre demande et fixe le montant d&apos;activation. Rechargez cette page
              une fois la tarification envoyée (statut « À payer »).
            </p>
          )}

          <div className="rounded-lg border p-4 space-y-2">
            <p className="text-sm font-medium text-primary">
              {isSchool
                ? 'Abonnement annuel à régler avant l’ouverture de l’accès (début de période)'
                : 'Paiement obligatoire avant activation'}
            </p>
            {offerStatus === 'awaiting_payment' && activation > 0 && (
              <div className="flex justify-between text-sm">
                <span>Montant validé à payer</span>
                <span className="font-bold">{formatCurrency(activation)}</span>
              </div>
            )}
            {offerStatus === 'draft' && (
              <p className="text-sm text-muted-foreground">
                Le montant vous sera communiqué après validation par KonaData.
              </p>
            )}
            {showPricingBreakdown && isSchool && (
              <>
                {Number(offer.annual_base_gnf ?? offer.monthly_base_gnf ?? 0) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Détail indicatif : forfait{' '}
                    {formatCurrency(Number(offer.annual_base_gnf ?? offer.monthly_base_gnf ?? 0))}
                    {Number(offer.per_enrolled_student_gnf ?? 0) > 0 &&
                      ` + ${formatCurrency(Number(offer.per_enrolled_student_gnf))} / élève déclaré ou inscrit`}
                    .
                  </p>
                )}
                {offer.declared_expected_students != null && (
                  <p className="text-xs text-muted-foreground">
                    Effectif déclaré à l&apos;inscription :{' '}
                    {String(offer.declared_expected_students)} élève(s).
                  </p>
                )}
              </>
            )}
            {showPricingBreakdown && !isSchool && Number(offer.annual_base_gnf ?? offer.monthly_base_gnf ?? 0) > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Puis abonnement mensuel</span>
                <span>{formatCurrency(Number(offer.annual_base_gnf ?? offer.monthly_base_gnf ?? 0))}</span>
              </div>
            )}
          </div>

          {offer.ceo_notes ? (
            <p className="text-sm border-l-2 border-primary pl-3">{String(offer.ceo_notes)}</p>
          ) : null}

          {canPay && offerStatus === 'awaiting_payment' && (
            <div className="space-y-3">
              <Label htmlFor="ref">Référence virement / Mobile Money</Label>
              <Input
                id="ref"
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                placeholder="REF-…"
              />
              <Button
                className="w-full bg-[#2563EB]"
                disabled={loading}
                onClick={confirmPayment}
              >
                {isPlatformAdmin ? 'Valider le paiement (admin)' : 'Confirmer mon paiement'}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Phase 2 : Orange Money, MTN MoMo, Ecobank — webhook automatique.
              </p>
            </div>
          )}

          {msg && <p className="text-sm text-center">{msg}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
