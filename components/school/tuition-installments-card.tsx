'use client';

import { Badge } from '@/components/ui/badge';
import {
  installmentStatus,
  resolveTuitionInstallments,
  type TuitionInstallment,
  type TuitionBalance,
} from '@/lib/school/student-payments';
import { formatCurrency } from '@/lib/utils';
import { Calendar, CheckCircle2, AlertTriangle } from 'lucide-react';

const statusBadge: Record<string, { label: string; className: string }> = {
  paid: { label: 'Couvert', className: 'bg-emerald-100 text-emerald-800' },
  overdue: { label: 'Échéance passée', className: 'bg-amber-100 text-amber-900' },
  due_soon: { label: 'Bientôt', className: 'bg-blue-100 text-blue-800' },
  upcoming: { label: 'À venir', className: 'bg-muted text-muted-foreground' },
};

interface Props {
  installments: TuitionInstallment[];
  balance: TuitionBalance | null;
}

export function TuitionInstallmentsCard({ installments, balance }: Props) {
  if (!installments.length) return null;

  const totalDue = balance?.total_due_gnf ?? 0;
  const resolved = resolveTuitionInstallments(installments, totalDue);
  const paid = balance?.paid_gnf ?? 0;
  let cumulative = 0;

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <p className="text-sm font-medium flex items-center gap-2">
        <Calendar className="h-4 w-4" />
        Échéancier indicatif
      </p>
      <p className="text-xs text-muted-foreground">
        Montants calculés selon la scolarité de la classe ({installments.some((i) => i.percent > 0) ? 'répartition en %' : 'forfait'}).
        Les dates ne bloquent pas le paiement.
      </p>
      <ul className="space-y-2">
        {resolved.map((inst, i) => {
          cumulative += inst.amount_gnf;
          const st = installmentStatus(inst.due_date, paid, cumulative);
          const badge = statusBadge[st];
          const dueLabel = new Date(inst.due_date).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          });
          return (
            <li
              key={`${inst.label}-${i}`}
              className="flex flex-wrap items-center justify-between gap-2 text-xs rounded-md bg-muted/40 px-2 py-1.5"
            >
              <div>
                <span className="font-medium">{inst.label}</span>
                {inst.percent > 0 && (
                  <span className="text-muted-foreground"> ({inst.percent} %)</span>
                )}
                <span className="text-muted-foreground"> · {dueLabel}</span>
              </div>
              <div className="flex items-center gap-2">
                <span>{formatCurrency(inst.amount_gnf)}</span>
                <Badge variant="secondary" className={`text-[10px] ${badge.className}`}>
                  {st === 'paid' ? (
                    <CheckCircle2 className="h-3 w-3 mr-0.5 inline" />
                  ) : st === 'overdue' ? (
                    <AlertTriangle className="h-3 w-3 mr-0.5 inline" />
                  ) : null}
                  {badge.label}
                </Badge>
              </div>
            </li>
          );
        })}
      </ul>
      {balance && (
        <div className="text-xs pt-1 border-t space-y-0.5">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total annuel</span>
            <span>{formatCurrency(balance.total_due_gnf)}</span>
          </div>
          <div className="flex justify-between text-emerald-700">
            <span>Déjà payé</span>
            <span>{formatCurrency(balance.paid_gnf)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Reste à payer</span>
            <span>{formatCurrency(balance.remaining_gnf)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
