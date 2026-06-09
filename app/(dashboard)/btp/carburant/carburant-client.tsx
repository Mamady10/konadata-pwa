'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { createBtpFuelLog } from '@/lib/actions/btp';
import { Fuel, Plus, Search } from 'lucide-react';
import { motion } from 'framer-motion';

interface Row {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  date?: string;
}

interface Props {
  items: Row[];
  sites: Array<{ id: string; name: string }>;
  totalLiters: number;
}

export function CarburantClient({ items: initialItems, sites, totalLiters }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [siteId, setSiteId] = useState('');
  const [isAnomaly, setIsAnomaly] = useState(false);

  async function handleCreate(formData: FormData) {
    setError(null);
    formData.set('site_id', siteId);
    formData.set('is_anomaly', isAnomaly ? 'true' : 'false');
    const result = await createBtpFuelLog(formData);
    if ('error' in result) {
      setError(result.error ?? 'Enregistrement impossible.');
      return;
    }
    setShowForm(false);
    router.refresh();
  }

  const items = initialItems.filter((i) =>
    i.title.toLowerCase().includes(query.toLowerCase()) || i.subtitle.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Carburant</h1>
            <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-200">Supabase connecté</Badge>
          </div>
          <p className="text-muted-foreground">Consommation totale : {totalLiters.toLocaleString('fr-FR')} litres</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="bg-[#2563EB] hover:bg-[#2563EB]/90" disabled={sites.length === 0}>
          <Plus className="h-4 w-4" /> Relevé
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>Nouveau relevé carburant</CardTitle></CardHeader>
          <CardContent>
            {error && <p className="text-sm text-destructive mb-3">{error}</p>}
            <form action={handleCreate} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Chantier *</Label>
                <Select value={siteId} onValueChange={setSiteId} required>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Litres *</Label><Input name="liters" type="number" min="0" step="0.1" required /></div>
              <div className="space-y-2"><Label>Coût (GNF)</Label><Input name="cost" type="number" min="0" /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Notes</Label><Input name="notes" /></div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <Switch checked={isAnomaly} onCheckedChange={setIsAnomaly} />
                <Label>Marquer comme anomalie</Label>
              </div>
              <div className="sm:col-span-2 flex gap-2">
                <Button type="submit" className="bg-[#2563EB]" disabled={!siteId}>Enregistrer</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Annuler</Button>
              </div>
            </form>
          </CardContent>
        </Card>
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
                      <Fuel className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{item.title}</h3>
                      <p className="text-sm text-muted-foreground truncate">{item.subtitle}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant={item.status === 'Alerte' ? 'destructive' : 'outline'} className="text-[10px]">{item.status}</Badge>
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
            <Fuel className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Aucun relevé carburant.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
