import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calculator } from 'lucide-react';

export function QuoteAccessNotice({
  migrationMissing,
  isDirector,
  message,
}: {
  migrationMissing?: boolean;
  isDirector?: boolean;
  message?: string;
}) {
  return (
    <Card className="border-amber-200/80 bg-amber-500/5 max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calculator className="h-5 w-5 text-amber-700" />
          Devis
        </CardTitle>
        <CardDescription>
          {message ??
            (migrationMissing
              ? 'Le module Devis nécessite une mise à jour de la base de données (migration 121). Contactez le support KonaData.'
              : isDirector
                ? 'Le module Devis est réservé aux organisations BTP.'
                : "L'accès aux devis est réservé au directeur. Demandez-lui de vous donner l'accès (onglet « Accès » de la page Devis).")}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
