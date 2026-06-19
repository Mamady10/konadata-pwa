'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { createBtpSite } from '@/lib/actions/btp';
import { HardHat, Plus, Search, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import type { BtpSiteMilestoneInput } from '@/lib/btp/site-baseline-types';

import { BtpPlanningRefEditor } from '@/components/btp/btp-planning-ref-editor';
import type { BtpSitePlanningRef } from '@/lib/btp/planning-ref';

interface SiteRow {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  date?: string;
  schedule?: { taskCount: number; projectTitle: string | null; importedAt: string };
  planningRefs: BtpSitePlanningRef[];
  defaultPlanningRefSlot: 1 | 2;
}

interface Props {
  items: SiteRow[];
  description: string;
  canCreate: boolean;
}

const EMPTY_MILESTONE: BtpSiteMilestoneInput = {
  label: '',
  targetPhysicalPct: 25,
  plannedDate: '',
};

export function ChantiersClient({ items: initialItems, description, canCreate }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [milestones, setMilestones] = useState<BtpSiteMilestoneInput[]>([
    { ...EMPTY_MILESTONE, label: 'Fondations', targetPhysicalPct: 15 },
    { ...EMPTY_MILESTONE, label: 'Gros oeuvre', targetPhysicalPct: 50 },
    { ...EMPTY_MILESTONE, label: 'Finitions', targetPhysicalPct: 100 },
  ]);

  async function handleCreate(formData: FormData) {
    setError(null);
    formData.set(
      'milestones_json',
      JSON.stringify(milestones.filter((m) => m.label.trim() && m.plannedDate))
    );
    const result = await createBtpSite(formData);
    if ('error' in result) {
      setError(result.error ?? 'Enregistrement impossible.');
      return;
    }
    setShowForm(false);
    setMilestones([
      { ...EMPTY_MILESTONE, label: 'Fondations', targetPhysicalPct: 15 },
      { ...EMPTY_MILESTONE, label: 'Gros oeuvre', targetPhysicalPct: 50 },
      { ...EMPTY_MILESTONE, label: 'Finitions', targetPhysicalPct: 100 },
    ]);
    router.refresh();
  }

  const items = initialItems.filter(
    (i) =>
      i.title.toLowerCase().includes(query.toLowerCase()) ||
      i.subtitle.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Chantiers</h1>
            <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-200">
              Supabase connecté
            </Badge>
          </div>
          <p className="text-muted-foreground">{description}</p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          disabled={!canCreate}
          className="bg-[#2563EB] hover:bg-[#2563EB]/90"
        >
          <Plus className="h-4 w-4" /> Ajouter
        </Button>
      </div>

      {showForm && (
        <Card className="border-blue-200/60">
          <CardHeader>
            <CardTitle>Nouveau chantier</CardTitle>
            <CardDescription>
              Niveau A : planning et jalons · Niveau B : budget détaillé et ressources prévues — alimentent
              les graphiques comparatifs du rapport hebdomadaire.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && <p className="text-sm text-destructive mb-3">{error}</p>}
            <form action={handleCreate} className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-primary">Niveau A — Identification & planning</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Nom du chantier *</Label>
                    <Input name="name" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Localisation</Label>
                    <Input name="location" placeholder="Ville, quartier…" />
                  </div>
                  <div className="space-y-2">
                    <Label>Client / MOA</Label>
                    <Input name="client" placeholder="Maître d'ouvrage" />
                  </div>
                  <div className="space-y-2">
                    <Label>N° marché / contrat</Label>
                    <Input name="contract_ref" />
                  </div>
                  <div className="space-y-2">
                    <Label>Date de début *</Label>
                    <Input name="start_date" type="date" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Date de fin prévue *</Label>
                    <Input name="end_date" type="date" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Budget total (GNF) *</Label>
                    <Input name="budget" type="number" min="0" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Déjà engagé au démarrage (GNF)</Label>
                    <Input name="opening_spent" type="number" min="0" defaultValue="0" />
                  </div>
                </div>

                <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Jalons du planning</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setMilestones((m) => [...m, { ...EMPTY_MILESTONE }])}
                    >
                      <Plus className="h-3.5 w-3.5" /> Jalon
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Choisissez le mode de la référence 1 : dates seules (linéaire), jalons détaillés, ou
                    import MS Project après création (réf. 1 ou 2).
                  </p>
                  <div className="space-y-2">
                    <Label className="text-xs">Mode référence 1 à la création</Label>
                    <select
                      name="ref1_mode"
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      defaultValue={milestones.length > 1 ? 'milestones' : 'linear'}
                      onChange={(e) => {
                        if (e.target.value === 'linear') {
                          setMilestones([{ ...EMPTY_MILESTONE }]);
                        }
                      }}
                    >
                      <option value="linear">Dates début / fin uniquement</option>
                      <option value="milestones">Jalons KonaData (ci-dessous)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    {milestones.map((m, i) => (
                      <div key={i} className="grid gap-2 sm:grid-cols-[1fr_100px_140px_auto] items-end">
                        <Input
                          placeholder="Phase (ex. Fondations)"
                          value={m.label}
                          onChange={(e) => {
                            const next = [...milestones];
                            next[i] = { ...next[i], label: e.target.value };
                            setMilestones(next);
                          }}
                        />
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          placeholder="%"
                          value={m.targetPhysicalPct}
                          onChange={(e) => {
                            const next = [...milestones];
                            next[i] = { ...next[i], targetPhysicalPct: Number(e.target.value) };
                            setMilestones(next);
                          }}
                        />
                        <Input
                          type="date"
                          value={m.plannedDate}
                          onChange={(e) => {
                            const next = [...milestones];
                            next[i] = { ...next[i], plannedDate: e.target.value };
                            setMilestones(next);
                          }}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground"
                          onClick={() => setMilestones((list) => list.filter((_, j) => j !== i))}
                          disabled={milestones.length <= 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3 border-t pt-4">
                <h3 className="text-sm font-semibold text-primary">Niveau B — Budget détaillé & ressources</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Description du projet</Label>
                    <textarea
                      name="description"
                      rows={2}
                      placeholder="Pont, route, bâtiment… périmètre en une phrase"
                      className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Destinataire rapport MOA</Label>
                    <Input name="moa_recipient" placeholder="Nom du représentant" />
                  </div>
                  <div className="space-y-2">
                    <Label>Seuil alerte budget (%)</Label>
                    <Input name="budget_alert_pct" type="number" min={50} max={100} defaultValue={90} />
                  </div>
                  <div className="space-y-2">
                    <Label>Effectif moyen prévu / jour</Label>
                    <Input name="planned_avg_workers" type="number" min={0} />
                  </div>
                  <div className="space-y-2">
                    <Label>Carburant prévu (L / mois)</Label>
                    <Input name="planned_monthly_fuel_liters" type="number" min={0} />
                  </div>
                </div>
                <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                  <Label className="text-sm font-semibold">Répartition budgétaire (%)</Label>
                  <div className="grid gap-3 sm:grid-cols-5">
                    <div className="space-y-1">
                      <Label className="text-xs">Main d&apos;oeuvre</Label>
                      <Input name="budget_labor" type="number" min={0} defaultValue={25} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Matériaux</Label>
                      <Input name="budget_materials" type="number" min={0} defaultValue={40} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Engins</Label>
                      <Input name="budget_equipment" type="number" min={0} defaultValue={15} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Sous-traitance</Label>
                      <Input name="budget_subcontract" type="number" min={0} defaultValue={10} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Frais généraux</Label>
                      <Input name="budget_overhead" type="number" min={0} defaultValue={10} />
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Avancement physique initial (%)</Label>
                    <Input name="physical_progress" type="number" min={0} max={100} defaultValue={0} />
                  </div>
                  <div className="space-y-2">
                    <Label>Avancement financier initial (%)</Label>
                    <Input name="financial_progress" type="number" min={0} max={100} defaultValue={0} />
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="bg-[#2563EB]">Enregistrer le chantier</Button>
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
          placeholder="Rechercher dans chantiers..."
          className="pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {items.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="hover:shadow-card-hover transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <HardHat className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{item.title}</h3>
                      <p className="text-sm text-muted-foreground truncate">{item.subtitle}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-[10px]">
                          {item.status}
                        </Badge>
                        {item.date && (
                          <span className="text-[10px] text-muted-foreground">{item.date}</span>
                        )}
                        {item.schedule && (
                          <Badge variant="secondary" className="text-[10px] bg-blue-500/10 text-blue-700">
                            MS Project · {item.schedule.taskCount} tâches
                          </Badge>
                        )}
                      </div>
                      {canCreate && (
                        <div className="mt-3 space-y-1">
                          <BtpPlanningRefEditor
                            siteId={item.id}
                            siteName={item.title}
                            slot={1}
                            refData={item.planningRefs.find((r) => r.slot === 1)}
                            isDefaultRef={item.defaultPlanningRefSlot === 1}
                            canManage={canCreate}
                          />
                          <BtpPlanningRefEditor
                            siteId={item.id}
                            siteName={item.title}
                            slot={2}
                            refData={item.planningRefs.find((r) => r.slot === 2)}
                            isDefaultRef={item.defaultPlanningRefSlot === 2}
                            canManage={canCreate}
                          />
                        </div>
                      )}
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
            <HardHat className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Aucun chantier. Cliquez sur Ajouter pour en créer un avec planning et jalons.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
