'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createBtpPersonnel } from '@/lib/actions/btp';
import { createBtpLaborEntry } from '@/lib/actions/btp-financial';
import { formatCurrency } from '@/lib/utils';
import { Users, Plus, Search, CalendarDays } from 'lucide-react';
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
  laborEntries: Array<{
    id: string;
    siteName: string;
    personName: string;
    workDate: string;
    days: number;
    amount: number;
  }>;
  personnelForLabor: Array<{ id: string; name: string; dailyRate: number; siteName?: string }>;
}

export function PersonnelClient({ items: initialItems, sites, laborEntries, personnelForLabor }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [showLaborForm, setShowLaborForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [siteId, setSiteId] = useState('none');
  const [laborSiteId, setLaborSiteId] = useState('');
  const [personnelId, setPersonnelId] = useState('');

  async function handleCreate(formData: FormData) {
    setError(null);
    formData.set('site_id', siteId);
    const result = await createBtpPersonnel(formData);
    if ('error' in result) {
      setError(result.error ?? 'Enregistrement impossible.');
      return;
    }
    setShowForm(false);
    router.refresh();
  }

  async function handleLabor(formData: FormData) {
    setError(null);
    formData.set('site_id', laborSiteId);
    formData.set('personnel_id', personnelId);
    const result = await createBtpLaborEntry(formData);
    if ('error' in result) {
      setError(result.error ?? 'Pointage impossible.');
      return;
    }
    setShowLaborForm(false);
    router.refresh();
  }

  const items = initialItems.filter((i) =>
    i.title.toLowerCase().includes(query.toLowerCase()) || i.subtitle.toLowerCase().includes(query.toLowerCase())
  );

  const activeCount = initialItems.filter((i) => i.status === 'Actif').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Personnel</h1>
            <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-200">Supabase connecté</Badge>
          </div>
          <p className="text-muted-foreground">{activeCount} collaborateur(s) actif(s)</p>
        </div>
        <div className="flex gap-2 flex-wrap">
        <Button onClick={() => setShowForm(!showForm)} className="bg-[#2563EB] hover:bg-[#2563EB]/90">
          <Plus className="h-4 w-4" /> Ajouter
        </Button>
        <Button variant="outline" onClick={() => setShowLaborForm(!showLaborForm)} disabled={personnelForLabor.length === 0}>
          <CalendarDays className="h-4 w-4" /> Pointage
        </Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>Nouveau collaborateur</CardTitle></CardHeader>
          <CardContent>
            {error && <p className="text-sm text-destructive mb-3">{error}</p>}
            <form action={handleCreate} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Nom complet *</Label><Input name="full_name" required /></div>
              <div className="space-y-2"><Label>Rôle *</Label><Input name="role" placeholder="Maçon, Chef d'équipe…" required /></div>
              <div className="space-y-2"><Label>Téléphone</Label><Input name="phone" /></div>
              <div className="space-y-2"><Label>Taux journalier (GNF)</Label><Input name="daily_rate" type="number" min="0" /></div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Chantier</Label>
                <Select value={siteId} onValueChange={setSiteId}>
                  <SelectTrigger><SelectValue placeholder="Chantier" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Non assigné —</SelectItem>
                    {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 flex gap-2">
                <Button type="submit" className="bg-[#2563EB]">Enregistrer</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Annuler</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {showLaborForm && (
        <Card>
          <CardHeader><CardTitle>Pointage main d&apos;oeuvre</CardTitle></CardHeader>
          <CardContent>
            {error && <p className="text-sm text-destructive mb-3">{error}</p>}
            <form action={handleLabor} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Chantier *</Label>
                <Select value={laborSiteId} onValueChange={setLaborSiteId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Collaborateur *</Label>
                <Select value={personnelId} onValueChange={setPersonnelId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {personnelForLabor.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — {formatCurrency(p.dailyRate)}/j
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Date *</Label><Input name="work_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></div>
              <div className="space-y-2"><Label>Jours *</Label><Input name="days" type="number" min="0.5" step="0.5" defaultValue="1" required /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Notes</Label><Input name="notes" /></div>
              <div className="sm:col-span-2 flex gap-2">
                <Button type="submit" className="bg-[#2563EB]" disabled={!laborSiteId || !personnelId}>Enregistrer</Button>
                <Button type="button" variant="outline" onClick={() => setShowLaborForm(false)}>Annuler</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {laborEntries.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Derniers pointages</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {laborEntries.slice(0, 8).map((e) => (
              <div key={e.id} className="flex flex-wrap justify-between gap-2 text-sm border-b pb-2 last:border-0">
                <span>{e.personName} — {e.siteName}</span>
                <span className="text-muted-foreground">
                  {new Date(e.workDate).toLocaleDateString('fr-FR')} · {e.days} j · {formatCurrency(e.amount)}
                </span>
              </div>
            ))}
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
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{item.title}</h3>
                      <p className="text-sm text-muted-foreground truncate">{item.subtitle}</p>
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
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Aucun personnel enregistré.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
