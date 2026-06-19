'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable } from '@/components/dashboard/data-table';
import { BtpPlannedVsActualPanel } from '@/components/btp/btp-planned-vs-actual-panel';
import { recordBtpSiteProgress } from '@/lib/actions/btp';
import type { BtpDailyProgressRow, BtpSiteProgressRow } from '@/lib/actions/btp';
import type { BtpPlannedProgressSnapshot } from '@/lib/btp/site-baseline-types';
import { kpiStatusLabel } from '@/lib/btp/site-baseline';
import { TrendingUp, Plus, Search } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  sites: BtpSiteProgressRow[];
  history: BtpDailyProgressRow[];
  canEditFinancial: boolean;
  description: string;
}

export function AvancementClient({
  sites,
  history,
  canEditFinancial,
  description,
}: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [siteId, setSiteId] = useState('');
  const [progressDate, setProgressDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [physicalPct, setPhysicalPct] = useState(0);
  const [planningRefSlot, setPlanningRefSlot] = useState<1 | 2>(1);
  const [lastSavedComparison, setLastSavedComparison] = useState<BtpPlannedProgressSnapshot | null>(null);

  const selectedSite = useMemo(
    () => sites.find((s) => s.id === siteId),
    [sites, siteId]
  );

  useEffect(() => {
    if (selectedSite) {
      setPhysicalPct(selectedSite.physicalProgress);
      setPlanningRefSlot(selectedSite.defaultPlanningRefSlot);
    }
  }, [selectedSite]);

  async function handleSubmit(formData: FormData) {
    setError(null);
    if (!siteId) {
      setError('Choisissez un chantier.');
      return;
    }
    formData.set('site_id', siteId);
    const result = await recordBtpSiteProgress(formData);
    if ('error' in result) {
      setError(result.error ?? 'Enregistrement impossible.');
      return;
    }
    if ('comparison' in result && result.comparison) {
      setLastSavedComparison(result.comparison);
    }
    setShowForm(false);
    setSiteId('');
    router.refresh();
  }

  const filteredSites = sites.filter(
    (s) =>
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      (s.location ?? '').toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Avancement</h1>
            <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-200">
              Saisie terrain
            </Badge>
          </div>
          <p className="text-muted-foreground">{description}</p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="bg-[#2563EB] hover:bg-[#2563EB]/90"
          disabled={sites.length === 0}
        >
          <Plus className="h-4 w-4" /> Saisir l&apos;avancement
        </Button>
      </div>

      {sites.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm">
          Aucun chantier assigné. Demandez à la direction de vous rattacher dans Utilisateurs →
          Assignations.
        </div>
      )}

      {lastSavedComparison && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 text-sm">
          <p className="font-medium text-emerald-800">Relevé enregistré</p>
          <p className="text-emerald-700 mt-1">
            Planifié {lastSavedComparison.plannedPct} % — écart{' '}
            {lastSavedComparison.gapPts >= 0 ? '+' : ''}
            {lastSavedComparison.gapPts} pt ({kpiStatusLabel(lastSavedComparison.status)})
          </p>
        </div>
      )}

      {showForm && sites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Nouveau relevé d&apos;avancement</CardTitle>
          </CardHeader>
          <CardContent>
            {error && <p className="text-sm text-destructive mb-3">{error}</p>}
            <form action={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Chantier *</Label>
                <Select
                  value={siteId}
                  onValueChange={setSiteId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un chantier" />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                        {s.location ? ` — ${s.location}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Date du relevé *</Label>
                <Input
                  name="progress_date"
                  type="date"
                  value={progressDate}
                  onChange={(e) => setProgressDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Avancement physique (%) *</Label>
                <Input
                  name="physical_pct"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  required
                  value={physicalPct}
                  onChange={(e) => setPhysicalPct(Number(e.target.value) || 0)}
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Référence planning</Label>
                <Select
                  value={String(planningRefSlot)}
                  onValueChange={(v) => setPlanningRefSlot(v === '2' ? 2 : 1)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Référence 1</SelectItem>
                    <SelectItem value="2">Référence 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <BtpPlannedVsActualPanel
                siteId={siteId}
                progressDate={progressDate}
                physicalPct={physicalPct}
                refSlot={planningRefSlot}
              />

              {canEditFinancial && (
                <>
                  <div className="space-y-2">
                    <Label>Avancement financier (%)</Label>
                    <Input
                      name="financial_pct"
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      defaultValue={selectedSite?.financialProgress ?? 0}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Retard (jours)</Label>
                    <Input
                      name="delay_days"
                      type="number"
                      min={0}
                      defaultValue={selectedSite?.delayDays ?? 0}
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label>Effectif sur chantier</Label>
                <Input name="workers_count" type="number" min={0} placeholder="Optionnel" />
              </div>

              <div className="space-y-2">
                <Label>Météo</Label>
                <Input name="weather" placeholder="Ex. Ensoleillé, pluie..." />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Observations</Label>
                <Input name="notes" placeholder="Travaux réalisés, blocages..." />
              </div>

              <div className="sm:col-span-2 flex gap-2">
                <Button type="submit" className="bg-[#2563EB]" disabled={!siteId}>
                  Enregistrer
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
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
          placeholder="Rechercher un chantier..."
          className="pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filteredSites.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSites.map((site, index) => (
            <motion.div
              key={site.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
            >
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <TrendingUp className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{site.name}</h3>
                      <p className="text-sm text-muted-foreground truncate">
                        {site.location ?? '—'}
                      </p>
                      <p className="text-sm mt-2">
                        Physique <strong>{site.physicalProgress}%</strong>
                        {' · '}
                        Financier <strong>{site.financialProgress}%</strong>
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-[10px]">
                          {site.statusLabel}
                        </Badge>
                        {site.hasMsProjectSchedule && (
                          <Badge variant="secondary" className="text-[10px] bg-blue-500/10 text-blue-700">
                            MS Project
                          </Badge>
                        )}
                        {site.delayDays > 0 && (
                          <span className="text-[10px] text-amber-700">
                            Retard {site.delayDays}j
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        sites.length > 0 && (
          <p className="text-sm text-muted-foreground">Aucun chantier ne correspond à la recherche.</p>
        )
      )}

      <DataTable
        title="Historique des relevés"
        data={history.map((h) => ({
          id: h.id,
          date: new Date(h.progressDate).toLocaleDateString('fr-FR'),
          chantier: h.siteName,
          physique: `${h.physicalPct}%`,
          effectif: h.workersCount != null ? String(h.workersCount) : '—',
          detail: [h.weather, h.notes].filter(Boolean).join(' — ') || '—',
        }))}
        columns={[
          { key: 'date', label: 'Date' },
          { key: 'chantier', label: 'Chantier' },
          { key: 'physique', label: 'Physique' },
          { key: 'effectif', label: 'Effectif' },
          { key: 'detail', label: 'Notes / météo' },
        ]}
      />
    </div>
  );
}
