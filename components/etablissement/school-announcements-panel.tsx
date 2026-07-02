'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createSchoolAnnouncement, deleteSchoolAnnouncement } from '@/lib/actions/school-announcements';
import type { SchoolAnnouncementRow } from '@/lib/actions/school-announcements';
import { ImagePlus, Megaphone, Trash2, X } from 'lucide-react';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const CATEGORY_LABELS: Record<string, string> = {
  announcement: 'Annonce',
  event: 'Événement',
  holiday: 'Jour férié',
  results: 'Résultats',
};

interface Props {
  announcements: SchoolAnnouncementRow[];
  canManage: boolean;
}

export function SchoolAnnouncementsPanel({ announcements, canManage }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState('announcement');
  const [submitting, setSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setImagePreview(null);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('Image trop lourde (max 8 Mo).');
      if (fileRef.current) fileRef.current.value = '';
      setImagePreview(null);
      return;
    }
    setError(null);
    setImagePreview(URL.createObjectURL(file));
  }

  function clearImage() {
    if (fileRef.current) fileRef.current.value = '';
    setImagePreview(null);
  }

  async function handleCreate(formData: FormData) {
    setError(null);
    setSubmitting(true);
    formData.set('category', category);
    const res = await createSchoolAnnouncement(formData);
    setSubmitting(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    formRef.current?.reset();
    setCategory('announcement');
    clearImage();
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette publication ?')) return;
    await deleteSchoolAnnouncement(id);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          Fil d&apos;actualité
        </h2>
        <p className="text-sm text-muted-foreground">
          Annonces, événements et jours fériés — visibles par les parents (portail suivi scolarité) et les élèves.
        </p>
      </div>

      {canManage && (
        <Card>
          <CardHeader><CardTitle className="text-base">Publier une information</CardTitle></CardHeader>
          <CardContent>
            {error && <p className="text-sm text-destructive mb-3">{error}</p>}
            <form ref={formRef} action={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Titre *</Label>
                <Input name="title" required placeholder="Réunion parents, jour férié…" />
              </div>
              <div className="space-y-2">
                <Label>Contenu</Label>
                <textarea
                  name="body"
                  rows={4}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Détails de l'événement ou de l'annonce…"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date événement</Label>
                  <Input name="event_date" type="date" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Image (facultatif)</Label>
                <input
                  ref={fileRef}
                  name="image"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleImageChange}
                  className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-muted/80"
                />
                {imagePreview ? (
                  <div className="relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreview}
                      alt="Aperçu"
                      className="max-h-48 rounded-lg border object-contain"
                    />
                    <button
                      type="button"
                      onClick={clearImage}
                      className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-white shadow"
                      aria-label="Retirer l'image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <ImagePlus className="h-3 w-3" />
                    PNG, JPG ou WEBP — jusqu&apos;à 8 Mo. Idéal pour affiches, photos d&apos;événement ou résultats.
                  </p>
                )}
              </div>
              <Button type="submit" disabled={submitting} className="bg-[#2563EB]">
                {submitting ? 'Publication…' : 'Publier'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {announcements.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center text-muted-foreground text-sm">
              Aucune publication pour le moment.
            </CardContent>
          </Card>
        ) : (
          announcements.map((a) => (
            <Card key={a.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px]">
                        {CATEGORY_LABELS[a.category] ?? a.category}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(a.publishedAt).toLocaleDateString('fr-FR')}
                      </span>
                      {a.eventDate && (
                        <span className="text-[10px] text-primary">
                          Événement : {new Date(a.eventDate).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold">{a.title}</h3>
                    {a.body && <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{a.body}</p>}
                    {a.imageUrl && (
                      <a href={a.imageUrl} target="_blank" rel="noopener noreferrer" className="mt-3 block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={a.imageUrl}
                          alt={a.title}
                          className="max-h-72 w-full rounded-lg border object-contain bg-muted/30"
                        />
                      </a>
                    )}
                  </div>
                  {canManage && (
                    <Button type="button" variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => void handleDelete(a.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
