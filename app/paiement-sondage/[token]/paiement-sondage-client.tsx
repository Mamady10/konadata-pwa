'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { recordNgoSurveyPayment } from '@/lib/actions/ngo-survey-billing';
import { formatCurrency } from '@/lib/utils';
import { CheckCircle2, ClipboardList, CreditCard } from 'lucide-react';

interface Props {
  token: string;
  charge: Record<string, unknown>;
  orgId: string;
  isOrgAdmin: boolean;
  isPlatformAdmin: boolean;
}

export function PaiementSondageClient({
  charge,
  orgId,
  isOrgAdmin,
  isPlatformAdmin,
}: Props) {
  const [ref, setRef] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const status = charge.status as string;
  const amount = Number(charge.amount_gnf ?? 0);
  const breakdown = (charge.breakdown ?? {}) as Record<string, unknown>;
  const surveyId = charge.survey_id as string;
  const canPay =
    status === 'awaiting_payment' &&
    (isPlatformAdmin || (isOrgAdmin && orgId === charge.organization_id));

  async function confirmPayment() {
    const chargeId = charge.charge_id as string;
    if (!chargeId) return;
    setLoading(true);
    setMsg(null);
    const res = await recordNgoSurveyPayment(chargeId, ref || undefined);
    setLoading(false);
    if (res.error) {
      setMsg(res.error);
      return;
    }
    setDone(true);
    setMsg('Paiement enregistré. Vous pouvez activer le sondage.');
  }

  if (done || status === 'paid' || status === 'waived') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#F8FAFC]">
        <Card className="max-w-lg w-full">
          <CardContent className="pt-8 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <h1 className="text-xl font-bold">Campagne réglée</h1>
            <p className="text-muted-foreground">
              Le sondage « {String(charge.survey_title)} » peut être activé.
            </p>
            <Button asChild className="bg-[#2563EB]">
              <Link href={`/ong/sondages/${surveyId}`}>Ouvrir le sondage</Link>
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
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <CardTitle>Paiement campagne sondage</CardTitle>
          </div>
          <CardDescription>
            {String(charge.organization_name)} — facturation distincte de l&apos;abonnement
            plateforme
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <p className="font-semibold text-lg">{String(charge.survey_title)}</p>
            <Badge variant="outline" className="mt-2">
              {status === 'awaiting_payment' ? 'En attente de paiement' : status}
            </Badge>
          </div>

          <div className="rounded-lg border p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Personnes cibles</span>
              <span>{Number(charge.target_responses ?? breakdown.target_responses ?? 0)}</span>
            </div>
            <div className="flex justify-between font-bold border-t pt-2 text-base">
              <span>Total validé par KonaData</span>
              <span className="text-[#2563EB]">{formatCurrency(amount)}</span>
            </div>
          </div>

          {canPay ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Orange Money ou virement — saisissez la référence de transaction après paiement.
              </p>
              <div className="space-y-2">
                <Label>Référence de paiement</Label>
                <Input
                  value={ref}
                  onChange={(e) => setRef(e.target.value)}
                  placeholder="OM-123456789"
                />
              </div>
              <Button
                className="w-full bg-[#2563EB]"
                disabled={loading}
                onClick={confirmPayment}
              >
                <CreditCard className="h-4 w-4 mr-1" />
                {loading ? 'Enregistrement…' : 'Confirmer le paiement'}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Connectez-vous avec le compte directeur de l&apos;ONG pour confirmer le paiement.
            </p>
          )}

          {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
