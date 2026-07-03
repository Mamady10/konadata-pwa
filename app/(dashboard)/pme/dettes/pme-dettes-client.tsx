'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import {
  HandCoins,
  Plus,
  Search,
  Wallet,
  TrendingDown,
  CheckCircle2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import type { PmeDebtRow } from '@/lib/actions/pme';

type ActionResult = { error?: string; success?: boolean };

interface Props {
  debts: PmeDebtRow[];
  customers: Array<{ value: string; label: string }>;
  onCreate: (formData: FormData) => Promise<ActionResult>;
  onAddPayment: (formData: FormData) => Promise<ActionResult>;
}

const STATUS_META: Record<
  PmeDebtRow['status'],
  { label: string; className: string }
> = {
  open: {
    label: 'À payer',
    className: 'bg-red-500/10 text-red-700 border-red-200',
  },
  partial: {
    label: 'Partiel',
    className: 'bg-amber-500/10 text-amber-700 border-amber-200',
  },
  paid: {
    label: 'Soldé',
    className: 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
  },
};

export function PmeDettesClient({
  debts,
  customers,
  onCreate,
  onAddPayment,
}: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [payLoading, setPayLoading] = useState(false);

  const totals = useMemo(() => {
    let due = 0;
    let paid = 0;
    let remaining = 0;
    for (const d of debts) {
      due += d.original_amount;
      paid += d.amount_paid;
      remaining += d.remaining;
    }
    return { due, paid, remaining };
  }, [debts]);

  const filtered = debts.filter((d) => {
    const q = query.toLowerCase();
    return (
      d.debtor_name.toLowerCase().includes(q) ||
      (d.description ?? '').toLowerCase().includes(q)
    );
  });

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await onCreate(new FormData(e.currentTarget));
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setShowForm(false);
    router.refresh();
  }

  async function handlePayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPayError(null);
    setPayLoading(true);
    const result = await onAddPayment(new FormData(e.currentTarget));
    setPayLoading(false);
    if (result.error) {
      setPayError(result.error);
      return;
    }
    setPayingId(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Crédits & Dettes</h1>
            <Badge
              variant="secondary"
              className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-200"
            >
              Supabase connecté
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Suivez ce que vos clients vous doivent et les paiements reçus
          </p>
        </div>
        <Button
          onClick={() => {
            setShowForm(!showForm);
            setPayingId(null);
          }}
          className="bg-[#2563EB] hover:bg-[#2563EB]/90"
        >
          <Plus className="h-4 w-4" /> Nouvelle dette
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          title="Total crédité"
          value={formatCurrency(totals.due)}
          icon={Wallet}
          color="bg-blue-500"
        />
        <SummaryCard
          title="Encaissé"
          value={formatCurrency(totals.paid)}
          icon={CheckCircle2}
          color="bg-emerald-500"
        />
        <SummaryCard
          title="Restant dû"
          value={formatCurrency(totals.remaining)}
          icon={TrendingDown}
          color="bg-red-500"
        />
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Enregistrer une dette (crédit accordé)</CardTitle>
          </CardHeader>
          <CardContent>
            {error && <p className="text-sm text-destructive mb-3">{error}</p>}
            <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Client existant</Label>
                <select
                  name="customer_id"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  defaultValue=""
                >
                  <option value="">— (ou saisir un nom ci-dessous)</option>
                  {customers.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Nom du débiteur</Label>
                <Input name="debtor_name" placeholder="Ex : Mamadou Diallo" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Description / motif</Label>
                <Input
                  name="description"
                  placeholder="Ex : Achat de 10 sacs de ciment à crédit"
                />
              </div>
              <div className="space-y-2">
                <Label>Montant total dû (GNF) *</Label>
                <Input name="original_amount" type="number" min="0" required />
              </div>
              <div className="space-y-2">
                <Label>Acompte déjà reçu (GNF)</Label>
                <Input name="initial_payment" type="number" min="0" defaultValue="0" />
              </div>
              <div className="space-y-2">
                <Label>Date de la dette</Label>
                <Input name="incurred_at" type="date" />
              </div>
              <div className="space-y-2">
                <Label>Échéance</Label>
                <Input name="due_date" type="date" />
              </div>
              <div className="sm:col-span-2 flex gap-2">
                <Button type="submit" className="bg-[#2563EB]" disabled={loading}>
                  {loading ? 'Enregistrement…' : 'Enregistrer'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  Annuler
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher un débiteur…"
          className="pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((d, index) => {
            const meta = STATUS_META[d.status];
            const progress =
              d.original_amount > 0
                ? Math.min(100, Math.round((d.amount_paid / d.original_amount) * 100))
                : 0;
            return (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <Card className="hover:shadow-card-hover transition-shadow">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                        <HandCoins className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-semibold truncate">{d.debtor_name}</h3>
                          <Badge variant="outline" className={`text-[10px] ${meta.className}`}>
                            {meta.label}
                          </Badge>
                        </div>
                        {d.description && (
                          <p className="text-sm text-muted-foreground truncate">
                            {d.description}
                          </p>
                        )}
                        {d.due_date && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Échéance : {new Date(d.due_date).toLocaleDateString('fr-FR')}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Dû</span>
                        <span className="font-medium">
                          {formatCurrency(d.original_amount)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Payé</span>
                        <span className="font-medium text-emerald-600">
                          {formatCurrency(d.amount_paid)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Restant</span>
                        <span className="font-semibold text-red-600">
                          {formatCurrency(d.remaining)}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {d.status !== 'paid' && (
                      <div>
                        {payingId === d.id ? (
                          <form
                            onSubmit={handlePayment}
                            className="space-y-2 rounded-lg border p-3"
                          >
                            <input type="hidden" name="debt_id" value={d.id} />
                            {payError && (
                              <p className="text-xs text-destructive">{payError}</p>
                            )}
                            <div className="grid gap-2 sm:grid-cols-2">
                              <div className="space-y-1">
                                <Label className="text-xs">Montant reçu (GNF)</Label>
                                <Input
                                  name="amount"
                                  type="number"
                                  min="0"
                                  max={d.remaining}
                                  required
                                  autoFocus
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Date</Label>
                                <Input name="paid_at" type="date" />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Note (optionnel)</Label>
                              <Input name="note" placeholder="Ex : versement Orange Money" />
                            </div>
                            <div className="flex gap-2 pt-1">
                              <Button
                                type="submit"
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700"
                                disabled={payLoading}
                              >
                                {payLoading ? 'Enregistrement…' : 'Valider le paiement'}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setPayingId(null)}
                              >
                                Annuler
                              </Button>
                            </div>
                          </form>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => {
                              setPayingId(d.id);
                              setPayError(null);
                              setShowForm(false);
                            }}
                          >
                            <Plus className="h-4 w-4" /> Saisir un paiement reçu
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <HandCoins className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Aucune dette enregistrée. Cliquez sur « Nouvelle dette » pour créditer un
              client.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  icon: typeof Wallet;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
