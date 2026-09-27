'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { deleteBtpPriceCatalogItem, saveBtpPriceCatalogItem } from '@/lib/actions/btp-quotes';
import {
  formatQuoteAmount,
  QUOTE_SECTION_LABELS,
  QUOTE_SECTIONS,
  type PriceCatalogItem,
  type QuoteSection,
} from '@/lib/btp/quotes/quote-types';
import { QuoteNumberInput } from './quote-number-input';
import { Check, Loader2, Pencil, Plus, Search, Trash2, X } from 'lucide-react';

interface Draft {
  id?: string;
  designation: string;
  unit: string;
  unitPrice: number;
  section: QuoteSection;
}

const EMPTY_DRAFT: Draft = { designation: '', unit: '', unitPrice: 0, section: 'materials' };

const selectClass = 'h-8 rounded-md border border-input bg-background px-2 text-sm';

export function QuoteCatalogManager({ initialItems }: { initialItems: PriceCatalogItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState('');
  const [sectionFilter, setSectionFilter] = useState<QuoteSection | 'all'>('all');
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) =>
        (sectionFilter === 'all' || i.section === sectionFilter) &&
        (!q || i.designation.toLowerCase().includes(q))
    );
  }, [items, query, sectionFilter]);

  async function save(input: Draft) {
    setError(null);
    setBusy(true);
    const result = await saveBtpPriceCatalogItem(input);
    setBusy(false);
    if ('error' in result) {
      setError(result.error);
      return false;
    }
    setItems((prev) => {
      const rest = prev.filter((i) => i.id !== result.item.id);
      return [...rest, result.item].sort((a, b) => a.designation.localeCompare(b.designation, 'fr'));
    });
    return true;
  }

  async function remove(id: string) {
    if (!confirm('Supprimer cet article du catalogue ?')) return;
    const result = await deleteBtpPriceCatalogItem(id);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Catalogue de prix</CardTitle>
        <CardDescription>
          Vos prix habituels (ciment, fer, sable, main d&apos;œuvre…). Dans un devis, tapez une désignation :
          l&apos;unité et le prix se remplissent automatiquement. Depuis un devis, le bouton « Mettre à jour
          le catalogue » enregistre ses prix ici.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}

        <form
          className="grid gap-2 rounded-lg border bg-muted/30 p-3 sm:grid-cols-[1fr_90px_140px_150px_auto]"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await save(draft)) setDraft({ ...EMPTY_DRAFT, section: draft.section });
          }}
        >
          <Input
            className="h-8"
            placeholder="Désignation (ex. Ciment CPJ 42.5)"
            value={draft.designation}
            onChange={(e) => setDraft({ ...draft, designation: e.target.value })}
            required
          />
          <Input
            className="h-8"
            placeholder="Unité"
            value={draft.unit}
            onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
          />
          <QuoteNumberInput
            ariaLabel="Prix unitaire"
            placeholder="Prix unitaire"
            decimals={0}
            value={draft.unitPrice}
            onChange={(unitPrice) => setDraft({ ...draft, unitPrice })}
          />
          <select
            className={selectClass}
            value={draft.section}
            onChange={(e) => setDraft({ ...draft, section: e.target.value as QuoteSection })}
          >
            {QUOTE_SECTIONS.map((s) => (
              <option key={s} value={s}>
                {QUOTE_SECTION_LABELS[s]}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" disabled={busy} className="h-8">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Ajouter
          </Button>
        </form>

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Rechercher un article…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            className={`${selectClass} h-10`}
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value as QuoteSection | 'all')}
          >
            <option value="all">Toutes les rubriques</option>
            {QUOTE_SECTIONS.map((s) => (
              <option key={s} value={s}>
                {QUOTE_SECTION_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            {items.length === 0 ? 'Catalogue vide pour le moment.' : 'Aucun article trouvé.'}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Désignation</th>
                  <th className="px-3 py-2 text-left w-24">Unité</th>
                  <th className="px-3 py-2 text-right w-36">Prix unitaire</th>
                  <th className="px-3 py-2 text-left w-40">Rubrique</th>
                  <th className="px-3 py-2 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((item) =>
                  editing?.id === item.id ? (
                    <tr key={item.id} className="bg-blue-500/5">
                      <td className="px-2 py-1.5">
                        <Input
                          className="h-8"
                          value={editing.designation}
                          onChange={(e) => setEditing({ ...editing, designation: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          className="h-8"
                          value={editing.unit}
                          onChange={(e) => setEditing({ ...editing, unit: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <QuoteNumberInput
                          decimals={0}
                          value={editing.unitPrice}
                          onChange={(unitPrice) => setEditing({ ...editing, unitPrice })}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <select
                          className={`${selectClass} w-full`}
                          value={editing.section}
                          onChange={(e) => setEditing({ ...editing, section: e.target.value as QuoteSection })}
                        >
                          {QUOTE_SECTIONS.map((s) => (
                            <option key={s} value={s}>
                              {QUOTE_SECTION_LABELS[s]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          disabled={busy}
                          onClick={async () => {
                            if (await save(editing)) setEditing(null);
                          }}
                          aria-label="Enregistrer"
                        >
                          <Check className="h-4 w-4 text-emerald-600" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => setEditing(null)}
                          aria-label="Annuler"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={item.id} className="hover:bg-muted/30">
                      <td className="px-3 py-2">{item.designation}</td>
                      <td className="px-3 py-2">{item.unit}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatQuoteAmount(item.unitPrice)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{QUOTE_SECTION_LABELS[item.section]}</td>
                      <td className="px-2 py-1 whitespace-nowrap text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => setEditing({ ...item })}
                          aria-label="Modifier"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={() => remove(item.id)}
                          aria-label="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
