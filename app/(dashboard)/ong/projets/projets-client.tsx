'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createNgoProject, updateNgoProject } from '@/lib/actions/ngo';
import { projectStatusLabel } from '@/lib/sector/status-labels';
import { formatCurrency } from '@/lib/utils';
import { FolderKanban, Pencil, Plus, Search } from 'lucide-react';
import { motion } from 'framer-motion';

export interface NgoProjectRow {
  id: string;
  name: string;
  region: string | null;
  locality: string | null;
  budget: number;
  spent: number;
  status: string;
  progress_pct: number;
  beneficiaries: number;
}

interface Props {
  projects: NgoProjectRow[];
  canEdit: boolean;
}

export function ProjetsClient({ projects: initialProjects, canEdit }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<NgoProjectRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('active');

  async function handleCreate(formData: FormData) {
    setError(null);
    formData.set('status', status);
    const result = await createNgoProject(formData);
    if (result.error) {
      setError(result.error);
      return;
    }
    setShowForm(false);
    router.refresh();
  }

  async function handleUpdate(formData: FormData) {
    if (!editing) return;
    setError(null);
    formData.set('id', editing.id);
    formData.set('status', status);
    const result = await updateNgoProject(formData);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEditing(null);
    router.refresh();
  }

  const projects = initialProjects.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      (p.region ?? '').toLowerCase().includes(query.toLowerCase())
  );

  function openEdit(p: NgoProjectRow) {
    setEditing(p);
    setStatus(p.status);
    setShowForm(false);
    setError(null);
  }

  const formFields = (prefix: 'create' | 'edit', defaults?: NgoProjectRow) => (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label>Nom du projet *</Label>
        <Input name="name" required defaultValue={defaults?.name} key={`${prefix}-name-${defaults?.id ?? 'new'}`} />
      </div>
      <div className="space-y-2">
        <Label>Région</Label>
        <Input name="region" defaultValue={defaults?.region ?? ''} key={`${prefix}-region-${defaults?.id ?? 'new'}`} />
      </div>
      <div className="space-y-2">
        <Label>Localité</Label>
        <Input name="locality" defaultValue={defaults?.locality ?? ''} key={`${prefix}-loc-${defaults?.id ?? 'new'}`} />
      </div>
      <div className="space-y-2">
        <Label>Budget (GNF)</Label>
        <Input name="budget" type="number" min="0" defaultValue={defaults?.budget ?? 0} key={`${prefix}-budget-${defaults?.id ?? 'new'}`} />
      </div>
      <div className="space-y-2">
        <Label>Dépensé (GNF)</Label>
        <Input name="spent" type="number" min="0" defaultValue={defaults?.spent ?? 0} key={`${prefix}-spent-${defaults?.id ?? 'new'}`} />
      </div>
      <div className="space-y-2">
        <Label>Bénéficiaires</Label>
        <Input name="beneficiaries" type="number" min="0" defaultValue={defaults?.beneficiaries ?? 0} key={`${prefix}-ben-${defaults?.id ?? 'new'}`} />
      </div>
      <div className="space-y-2">
        <Label>Avancement (%)</Label>
        <Input name="progress_pct" type="number" min="0" max="100" defaultValue={defaults?.progress_pct ?? 0} key={`${prefix}-prog-${defaults?.id ?? 'new'}`} />
      </div>
      <div className="space-y-2">
        <Label>Statut</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="planning">Planification</SelectItem>
            <SelectItem value="active">Actif</SelectItem>
            <SelectItem value="paused">En pause</SelectItem>
            <SelectItem value="completed">Terminé</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projets</h1>
          <p className="text-muted-foreground">
            {initialProjects.length} projet{initialProjects.length !== 1 ? 's' : ''} — budget et exécution
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => { setShowForm(!showForm); setEditing(null); }} className="bg-[#2563EB] hover:bg-[#2563EB]/90">
            <Plus className="h-4 w-4" /> Ajouter
          </Button>
        )}
      </div>

      {showForm && canEdit && (
        <Card>
          <CardHeader><CardTitle>Nouveau projet</CardTitle></CardHeader>
          <CardContent>
            {error && <p className="text-sm text-destructive mb-3">{error}</p>}
            <form action={handleCreate} className="space-y-4">
              {formFields('create')}
              <div className="flex gap-2">
                <Button type="submit" className="bg-[#2563EB]">Enregistrer</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Annuler</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {editing && canEdit && (
        <Card className="border-primary/30">
          <CardHeader><CardTitle>Modifier — {editing.name}</CardTitle></CardHeader>
          <CardContent>
            {error && <p className="text-sm text-destructive mb-3">{error}</p>}
            <form action={handleUpdate} className="space-y-4">
              {formFields('edit', editing)}
              <div className="flex gap-2">
                <Button type="submit" className="bg-[#2563EB]">Mettre à jour</Button>
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>Annuler</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Rechercher..." className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {projects.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p, index) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
              <Card className="hover:shadow-card-hover transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <FolderKanban className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{p.name}</h3>
                      <p className="text-sm text-muted-foreground truncate">
                        {p.region ?? '—'} · {formatCurrency(p.budget)} · dépensé {formatCurrency(p.spent)}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-[10px]">{projectStatusLabel(p.status)}</Badge>
                        <span className="text-[10px] text-muted-foreground">{p.progress_pct}% avancement</span>
                      </div>
                    </div>
                    {canEdit && (
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <FolderKanban className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Aucun projet.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
