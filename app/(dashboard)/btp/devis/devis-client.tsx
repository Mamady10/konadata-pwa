'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createBtpQuote, type QuoteAccessMember } from '@/lib/actions/btp-quotes';
import {
  formatQuoteAmount,
  quoteDisplayNumber,
  type BtpQuoteListItem,
  type PriceCatalogItem,
  type QuoteStatus,
} from '@/lib/btp/quotes/quote-types';
import { QuoteCatalogManager } from '@/components/btp/quotes/quote-catalog-manager';
import { QuoteAccessManager } from '@/components/btp/quotes/quote-access-manager';
import { QuoteStatusBadge } from '@/components/btp/quotes/quote-status-badge';
import { Calculator, ChevronRight, Loader2, Plus, Search } from 'lucide-react';

interface Props {
  quotes: BtpQuoteListItem[];
  catalog: PriceCatalogItem[];
  members: QuoteAccessMember[];
  isDirector: boolean;
}

export function DevisClient({ quotes, catalog, members, isDirector }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return quotes;
    return quotes.filter((item) =>
      [item.number, item.title, item.clientName ?? ''].some((v) => v.toLowerCase().includes(q))
    );
  }, [quotes, query]);

  const stats = useMemo(() => {
    const sum = (status: QuoteStatus) =>
      quotes.filter((q) => q.status === status).reduce((s, q) => s + q.totalTtc, 0);
    return { sent: sum('sent'), accepted: sum('accepted'), drafts: quotes.filter((q) => q.status === 'draft').length };
  }, [quotes]);

  async function handleCreate(formData: FormData) {
    setError(null);
    setCreating(true);
    const result = await createBtpQuote(formData);
    setCreating(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    router.push(`/btp/devis/${result.id}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" />
            Devis
          </h1>
          <p className="text-muted-foreground">
            Devis par lots (matériaux, matériels, main d&apos;œuvre, suivi et contrôle), récapitulatif
            automatique, TVA au choix, PDF et Excel.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)} className="bg-[#2563EB] hover:bg-[#2563EB]/90">
          <Plus className="h-4 w-4" /> Nouveau devis
        </Button>
      </div>

      <Tabs defaultValue="devis" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="devis">Devis ({quotes.length})</TabsTrigger>
          <TabsTrigger value="catalogue">Catalogue de prix ({catalog.length})</TabsTrigger>
          {isDirector && <TabsTrigger value="acces">Accès</TabsTrigger>}
        </TabsList>

        <TabsContent value="devis" className="space-y-4">
          {showForm && (
            <Card className="border-blue-200/60">
              <CardHeader>
                <CardTitle>Nouveau devis</CardTitle>
                <CardDescription>
                  Le numéro est attribué automatiquement. Vous compléterez les lots et les lignes à
                  l&apos;étape suivante.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {error && <p className="text-sm text-destructive mb-3">{error}</p>}
                <form action={handleCreate} className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Intitulé du projet *</Label>
                    <Input
                      name="title"
                      required
                      placeholder="Projet de construction d'un établissement scolaire privé"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Sous-titre</Label>
                    <Input name="subtitle" placeholder="Ex. : Résidence Les Palmiers" />
                  </div>
                  <div className="space-y-2">
                    <Label>Client / maître d&apos;ouvrage</Label>
                    <Input name="client_name" placeholder="Nom du client" />
                  </div>
                  <div className="space-y-2">
                    <Label>Lieu des travaux</Label>
                    <Input name="location" placeholder="Ville, quartier…" />
                  </div>
                  <div className="space-y-2">
                    <Label>Structure de départ</Label>
                    <select
                      name="structure"
                      defaultValue="standard"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="standard">
                        Lots types : installation, fondation, élévation, dalle, toiture, imprévus
                      </option>
                      <option value="empty">Devis vide</option>
                    </select>
                  </div>
                  <div className="flex gap-2 sm:col-span-2">
                    <Button type="submit" disabled={creating} className="bg-[#2563EB]">
                      {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                      Créer et remplir le devis
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                      Annuler
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Brouillons</p>
                <p className="text-2xl font-bold">{stats.drafts}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Devis envoyés (en attente)</p>
                <p className="text-2xl font-bold text-blue-700">{formatQuoteAmount(stats.sent)} GNF</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Devis acceptés</p>
                <p className="text-2xl font-bold text-emerald-700">{formatQuoteAmount(stats.accepted)} GNF</p>
              </CardContent>
            </Card>
          </div>

          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher (numéro, projet, client)…"
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {filtered.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-10 text-center text-muted-foreground">
                <Calculator className="h-10 w-10 mx-auto mb-3" />
                {quotes.length === 0
                  ? 'Aucun devis. Cliquez sur « Nouveau devis » pour commencer.'
                  : 'Aucun devis ne correspond à la recherche.'}
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border divide-y bg-background">
              {filtered.map((q) => (
                <Link
                  key={q.id}
                  href={`/btp/devis/${q.id}`}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{q.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {quoteDisplayNumber(q)} · {q.clientName || 'Client non renseigné'} ·{' '}
                      {q.quoteDate.split('-').reverse().join('/')} · {q.lotCount} lot(s)
                    </p>
                  </div>
                  <QuoteStatusBadge status={q.status} />
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">{formatQuoteAmount(q.totalTtc)} GNF</p>
                    <p className="text-[10px] text-muted-foreground">{q.vatEnabled ? 'TTC' : 'Sans TVA'}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="catalogue">
          <QuoteCatalogManager initialItems={catalog} />
        </TabsContent>

        {isDirector && (
          <TabsContent value="acces">
            <QuoteAccessManager initialMembers={members} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
