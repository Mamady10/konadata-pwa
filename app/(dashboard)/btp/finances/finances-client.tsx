'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { BtpFinancialDashboardRowExtended } from '@/lib/btp/site-financial';
import {
  EXPENSE_CATEGORY_LABELS,
} from '@/lib/btp/site-financial';
import {
  createBtpSiteExpense,
  createBtpSubcontractContract,
  recordBtpSubcontractPayment,
  exportBtpExpensesCsv,
} from '@/lib/actions/btp-financial';
import { formatCurrency } from '@/lib/utils';
import { Wallet, Plus, Search, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { motion } from 'framer-motion';

interface ExpenseRow {
  id: string;
  site_id: string;
  category: string;
  amount: number;
  expense_date: string;
  description?: string | null;
  reference?: string | null;
  supplier?: string | null;
  btp_sites?: { name?: string } | null;
}

interface SubcontractRow {
  id: string;
  site_id: string;
  title: string;
  contractor?: string | null;
  amount?: number | null;
  paid_amount?: number | null;
  signed_date?: string | null;
  end_date?: string | null;
  status?: string | null;
  btp_sites?: { name?: string } | null;
}

interface Props {
  dashboard: BtpFinancialDashboardRowExtended[];
  expenses: ExpenseRow[];
  subcontracts: SubcontractRow[];
  sites: Array<{ id: string; name: string }>;
  isDirector: boolean;
}

export function FinancesClient({
  dashboard,
  expenses: initialExpenses,
  subcontracts: initialSubcontracts,
  sites,
  isDirector,
}: Props) {
  const router = useRouter();
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showContractForm, setShowContractForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [siteId, setSiteId] = useState('');
  const [category, setCategory] = useState('materials');
  const [expandedSite, setExpandedSite] = useState<string | null>(null);

  async function downloadExpensesCsv() {
    const csv = await exportBtpExpensesCsv();
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `depenses-btp-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalBudget = dashboard.reduce((s, r) => s + r.budget, 0);
  const totalSpent = dashboard.reduce((s, r) => s + r.spent, 0);

  async function handleExpense(formData: FormData) {
    setError(null);
    formData.set('site_id', siteId);
    formData.set('category', category);
    const result = await createBtpSiteExpense(formData);
    if ('error' in result) {
      setError(result.error ?? 'Enregistrement impossible.');
      return;
    }
    setShowExpenseForm(false);
    router.refresh();
  }

  async function handleContract(formData: FormData) {
    setError(null);
    formData.set('site_id', siteId);
    const result = await createBtpSubcontractContract(formData);
    if ('error' in result) {
      setError(result.error ?? 'Enregistrement impossible.');
      return;
    }
    setShowContractForm(false);
    router.refresh();
  }

  async function handlePayment(contractId: string, formData: FormData) {
    setError(null);
    formData.set('contract_id', contractId);
    const result = await recordBtpSubcontractPayment(formData);
    if ('error' in result) {
      setError(result.error ?? 'Paiement impossible.');
      return;
    }
    setShowPaymentForm(null);
    router.refresh();
  }

  const filteredSites = dashboard.filter((r) =>
    r.siteName.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Finances</h1>
            <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-200">
              Suivi multi-postes
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Budget global : {formatCurrency(totalBudget)} — consommé : {formatCurrency(totalSpent)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadExpensesCsv}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button
            onClick={() => setShowExpenseForm(!showExpenseForm)}
            className="bg-[#2563EB] hover:bg-[#2563EB]/90"
            disabled={sites.length === 0}
          >
            <Plus className="h-4 w-4" /> Dépense
          </Button>
          {isDirector && (
            <Button variant="outline" onClick={() => setShowContractForm(!showContractForm)} disabled={sites.length === 0}>
              <Plus className="h-4 w-4" /> Sous-traitance
            </Button>
          )}
        </div>
      </div>

      {showExpenseForm && (
        <Card>
          <CardHeader><CardTitle>Nouvelle dépense</CardTitle></CardHeader>
          <CardContent>
            {error && <p className="text-sm text-destructive mb-3">{error}</p>}
            <form action={handleExpense} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Chantier *</Label>
                <Select value={siteId} onValueChange={setSiteId} required>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Catégorie *</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Montant (GNF) *</Label><Input name="amount" type="number" min="0" required /></div>
              <div className="space-y-2"><Label>Date</Label><Input name="expense_date" type="date" /></div>
              <div className="space-y-2"><Label>Fournisseur</Label><Input name="supplier" /></div>
              <div className="space-y-2"><Label>Référence</Label><Input name="reference" /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Description</Label><Input name="description" /></div>
              <div className="sm:col-span-2 flex gap-2">
                <Button type="submit" className="bg-[#2563EB]" disabled={!siteId}>Enregistrer</Button>
                <Button type="button" variant="outline" onClick={() => setShowExpenseForm(false)}>Annuler</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {showContractForm && isDirector && (
        <Card>
          <CardHeader><CardTitle>Nouveau contrat sous-traitance</CardTitle></CardHeader>
          <CardContent>
            {error && <p className="text-sm text-destructive mb-3">{error}</p>}
            <form action={handleContract} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Chantier *</Label>
                <Select value={siteId} onValueChange={setSiteId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2"><Label>Intitulé *</Label><Input name="title" required /></div>
              <div className="space-y-2"><Label>Sous-traitant</Label><Input name="contractor" /></div>
              <div className="space-y-2"><Label>Montant contrat (GNF)</Label><Input name="amount" type="number" min="0" /></div>
              <div className="space-y-2"><Label>Acompte initial (GNF)</Label><Input name="initial_payment" type="number" min="0" /></div>
              <div className="space-y-2"><Label>Date signature</Label><Input name="signed_date" type="date" /></div>
              <div className="space-y-2"><Label>Fin prévue</Label><Input name="end_date" type="date" /></div>
              <div className="sm:col-span-2 flex gap-2">
                <Button type="submit" className="bg-[#2563EB]" disabled={!siteId}>Créer</Button>
                <Button type="button" variant="outline" onClick={() => setShowContractForm(false)}>Annuler</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Filtrer chantiers..." className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <Tabs defaultValue="chantiers">
        <TabsList>
          <TabsTrigger value="chantiers">Par chantier</TabsTrigger>
          <TabsTrigger value="depenses">Dépenses récentes</TabsTrigger>
          {isDirector && <TabsTrigger value="sous-traitance">Sous-traitance</TabsTrigger>}
        </TabsList>

        <TabsContent value="chantiers" className="mt-4">
          {filteredSites.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredSites.map((row, index) => {
                const pct = row.budget > 0 ? Math.min(100, Math.round((row.spent / row.budget) * 100)) : 0;
                return (
                  <motion.div key={row.siteId} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center justify-between gap-2">
                          <span className="truncate">{row.siteName}</span>
                          <Badge variant={pct > 90 ? 'destructive' : 'outline'}>{row.financialPct} %</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>{formatCurrency(row.spent)}</span>
                            <span className="text-muted-foreground">{formatCurrency(row.budget)}</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-[#2563EB] transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <span>MO : {formatCurrency(row.labor)}</span>
                          <span>Matériaux : {formatCurrency(row.materials)}</span>
                          <span>Équipement : {formatCurrency(row.equipment)}</span>
                          <span>Sous-trait. : {formatCurrency(row.subcontract)}</span>
                          <span>Frais gén. : {formatCurrency(row.overhead)}</span>
                        </div>
                        {row.posteComparison.length > 0 && (
                          <div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs"
                              onClick={() => setExpandedSite(expandedSite === row.siteId ? null : row.siteId)}
                            >
                              Budget vs réel par poste
                              {expandedSite === row.siteId ? <ChevronUp className="h-3.5 w-3.5 ml-1" /> : <ChevronDown className="h-3.5 w-3.5 ml-1" />}
                            </Button>
                            {expandedSite === row.siteId && (
                              <div className="mt-2 rounded-lg border overflow-hidden text-xs">
                                <table className="w-full">
                                  <thead className="bg-muted/50">
                                    <tr>
                                      <th className="text-left p-2 font-medium">Poste</th>
                                      <th className="text-right p-2 font-medium">Prévu</th>
                                      <th className="text-right p-2 font-medium">Réel</th>
                                      <th className="text-right p-2 font-medium">Écart</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {row.posteComparison.map((p) => (
                                      <tr key={p.poste} className="border-t">
                                        <td className="p-2">{p.label}</td>
                                        <td className="p-2 text-right">{formatCurrency(p.plannedAmount)}</td>
                                        <td className="p-2 text-right">{formatCurrency(p.actualAmount)}</td>
                                        <td className={`p-2 text-right ${p.gapAmount > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                                          {p.gapAmount > 0 ? '+' : ''}{formatCurrency(p.gapAmount)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
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
                <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucun chantier avec suivi financier.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="depenses" className="mt-4 space-y-2">
          {initialExpenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune dépense enregistrée.</p>
          ) : (
            initialExpenses.map((e) => (
              <Card key={e.id}>
                <CardContent className="p-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {EXPENSE_CATEGORY_LABELS[e.category as keyof typeof EXPENSE_CATEGORY_LABELS] ?? e.category}
                      {' — '}{formatCurrency(Number(e.amount))}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {(e.btp_sites as { name?: string } | null)?.name ?? '—'}
                      {e.supplier ? ` · ${e.supplier}` : ''}
                      {e.description ? ` · ${e.description}` : ''}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(e.expense_date).toLocaleDateString('fr-FR')}
                  </span>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {isDirector && (
          <TabsContent value="sous-traitance" className="mt-4 space-y-3">
            {initialSubcontracts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun contrat sous-traitance.</p>
            ) : (
              initialSubcontracts.map((c) => {
                const paid = Number(c.paid_amount ?? 0);
                const total = Number(c.amount ?? 0);
                return (
                  <Card key={c.id}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex flex-wrap justify-between gap-2">
                        <div>
                          <p className="font-medium">{c.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {(c.btp_sites as { name?: string } | null)?.name ?? '—'}
                            {c.contractor ? ` · ${c.contractor}` : ''}
                          </p>
                        </div>
                        <Badge variant="outline">{c.status ?? 'active'}</Badge>
                      </div>
                      <p className="text-sm">
                        Payé {formatCurrency(paid)}
                        {total > 0 ? ` / ${formatCurrency(total)}` : ''}
                      </p>
                      {showPaymentForm === c.id ? (
                        <form action={(fd) => handlePayment(c.id, fd)} className="flex flex-wrap gap-2 items-end">
                          <div className="space-y-1">
                            <Label className="text-xs">Montant</Label>
                            <Input name="amount" type="number" min="0" className="h-9 w-36" required />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Date</Label>
                            <Input name="payment_date" type="date" className="h-9" />
                          </div>
                          <Button type="submit" size="sm">Valider</Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => setShowPaymentForm(null)}>Annuler</Button>
                        </form>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setShowPaymentForm(c.id)}>
                          Enregistrer paiement
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
