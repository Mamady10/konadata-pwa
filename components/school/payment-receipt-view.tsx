'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { PaymentReceipt } from '@/lib/school/payment-receipt';
import { formatReceiptDate, paymentKindLabel } from '@/lib/school/payment-receipt';
import { CONFIRMATION_SOURCE_LABELS } from '@/lib/school/student-payments';
import { formatCurrency } from '@/lib/utils';
import { Download, Printer, CheckCircle2 } from 'lucide-react';
import QRCode from 'qrcode';

interface Props {
  receipt: PaymentReceipt;
  verifyUrl: string;
}

export function PaymentReceiptView({ receipt, verifyUrl }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(verifyUrl, { width: 120, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [verifyUrl]);

  function handlePrint() {
    window.print();
  }

  function handleDownloadPdf() {
    window.open(`/api/school-payment/receipt/${receipt.payment_token}`, '_blank');
  }

  return (
    <>
      <div className="print:hidden flex flex-wrap gap-2 justify-center mb-6">
        <Button onClick={handlePrint} variant="outline">
          <Printer className="h-4 w-4 mr-2" />
          Imprimer
        </Button>
        <Button onClick={handleDownloadPdf} className="bg-[#2563EB]">
          <Download className="h-4 w-4 mr-2" />
          Télécharger PDF
        </Button>
      </div>

      <article
        id="receipt"
        className="mx-auto max-w-lg bg-white text-slate-900 shadow-lg rounded-xl overflow-hidden print:shadow-none print:rounded-none print:max-w-none"
      >
        <header className="bg-[#2563EB] text-white px-6 py-5 print:bg-[#2563EB]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider opacity-90">Reçu officiel</p>
              <h1 className="text-xl font-bold mt-1">{receipt.organization_name}</h1>
              {(receipt.organization_city || receipt.organization_phone) && (
                <p className="text-xs opacity-90 mt-1">
                  {[receipt.organization_city, receipt.organization_phone && `Tél. ${receipt.organization_phone}`]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
            </div>
            <CheckCircle2 className="h-10 w-10 opacity-90 shrink-0" />
          </div>
        </header>

        <div className="px-6 py-5 space-y-5 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground">Numéro de reçu</p>
              <p className="font-mono font-bold text-lg">{receipt.receipt_number ?? '—'}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Payé</Badge>
              {receipt.confirmation_source && (
                <Badge
                  variant="secondary"
                  className={
                    receipt.confirmation_source === 'orange_money'
                      ? 'bg-orange-100 text-orange-900 text-[10px]'
                      : 'text-[10px]'
                  }
                >
                  {CONFIRMATION_SOURCE_LABELS[receipt.confirmation_source]}
                </Badge>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">Date d&apos;émission</p>
              <p className="font-medium">
                {formatReceiptDate(receipt.receipt_issued_at ?? receipt.paid_at)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Code vérification</p>
              <p className="font-mono font-medium">{receipt.receipt_verification_code ?? '—'}</p>
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Élève</p>
            <p className="font-semibold text-base">{receipt.student_name}</p>
            {receipt.student_matricule && (
              <p>
                <span className="text-muted-foreground">Matricule :</span> {receipt.student_matricule}
              </p>
            )}
            {receipt.class_name && (
              <p>
                <span className="text-muted-foreground">Classe :</span> {receipt.class_name}
              </p>
            )}
            {receipt.academic_year && (
              <p>
                <span className="text-muted-foreground">Année :</span> {receipt.academic_year}
              </p>
            )}
          </div>

          <div className="rounded-lg bg-slate-50 border p-4 space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Règlement</p>
            <p>{paymentKindLabel(receipt.payment_kind)}</p>
            <p className="text-2xl font-bold text-[#2563EB]">{formatCurrency(receipt.amount_gnf)}</p>
            {receipt.reference && (
              <p className="text-xs">
                <span className="text-muted-foreground">Réf. transaction :</span>{' '}
                <span className="font-mono">{receipt.reference}</span>
              </p>
            )}
            {receipt.provider_payment_id && (
              <p className="text-xs">
                <span className="text-muted-foreground">ID Orange Money :</span>{' '}
                <span className="font-mono">{receipt.provider_payment_id}</span>
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Confirmé le {formatReceiptDate(receipt.paid_at)}
            </p>
          </div>

          {receipt.balance && receipt.payment_kind === 'tuition' && (
            <div className="text-xs space-y-1 border-t pt-3">
              <p className="font-semibold">Situation scolarité</p>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total annuel</span>
                <span>{formatCurrency(receipt.balance.total_due_gnf)}</span>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>Total payé</span>
                <span>{formatCurrency(receipt.balance.paid_gnf)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Reste à payer</span>
                <span>{formatCurrency(receipt.balance.remaining_gnf)}</span>
              </div>
            </div>
          )}

          <div className="flex items-end justify-between gap-4 border-t pt-4">
            <div className="text-[10px] text-muted-foreground max-w-[200px]">
              Ce reçu atteste du paiement enregistré par l&apos;établissement via {receipt.issued_by}.
              Conservez-le avec votre preuve Orange Money / virement.
            </div>
            {qrDataUrl && (
              <div className="text-center shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="QR vérification" className="h-[72px] w-[72px]" />
                <p className="text-[9px] text-muted-foreground mt-1">Vérifier</p>
              </div>
            )}
          </div>
        </div>

        <footer className="px-6 py-3 bg-muted/40 text-[10px] text-center text-muted-foreground print:bg-transparent">
          {receipt.organization_email && <span>{receipt.organization_email}</span>}
        </footer>
      </article>

      <style
        dangerouslySetInnerHTML={{
          __html: `@media print {
            body * { visibility: hidden; }
            #receipt, #receipt * { visibility: visible; }
            #receipt { position: absolute; left: 0; top: 0; width: 100%; }
          }`,
        }}
      />
    </>
  );
}
