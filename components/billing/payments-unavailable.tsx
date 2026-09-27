import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PAYMENTS_UNAVAILABLE_MESSAGE } from '@/lib/billing/payments-availability';
import { AlertTriangle } from 'lucide-react';

export function PaymentsUnavailableNotice({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="text-sm rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-950">
        {PAYMENTS_UNAVAILABLE_MESSAGE}
      </p>
    );
  }

  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          Paiement en ligne indisponible
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{PAYMENTS_UNAVAILABLE_MESSAGE}</p>
      </CardContent>
    </Card>
  );
}
