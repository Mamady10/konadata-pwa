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
import {
  recordBtpStockEntry,
  recordBtpStockExit,
  updateBtpStockThreshold,
  loadBtpStockMovements,
  exportBtpStockMovementsCsv,
  type BtpStockMovementRow,
} from '@/lib/actions/btp-stock';
import { BTP_ITEM_CATEGORY_LABELS, type BtpItemCategory } from '@/lib/btp/delivery-note-types';
import { ArrowDownToLine, ArrowUpFromLine, Download, Settings2 } from 'lucide-react';

interface StockRow {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  category: string | null;
  alertLevel: string;
  minThreshold: number;
  siteName: string;
}

interface PersonnelOption {
  id: string;
  name: string;
  role: string;
}

interface Props {
  stock: StockRow[];
  movements: BtpStockMovementRow[];
  movementsTotal: number;
  sites: Array<{ id: string; name: string }>;
  personnel: PersonnelOption[];
  equipmentItems: Array<{ id: string; title: string; subtitle: string; status: string }>;
}

export function MaterielsClient({ stock, movements: initialMovements, movementsTotal: initialTotal, sites, personnel, equipmentItems }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showInForm, setShowInForm] = useState(false);
  const [showOutForm, setShowOutForm] = useState(false);
  const [inCategory, setInCategory] = useState<BtpItemCategory>('materials');
  const [inSiteId, setInSiteId] = useState('');
  const [outStockId, setOutStockId] = useState('');
  const [outSiteId, setOutSiteId] = useState('');
  const [outPersonnelId, setOutPersonnelId] = useState('');
  const [movements, setMovements] = useState(initialMovements);
  const [movementsTotal, setMovementsTotal] = useState(initialTotal);
  const [movFilter, setMovFilter] = useState<'all' | 'in' | 'out'>('all');
  const [movSiteId, setMovSiteId] = useState('');
  const [movOffset, setMovOffset] = useState(0);
  const [editingThreshold, setEditingThreshold] = useState<string | null>(null);
  const [thresholdValue, setThresholdValue] = useState('');

  async function handleIn(formData: FormData) {
    setError(null);
    formData.set('category', inCategory);
    if (inSiteId) formData.set('site_id', inSiteId);
    const result = await recordBtpStockEntry(formData);
    if ('error' in result) {
      setError(result.error ?? 'Entrée impossible.');
      return;
    }
    setShowInForm(false);
    router.refresh();
  }

  async function handleOut(formData: FormData) {
    setError(null);
    formData.set('stock_id', outStockId);
    formData.set('site_id', outSiteId);
    formData.set('personnel_id', outPersonnelId);
    const result = await recordBtpStockExit(formData);
    if ('error' in result) {
      setError(result.error ?? 'Sortie impossible.');
      return;
    }
    setShowOutForm(false);
    router.refresh();
  }

  const selectedStock = stock.find((s) => s.id === outStockId);

  async function applyMovementFilters(reset = true) {
    const offset = reset ? 0 : movOffset;
    const result = await loadBtpStockMovements({
      movementType: movFilter,
      siteId: movSiteId || undefined,
      limit: 40,
      offset,
    });
    if (reset) {
      setMovements(result.rows);
      setMovOffset(40);
    } else {
      setMovements((prev) => [...prev, ...result.rows]);
      setMovOffset(offset + 40);
    }
    setMovementsTotal(result.total);
  }

  async function handleSaveThreshold(stockId: string) {
    setError(null);
    const result = await updateBtpStockThreshold(stockId, Number(thresholdValue) || 0);
    if ('error' in result) {
      setError(result.error ?? 'Mise à jour impossible.');
      return;
    }
    setEditingThreshold(null);
    router.refresh();
  }

  async function downloadMovementsCsv() {
    const csv = await exportBtpStockMovementsCsv({
      movementType: movFilter,
      siteId: movSiteId || undefined,
    });
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mouvements-stock-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Matériels & stock</h1>
          <p className="text-muted-foreground">Entrées, sorties par chantier et historique des mouvements</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadMovementsCsv}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button onClick={() => { setShowInForm(!showInForm); setShowOutForm(false); }} className="bg-emerald-700 hover:bg-emerald-800">
            <ArrowDownToLine className="h-4 w-4" /> Entrée stock
          </Button>
          <Button variant="outline" onClick={() => { setShowOutForm(!showOutForm); setShowInForm(false); }} disabled={stock.length === 0}>
            <ArrowUpFromLine className="h-4 w-4" /> Sortie stock
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/10 p-3">{error}</p>}

      {showInForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Entrée en stock</CardTitle></CardHeader>
          <CardContent>
            <form action={handleIn} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2"><Label>Article *</Label><Input name="item_name" required placeholder="Ciment CPJ 42.5" /></div>
              <div className="space-y-2"><Label>Quantité reçue *</Label><Input name="quantity" type="number" min="0.01" step="0.01" required /></div>
              <div className="space-y-2"><Label>Unité</Label><Input name="unit" placeholder="sacs, m³, tonnes…" /></div>
              <div className="space-y-2">
                <Label>Catégorie</Label>
                <Select value={inCategory} onValueChange={(v) => setInCategory(v as BtpItemCategory)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(BTP_ITEM_CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Chantier (optionnel)</Label>
                <Select value={inSiteId || 'none'} onValueChange={(v) => setInSiteId(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Dépôt central" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Dépôt central —</SelectItem>
                    {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Date</Label><Input name="movement_date" type="date" /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Notes</Label><Input name="notes" placeholder="BL, fournisseur, lot…" /></div>
              <div className="sm:col-span-2 flex gap-2">
                <Button type="submit" className="bg-emerald-700">Enregistrer l&apos;entrée</Button>
                <Button type="button" variant="outline" onClick={() => setShowInForm(false)}>Annuler</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {showOutForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Sortie de stock</CardTitle></CardHeader>
          <CardContent>
            <form action={handleOut} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Article *</Label>
                <Select value={outStockId} onValueChange={setOutStockId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {stock.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} — {s.quantity} {s.unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Quantité sortie *</Label>
                <Input name="quantity" type="number" min="0.01" step="0.01" required max={selectedStock?.quantity} />
                {selectedStock && (
                  <p className="text-xs text-muted-foreground">Disponible : {selectedStock.quantity} {selectedStock.unit}</p>
                )}
              </div>
              <div className="space-y-2"><Label>Date</Label><Input name="movement_date" type="date" /></div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Chantier concerné *</Label>
                <Select value={outSiteId} onValueChange={setOutSiteId}>
                  <SelectTrigger><SelectValue placeholder="Chantier" /></SelectTrigger>
                  <SelectContent>
                    {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Demandeur (personnel)</Label>
                <Select value={outPersonnelId || 'none'} onValueChange={(v) => setOutPersonnelId(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Collaborateur" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Saisir un nom ci-dessous —</SelectItem>
                    {personnel.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} — {p.role}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Nom du demandeur {outPersonnelId ? '(optionnel)' : '*'}</Label>
                <Input name="requester_name" placeholder="Ex. : Chef de chantier" disabled={!!outPersonnelId} required={!outPersonnelId} />
              </div>
              <div className="space-y-2 sm:col-span-2"><Label>Motif / notes</Label><Input name="notes" placeholder="Usage sur chantier, n° BL interne…" /></div>
              <div className="sm:col-span-2 flex gap-2">
                <Button type="submit" className="bg-[#2563EB]" disabled={!outStockId || !outSiteId}>Enregistrer la sortie</Button>
                <Button type="button" variant="outline" onClick={() => setShowOutForm(false)}>Annuler</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">Stock actuel</TabsTrigger>
          <TabsTrigger value="mouvements">Mouvements</TabsTrigger>
          <TabsTrigger value="equipements">Équipements</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stock.length === 0 ? (
            <p className="text-sm text-muted-foreground col-span-full">Aucun article en stock. Utilisez une entrée ou un bon de livraison.</p>
          ) : (
            stock.map((s) => (
              <Card key={s.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.siteName}</p>
                      <p className="text-lg font-semibold mt-1">{s.quantity.toLocaleString('fr-FR')} <span className="text-sm font-normal text-muted-foreground">{s.unit}</span></p>
                      {s.category && <Badge variant="outline" className="text-[10px] mt-2">{BTP_ITEM_CATEGORY_LABELS[s.category as BtpItemCategory] ?? s.category}</Badge>}
                      <p className="text-xs text-muted-foreground mt-2">Seuil alerte : {s.minThreshold.toLocaleString('fr-FR')}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={s.alertLevel === 'critical' ? 'destructive' : s.alertLevel === 'warning' ? 'secondary' : 'outline'}>
                        {s.alertLevel === 'critical' ? 'Critique' : s.alertLevel === 'warning' ? 'Alerte' : 'OK'}
                      </Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditingThreshold(editingThreshold === s.id ? null : s.id);
                          setThresholdValue(String(s.minThreshold));
                        }}
                      >
                        <Settings2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {editingThreshold === s.id && (
                    <div className="flex gap-2 mt-3 pt-3 border-t">
                      <Input
                        type="number"
                        min="0"
                        className="h-9"
                        value={thresholdValue}
                        onChange={(e) => setThresholdValue(e.target.value)}
                        placeholder="Seuil minimum"
                      />
                      <Button size="sm" onClick={() => handleSaveThreshold(s.id)}>OK</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="mouvements" className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select value={movFilter} onValueChange={(v) => setMovFilter(v as 'all' | 'in' | 'out')}>
                <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="in">Entrées</SelectItem>
                  <SelectItem value="out">Sorties</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Chantier</Label>
              <Select value={movSiteId || 'all'} onValueChange={(v) => setMovSiteId(v === 'all' ? '' : v)}>
                <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Tous" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => applyMovementFilters(true)}>Filtrer</Button>
          </div>
          {movements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun mouvement enregistré.</p>
          ) : (
            movements.map((m) => (
              <Card key={m.id}>
                <CardContent className="p-4 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    {m.movementType === 'in' ? (
                      <ArrowDownToLine className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <ArrowUpFromLine className="h-4 w-4 text-amber-600" />
                    )}
                    <span className="font-medium">{m.itemName}</span>
                    <span>{m.movementType === 'in' ? '+' : '−'}{m.quantity} {m.unit}</span>
                  </div>
                  <div className="text-muted-foreground text-xs text-right">
                    {new Date(m.movementDate).toLocaleDateString('fr-FR')}
                    {m.siteName && ` · ${m.siteName}`}
                    {m.requesterLabel && ` · ${m.requesterLabel}`}
                    {m.notes && ` · ${m.notes}`}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
          {movements.length < movementsTotal && (
            <Button variant="outline" className="w-full" onClick={() => applyMovementFilters(false)}>
              Charger plus ({movements.length} / {movementsTotal})
            </Button>
          )}
        </TabsContent>

        <TabsContent value="equipements" className="mt-4 grid gap-3 sm:grid-cols-2">
          {equipmentItems.length === 0 ? (
            <p className="text-sm text-muted-foreground col-span-full">Aucun équipement enregistré.</p>
          ) : (
            equipmentItems.map((e) => (
              <Card key={e.id}>
                <CardContent className="p-4">
                  <p className="font-medium">{e.title}</p>
                  <p className="text-sm text-muted-foreground">{e.subtitle}</p>
                  <Badge variant="outline" className="text-[10px] mt-2">{e.status}</Badge>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
