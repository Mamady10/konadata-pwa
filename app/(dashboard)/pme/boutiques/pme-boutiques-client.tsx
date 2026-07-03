'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Store, Plus, Phone, MapPin, User } from 'lucide-react';
import { motion } from 'framer-motion';
import type { PmeBoutiqueRow } from '@/lib/actions/pme';

interface Props {
  boutiques: PmeBoutiqueRow[];
  onCreate: (formData: FormData) => Promise<{ success?: boolean; error?: string }>;
}

export function PmeBoutiquesClient({ boutiques, onCreate }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleCreate(formData: FormData) {
    setError(null);
    setSaving(true);
    const result = await onCreate(formData);
    setSaving(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setShowForm(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Boutiques</h1>
          <p className="text-muted-foreground">
            Gérez vos points de vente. Chaque vente, achat, dépense ou produit peut être
            rattaché à une boutique pour obtenir des rapports par boutique et un rapport
            général.
          </p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="bg-[#2563EB] hover:bg-[#2563EB]/90"
        >
          <Plus className="h-4 w-4" /> Ajouter
        </Button>
      </div>

      {showForm && (
        <Card className="border-blue-200/60">
          <CardHeader>
            <CardTitle>Nouvelle boutique</CardTitle>
            <CardDescription>
              Renseignez au minimum le nom de la boutique.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && <p className="text-destructive mb-3 text-sm">{error}</p>}
            <form action={handleCreate} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Nom de la boutique *</Label>
                  <Input name="name" required placeholder="Boutique centre-ville" />
                </div>
                <div className="space-y-2">
                  <Label>Adresse</Label>
                  <Input name="address" placeholder="Ville, quartier…" />
                </div>
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input name="phone" placeholder="+224…" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Responsable / gérant</Label>
                  <Input name="manager" placeholder="Nom du responsable" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving} className="bg-[#2563EB]">
                  {saving ? 'Enregistrement…' : 'Enregistrer la boutique'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  Annuler
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {boutiques.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boutiques.map((b, index) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="h-full">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                      <Store className="text-primary h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-semibold">{b.name}</h3>
                        {!b.is_active && (
                          <Badge variant="outline" className="text-[10px]">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <div className="text-muted-foreground mt-2 space-y-1 text-sm">
                        {b.address && (
                          <p className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" /> {b.address}
                          </p>
                        )}
                        {b.phone && (
                          <p className="flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5" /> {b.phone}
                          </p>
                        )}
                        {b.manager && (
                          <p className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5" /> {b.manager}
                          </p>
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
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <Store className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
            <p className="text-muted-foreground">
              Aucune boutique. Cliquez sur Ajouter pour créer votre premier point de vente.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
