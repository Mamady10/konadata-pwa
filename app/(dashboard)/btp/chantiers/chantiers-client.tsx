'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { createBtpSite } from '@/lib/actions/btp';
import { HardHat, Plus, Search, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  BtpTaskPlanningEditor,
  defaultPlanningTasks,
  filledPlanningTasks,
} from '@/components/btp/btp-task-planning-editor';
import type { BtpPlanningTaskInput } from '@/lib/btp/planning-tasks';

interface SiteRow {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  date?: string;
  schedule?: { taskCount: number; projectTitle: string | null; importedAt: string };
}

interface Props {
  items: SiteRow[];
  description: string;
  canCreate: boolean;
}

export function ChantiersClient({ items: initialItems, description, canCreate }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [ref1Mode, setRef1Mode] = useState<'tasks' | 'linear'>('tasks');
  const [tasks, setTasks] = useState<BtpPlanningTaskInput[]>(defaultPlanningTasks);
  const [siteStartDate, setSiteStartDate] = useState('');
  const [siteEndDate, setSiteEndDate] = useState('');

  async function handleCreate(formData: FormData) {
    setError(null);
    formData.set('ref1_mode', ref1Mode);
    if (ref1Mode === 'tasks') {
      formData.set('tasks_json', JSON.stringify(filledPlanningTasks(tasks)));
    }
    const result = await createBtpSite(formData);
    if ('error' in result) {
      setError(result.error ?? 'Enregistrement impossible.');
      return;
    }
    setShowForm(false);
    setRef1Mode('tasks');
    setTasks(defaultPlanningTasks());
    setSiteStartDate('');
    setSiteEndDate('');
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
                    <Input
                      name="start_date"
                      type="date"
                      required
                      onChange={(e) => {
                        const start = e.target.value;
                        setSiteStartDate(start);
                        setTasks((list) =>
                          list.length > 0 && !list[0].startDate
                            ? [{ ...list[0], startDate: start }, ...list.slice(1)]
                            : list
                        );
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Date de fin prévue *</Label>
                    <Input
                      name="end_date"
                      type="date"
                      required
                      onChange={(e) => setSiteEndDate(e.target.value)}
                    />
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
                  <Label className="text-sm font-semibold">Planning des travaux</Label>
                  <p className="text-xs text-muted-foreground">
                    Saisissez les tâches avec leurs dates : KonaData calcule la durée, le poids de chaque
                    tâche et l&apos;avancement prévu. Un planning MS Project peut aussi être importé après
                    création (réf. 1 ou 2).
                  </p>
                  <div className="space-y-2">
                    <Label className="text-xs">Mode référence 1 à la création</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={ref1Mode}
                      onChange={(e) => setRef1Mode(e.target.value === 'linear' ? 'linear' : 'tasks')}
                    >
                      <option value="tasks">Tâches (début, fin, durée)</option>
                      <option value="linear">Dates début / fin du chantier uniquement</option>
                    </select>
                  </div>
                  {ref1Mode === 'tasks' && (
                    <BtpTaskPlanningEditor
                      tasks={tasks}
                      onChange={setTasks}
                      siteStartDate={siteStartDate || undefined}
                      siteEndDate={siteEndDate || undefined}
                    />
                  )}
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
              <Link href={`/btp/chantiers/${item.id}`}>
                <Card className="hover:shadow-card-hover transition-shadow cursor-pointer h-full">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
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
                        <p className="text-xs text-primary mt-3 flex items-center gap-1 font-medium">
                          Ouvrir la fiche
                          <ChevronRight className="h-3.5 w-3.5" />
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
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
