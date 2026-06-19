'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { createBtpDeliveryNote } from '@/lib/actions/btp-financial';
import {
  BTP_ITEM_CATEGORY_LABELS,
  type BtpItemCategory,
  formatDeliveryItemsSummary,
} from '@/lib/btp/delivery-note-types';
import { Receipt, Plus, Search, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface BonsItem {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  date?: string;
  categoryLabel?: string;
  description?: string;
}

interface LineItem {
  item: string;
  category: BtpItemCategory;
  qty: string;
  unit: string;
  description: string;
}

interface Props {
  items: BonsItem[];
  sites: Array<{ id: string; name: string }>;
}

const emptyLine = (): LineItem => ({
  item: '',
  category: 'materials',
  qty: '',
  unit: '',
  description: '',
});

export function BonsClient({ items: initialItems, sites }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [siteId, setSiteId] = useState('');
  const [category, setCategory] = useState<BtpItemCategory>('materials');
  const [addToStock, setAddToStock] = useState(true);
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);

  function updateLine(index: number, patch: Partial<LineItem>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  async function handleCreate(formData: FormData) {
    setError(null);
    formData.set('site_id', siteId);
    formData.set('category', category);
    formData.set('add_to_stock', addToStock ? 'true' : 'false');
    const validLines = lines
      .filter((l) => l.item.trim())
      .map((l) => ({
        item: l.item.trim(),
        category: l.category,
        qty: l.qty ? Number(l.qty) : '',
        unit: l.unit.trim() || undefined,
        description: l.description.trim() || undefined,
      }));
    formData.set('items_json', JSON.stringify(validLines));

    const result = await createBtpDeliveryNote(formData);
    if ('error' in result) {
      setError(result.error ?? 'Enregistrement impossible.');
      return;
    }
    setShowForm(false);
    setLines([emptyLine()]);
    router.refresh();
  }

  const items = initialItems.filter((i) =>
    i.title.toLowerCase().includes(query.toLowerCase()) ||
    i.subtitle.toLowerCase().includes(query.toLowerCase()) ||
    (i.description ?? '').toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Bons de livraison</h1>
            <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-200">Supabase connecté</Badge>
          </div>
          <p className="text-muted-foreground">{initialItems.length} bon(s) — catégorie, description et entrée stock optionnelle</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="bg-[#2563EB] hover:bg-[#2563EB]/90">
          <Plus className="h-4 w-4" /> Nouveau BL
        </Button>
      </div>

      {sites.length === 0 && !showForm && (
        <p className="text-sm text-amber-800 bg-amber-500/10 border border-amber-200 rounded-lg px-4 py-3">
          Aucun chantier disponible.{' '}
          <Link href="/btp/chantiers" className="font-medium underline underline-offset-2">Créez un chantier</Link>.
        </p>
      )}

      {showForm && (
        sites.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground mb-3">Créez d&apos;abord un chantier.</p>
              <Button asChild><Link href="/btp/chantiers">Aller aux chantiers</Link></Button>
            </CardContent>
          </Card>
        ) : (
        <Card>
          <CardHeader><CardTitle>Saisie — bon de livraison</CardTitle></CardHeader>
          <CardContent>
            {error && <p className="text-sm text-destructive mb-3">{error}</p>}
            <form action={handleCreate} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Chantier *</Label>
                <Select value={siteId} onValueChange={setSiteId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Référence BL *</Label><Input name="reference" required placeholder="BL-2026-001" /></div>
              <div className="space-y-2"><Label>Montant total (GNF) *</Label><Input name="total_amount" type="number" min="0" required /></div>
              <div className="space-y-2">
                <Label>Catégorie principale *</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as BtpItemCategory)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(BTP_ITEM_CATEGORY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Fournisseur</Label><Input name="supplier" /></div>
              <div className="space-y-2"><Label>Date livraison</Label><Input name="delivery_date" type="date" /></div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Description / type d&apos;éléments reçus</Label>
                <textarea
                  name="description"
                  rows={2}
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  placeholder="Ex. : Livraison ciment et fer pour dalle bloc B — conforme au BC n°12"
                />
              </div>

              <div className="sm:col-span-2 space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Lignes reçues (détail)</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => setLines((p) => [...p, emptyLine()])}>
                    <Plus className="h-3.5 w-3.5" /> Ligne
                  </Button>
                </div>
                {lines.map((line, index) => (
                  <div key={index} className="grid gap-2 sm:grid-cols-6 p-3 rounded-lg border bg-muted/30">
                    <div className="sm:col-span-2 space-y-1">
                      <Label className="text-xs">Article *</Label>
                      <Input value={line.item} onChange={(e) => updateLine(index, { item: e.target.value })} placeholder="Ciment CPJ 42.5" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Catégorie</Label>
                      <Select value={line.category} onValueChange={(v) => updateLine(index, { category: v as BtpItemCategory })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(BTP_ITEM_CATEGORY_LABELS).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Qté reçue</Label>
                      <Input type="number" min="0" step="0.01" value={line.qty} onChange={(e) => updateLine(index, { qty: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Unité</Label>
                      <Input value={line.unit} onChange={(e) => updateLine(index, { unit: e.target.value })} placeholder="sacs" />
                    </div>
                    <div className="sm:col-span-5 space-y-1">
                      <Label className="text-xs">Précision ligne</Label>
                      <Input value={line.description} onChange={(e) => updateLine(index, { description: e.target.value })} placeholder="Lot, qualité, référence…" />
                    </div>
                    {lines.length > 1 && (
                      <div className="flex items-end justify-end">
                        <Button type="button" variant="ghost" size="icon" onClick={() => setLines((p) => p.filter((_, i) => i !== index))}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 sm:col-span-2">
                <Switch checked={addToStock} onCheckedChange={setAddToStock} id="add-stock" />
                <Label htmlFor="add-stock">Ajouter les quantités reçues au stock (Matériels)</Label>
              </div>

              <div className="sm:col-span-2 flex gap-2">
                <Button type="submit" className="bg-[#2563EB]" disabled={!siteId}>Enregistrer</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Annuler</Button>
              </div>
            </form>
          </CardContent>
        </Card>
        )
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Rechercher..." className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {items.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <motion.div key={item.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Receipt className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{item.title}</h3>
                      <p className="text-sm text-muted-foreground truncate">{item.subtitle}</p>
                      {item.categoryLabel && (
                        <Badge variant="outline" className="text-[10px] mt-1">{item.categoryLabel}</Badge>
                      )}
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{item.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-[10px]">{item.status}</Badge>
                        {item.date && <span className="text-[10px] text-muted-foreground">{item.date}</span>}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Aucun bon enregistré.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
