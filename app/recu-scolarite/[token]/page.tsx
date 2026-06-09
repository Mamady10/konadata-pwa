import { getPaymentReceiptByToken } from '@/lib/actions/student-payments';
import { PaymentReceiptView } from '@/components/school/payment-receipt-view';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function RecuScolaritePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { receipt, error } = await getPaymentReceiptByToken(token);

  if (error || !receipt) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#F8FAFC]">
        <div className="text-center space-y-4 max-w-md">
          <p className="text-muted-foreground">
            {error ?? 'Reçu introuvable. Le paiement doit être confirmé pour émettre un reçu.'}
          </p>
          <Button variant="outline" asChild>
            <Link href="/">Retour à l&apos;accueil</Link>
          </Button>
        </div>
      </div>
    );
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'https://konadatagn.com';
  const verifyUrl = `${origin}/recu-scolarite/${token}`;

  return (
    <div className="min-h-screen py-8 px-4 bg-[#F8FAFC] print:bg-white print:p-0">
      <PaymentReceiptView receipt={receipt} verifyUrl={verifyUrl} />
    </div>
  );
}
