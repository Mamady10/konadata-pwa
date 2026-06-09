'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  getStudentPaymentByToken,
  prepareOrangeMoneyPayment,
  recordStudentPaymentByToken,
} from '@/lib/actions/student-payments';
import { formatCurrency } from '@/lib/utils';
import {
  PAYMENT_KIND_LABELS,
  parseTuitionBalance,
  type StudentPaymentKind,
} from '@/lib/school/student-payments';
import { CreditCard, CheckCircle2, FileText, Download, Smartphone, Loader2 } from 'lucide-react';

interface Props {
  token: string;
  payment: Record<string, unknown>;
  isStaff: boolean;
  isPlatformAdmin: boolean;
  isLoggedIn: boolean;
}

export function PaiementScolariteClient({
  token,
  payment: initialPayment,
  isStaff,
  isLoggedIn,
}: Props) {
  const [payment, setPayment] = useState(initialPayment);
  const [ref, setRef] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(initialPayment.status === 'paid');
  const [receiptUrl, setReceiptUrl] = useState<string | null>(
    initialPayment.status === 'paid' ? `/recu-scolarite/${token}` : null
  );
  const [omAwaiting, setOmAwaiting] = useState(false);
  const [omMerchantPhone, setOmMerchantPhone] = useState<string | null>(
    (initialPayment.orange_money_merchant_phone as string) || null
  );
  const [omMerchantLabel, setOmMerchantLabel] = useState<string | null>(
    (initialPayment.orange_money_merchant_label as string) || null
  );
  const [showManual, setShowManual] = useState(false);

  const status = payment.status as string;
  const kind = payment.payment_kind as StudentPaymentKind;
  const amount = Number(payment.amount_gnf ?? 0);
  const balance = parseTuitionBalance(payment.balance);
  const omEnabled = payment.orange_money_enabled !== false;
  const canPay = status !== 'paid';
  const showReceipt = done || status === 'paid';

  const refreshPayment = useCallback(async () => {
    const res = await getStudentPaymentByToken(token);
    if (res.payment) {
      setPayment(res.payment);
      if (res.payment.status === 'paid') {
        setDone(true);
        setOmAwaiting(false);
        setReceiptUrl((res.payment.receipt_url as string) ?? `/recu-scolarite/${token}`);
        setMsg('Paiement Orange Money confirmé. Votre reçu est prêt.');
      }
    }
  }, [token]);

  useEffect(() => {
    if (!omAwaiting || done) return;
    const id = setInterval(() => void refreshPayment(), 5000);
    return () => clearInterval(id);
  }, [omAwaiting, done, refreshPayment]);

  async function startOrangeMoney() {
    setLoading(true);
    setMsg(null);
    const res = await prepareOrangeMoneyPayment(token);
    setLoading(false);
    if (res.error) {
      setMsg(res.error);
      return;
    }
    const d = res.data ?? {};
    setOmMerchantPhone((d.merchant_phone as string) || omMerchantPhone);
    setOmMerchantLabel((d.merchant_label as string) || omMerchantLabel);
    setOmAwaiting(true);
    setMsg(
      (d.instructions as string) ||
        'Effectuez le transfert Orange Money. La confirmation est automatique.'
    );
  }

  async function confirmPayment() {
    setLoading(true);
    setMsg(null);
    const res = await recordStudentPaymentByToken(token, ref || undefined);
    setLoading(false);
    if (res.error) {
      setMsg(res.error);
      return;
    }
    setDone(true);
    setOmAwaiting(false);
    setReceiptUrl(res.receiptUrl ?? `/recu-scolarite/${token}`);
    setMsg('Paiement enregistré. Votre reçu est disponible ci-dessous.');
  }

  if (showReceipt) {
    const url = receiptUrl ?? `/recu-scolarite/${token}`;
    const confSource = payment.confirmation_source as string | undefined;
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#F8FAFC]">
        <Card className="max-w-lg w-full">
          <CardContent className="pt-8 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <h1 className="text-xl font-bold">Paiement reçu</h1>
            {confSource === 'orange_money' && (
              <Badge className="bg-orange-100 text-orange-900 hover:bg-orange-100">
                Confirmé Orange Money
              </Badge>
            )}
            <p className="text-muted-foreground">
              {String(payment.organization_name)} a enregistré votre règlement de{' '}
              {formatCurrency(amount)}.
            </p>
            {payment.reference && (
              <p className="text-xs font-mono text-muted-foreground">
                Réf. {String(payment.reference)}
              </p>
            )}
            {balance && kind === 'tuition' && (
              <p className="text-sm">
                Reste à payer : <strong>{formatCurrency(balance.remaining_gnf)}</strong>
              </p>
            )}
            {msg && <p className="text-sm text-emerald-700">{msg}</p>}

            <div className="flex flex-col gap-2 pt-2">
              <Button asChild className="bg-[#2563EB]">
                <Link href={url}>
                  <FileText className="h-4 w-4 mr-2" />
                  Voir mon reçu / facture
                </Link>
              </Button>
              <Button asChild variant="outline">
                <a href={`/api/school-payment/receipt/${token}`} download>
                  <Download className="h-4 w-4 mr-2" />
                  Télécharger PDF
                </a>
              </Button>
              {isLoggedIn ? (
                <Button asChild variant="ghost">
                  <Link href="/etablissement/candidatures">Retour à mon dossier</Link>
                </Button>
              ) : (
                <Button asChild variant="ghost">
                  <Link href="/payer-scolarite">Nouveau versement</Link>
                </Button>
              )}
            </div>
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
              {PAYMENT_KIND_LABELS[kind] ?? 'Paiement scolaire'}
            </CardTitle>
            <Badge variant="secondary">{omAwaiting ? 'En attente OM' : 'À payer'}</Badge>
          </div>
          <CardDescription>
            {String(payment.organization_name)} — {String(payment.student_name)}
            {payment.student_matricule ? ` · ${String(payment.student_matricule)}` : ''}
            {payment.academic_year ? ` · ${String(payment.academic_year)}` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4 space-y-2">
            <p className="text-sm text-muted-foreground">{String(payment.description)}</p>
            <div className="flex justify-between text-sm">
              <span>Montant de ce versement</span>
              <span className="font-bold text-lg">{formatCurrency(amount)}</span>
            </div>
            {balance && kind === 'tuition' && (
              <>
                <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t">
                  <span>Total scolarité</span>
                  <span>{formatCurrency(balance.total_due_gnf)}</span>
                </div>
                <div className="flex justify-between text-xs text-emerald-700">
                  <span>Déjà payé</span>
                  <span>{formatCurrency(balance.paid_gnf)}</span>
                </div>
              </>
            )}
          </div>

          {canPay && omEnabled && !showManual && (
            <div className="space-y-3 rounded-lg border border-orange-200 bg-orange-50/50 p-4">
              <p className="text-sm font-medium flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-orange-600" />
                Orange Money (recommandé)
              </p>
              {!omAwaiting ? (
                <>
                  {omMerchantPhone ? (
                    <p className="text-sm">
                      Envoyez <strong>{formatCurrency(amount)}</strong> au{' '}
                      <strong>{omMerchantLabel || 'compte établissement'}</strong> :{' '}
                      <span className="font-mono">{omMerchantPhone}</span>
                    </p>
                  ) : (
                    <p className="text-xs text-amber-800">
                      Numéro marchand non configuré — la scolarité doit le renseigner dans les
                      paramètres paiements.
                    </p>
                  )}
                  <Button
                    className="w-full bg-orange-600 hover:bg-orange-600/90"
                    disabled={loading}
                    onClick={() => void startOrangeMoney()}
                  >
                    {loading ? 'Préparation…' : 'Payer avec Orange Money'}
                  </Button>
                  <p className="text-[10px] text-muted-foreground text-center">
                    Confirmation automatique via webhook — reçu émis dès validation Orange.
                  </p>
                </>
              ) : (
                <div className="text-center space-y-2 py-2">
                  <Loader2 className="h-8 w-8 animate-spin text-orange-600 mx-auto" />
                  <p className="text-sm font-medium">En attente de confirmation Orange Money…</p>
                  {omMerchantPhone && (
                    <p className="text-xs text-muted-foreground">
                      Compte : <span className="font-mono">{omMerchantPhone}</span> · Montant :{' '}
                      {formatCurrency(amount)}
                    </p>
                  )}
                  <Button type="button" variant="ghost" size="sm" onClick={() => void refreshPayment()}>
                    Actualiser le statut
                  </Button>
                </div>
              )}
              <button
                type="button"
                className="text-xs text-primary underline w-full text-center"
                onClick={() => setShowManual(true)}
              >
                J&apos;ai payé autrement (virement, espèces…) — saisir la référence
              </button>
            </div>
          )}

          {canPay && (showManual || !omEnabled) && (
            <div className="space-y-3">
              {omEnabled && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline"
                  onClick={() => setShowManual(false)}
                >
                  ← Retour Orange Money
                </button>
              )}
              <Label htmlFor="ref">Référence virement / Mobile Money / caisse</Label>
              <Input
                id="ref"
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                placeholder="REF-… ou numéro de transaction"
              />
              <Button
                className="w-full bg-[#2563EB]"
                disabled={loading}
                onClick={() => void confirmPayment()}
              >
                {isStaff ? 'Valider le paiement' : 'Confirmer mon paiement'}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Confirmation manuelle — reçu émis après validation (sans badge Orange Money auto).
              </p>
            </div>
          )}

          {msg && (
            <p
              className={`text-sm text-center ${omAwaiting ? 'text-orange-800' : ''}`}
            >
              {msg}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
