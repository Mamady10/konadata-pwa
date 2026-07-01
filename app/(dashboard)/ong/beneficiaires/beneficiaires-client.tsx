'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createNgoBeneficiary, updateNgoBeneficiary } from '@/lib/actions/ngo';
import { Heart, Mail, Phone, Pencil, Plus, Search } from 'lucide-react';
import { motion } from 'framer-motion';

export interface BeneficiaryItem {
  id: string;
  fullName: string;
  gender: string | null;
  email: string | null;
  phone: string | null;
  region: string | null;
  locality: string | null;
  category: string | null;
  projectId: string | null;
  projectName: string | null;
  subtitle: string;
  contact: string;
}

interface Props {
  items: BeneficiaryItem[];
  projects: Array<{ id: string; name: string }>;
}

function BeneficiaryForm({
  defaults,
  projects,
  gender,
  setGender,
  projectId,
  setProjectId,
  onCancel,
  onSubmit,
  title,
}: {
  defaults?: BeneficiaryItem;
  projects: Array<{ id: string; name: string }>;
  gender: string;
  setGender: (v: string) => void;
  projectId: string;
  setProjectId: (v: string) => void;
  onCancel: () => void;
  onSubmit: (fd: FormData) => Promise<void>;
  title: string;
}) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        <form
          action={onSubmit}
          className="grid gap-4 sm:grid-cols-2"
        >
          {defaults && <input type="hidden" name="id" value={defaults.id} />}
          <div className="space-y-2 sm:col-span-2">
            <Label>Nom complet *</Label>
            <Input name="full_name" required defaultValue={defaults?.fullName} />
          </div>
          <div className="space-y-2">
            <Label>Genre</Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="M">Homme</SelectItem>
                <SelectItem value="F">Femme</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Téléphone</Label>
            <Input name="phone" defaultValue={defaults?.phone ?? ''} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input name="email" type="email" defaultValue={defaults?.email ?? ''} />
          </div>
          <div className="space-y-2">
            <Label>Projet / activité</Label>
            <Select value={projectId || 'none'} onValueChange={(v) => setProjectId(v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="project_id" value={projectId} />
          </div>
          <div className="space-y-2">
            <Label>Région</Label>
            <Input name="region" defaultValue={defaults?.region ?? ''} />
          </div>
          <div className="space-y-2">
            <Label>Localité</Label>
            <Input name="locality" defaultValue={defaults?.locality ?? ''} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Catégorie</Label>
            <Input name="category" placeholder="Famille, Enfant…" defaultValue={defaults?.category ?? ''} />
          </div>
          <div className="sm:col-span-2 flex gap-2">
            <Button type="submit" className="bg-[#2563EB]">Enregistrer</Button>
            <Button type="button" variant="outline" onClick={onCancel}>Annuler</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function BeneficiairesClient({ items: initialItems, projects }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BeneficiaryItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [gender, setGender] = useState('');
  const [projectId, setProjectId] = useState('');

  async function handleCreate(formData: FormData) {
    setError(null);
    if (gender) formData.set('gender', gender);
    const result = await createNgoBeneficiary(formData);
    if (result.error) { setError(result.error); return; }
    setShowForm(false);
    router.refresh();
  }

  async function handleUpdate(formData: FormData) {
    setError(null);
    if (gender) formData.set('gender', gender);
    const result = await updateNgoBeneficiary(formData);
    if (result.error) { setError(result.error); return; }
    setEditing(null);
    router.refresh();
  }

  const items = initialItems.filter((i) =>
    i.fullName.toLowerCase().includes(query.toLowerCase()) ||
    i.subtitle.toLowerCase().includes(query.toLowerCase()) ||
    i.contact.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bénéficiaires</h1>
          <p className="text-muted-foreground">{initialItems.length} bénéficiaire(s)</p>
        </div>
        <Button onClick={() => { setShowForm(true); setEditing(null); setGender(''); setProjectId(''); }} className="bg-[#2563EB] hover:bg-[#2563EB]/90">
          <Plus className="h-4 w-4" /> Ajouter
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {showForm && (
        <BeneficiaryForm
          projects={projects}
          gender={gender}
          setGender={setGender}
          projectId={projectId}
          setProjectId={setProjectId}
          onCancel={() => setShowForm(false)}
          onSubmit={handleCreate}
          title="Nouveau bénéficiaire"
        />
      )}

      {editing && (
        <BeneficiaryForm
          defaults={editing}
          projects={projects}
          gender={gender || editing.gender || ''}
          setGender={setGender}
          projectId={projectId || editing.projectId || ''}
          setProjectId={setProjectId}
          onCancel={() => setEditing(null)}
          onSubmit={handleUpdate}
          title={`Modifier — ${editing.fullName}`}
        />
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
                      <Heart className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{item.fullName}</h3>
                      <p className="text-sm text-muted-foreground truncate">{item.subtitle}</p>
                      {item.contact && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 truncate">
                          {item.phone && <Phone className="h-3 w-3" />}
                          {item.email && <Mail className="h-3 w-3" />}
                          {item.contact}
                        </p>
                      )}
                      {item.projectName && (
                        <Badge variant="secondary" className="text-[10px] mt-2">Projet : {item.projectName}</Badge>
                      )}
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                      setEditing(item);
                      setGender(item.gender ?? '');
                      setProjectId(item.projectId ?? '');
                      setShowForm(false);
                    }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <Heart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Aucun bénéficiaire enregistré.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
