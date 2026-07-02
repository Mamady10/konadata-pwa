'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  createSchoolAnnouncement,
  deleteSchoolAnnouncement,
} from '@/lib/actions/school-announcements';
import type { SchoolAnnouncementRow } from '@/lib/actions/school-announcements';
import { MAX_ANNOUNCEMENT_IMAGES } from '@/lib/school/announcement-constants';
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

interface PendingImage {
  id: string;
  file: File;
  previewUrl: string;
}

export function SchoolAnnouncementsPanel({ announcements, canManage }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState('announcement');
  const [submitting, setSubmitting] = useState(false);
  const [images, setImages] = useState<PendingImage[]>([]);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (fileRef.current) fileRef.current.value = '';
    if (!selected.length) return;

    const tooLarge = selected.find((f) => f.size > MAX_IMAGE_BYTES);
    if (tooLarge) {
      setError(`« ${tooLarge.name} » dépasse 8 Mo.`);
      return;
    }

    setImages((prev) => {
      const remaining = MAX_ANNOUNCEMENT_IMAGES - prev.length;
      if (remaining <= 0) {
        setError(`Maximum ${MAX_ANNOUNCEMENT_IMAGES} images.`);
        return prev;
      }
      const toAdd = selected.slice(0, remaining).map((file) => ({
        id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      if (selected.length > remaining) {
        setError(`Maximum ${MAX_ANNOUNCEMENT_IMAGES} images — les suivantes ont été ignorées.`);
      } else {
        setError(null);
      }
      return [...prev, ...toAdd];
    });
  }

  function removeImage(id: string) {
    setImages((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  }

  function clearImages() {
    setImages((prev) => {
      prev.forEach((i) => URL.revokeObjectURL(i.previewUrl));
      return [];
    });
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleCreate() {
    setError(null);
    const form = formRef.current;
    if (!form) return;
    const formData = new FormData(form);
    formData.set('category', category);
    formData.delete('image');
    images.forEach((img) => formData.append('image', img.file));

    setSubmitting(true);
    const res = await createSchoolAnnouncement(formData);
    setSubmitting(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    form.reset();
    setCategory('announcement');
    clearImages();
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
            <form
              ref={formRef}
              onSubmit={(e) => {
                e.preventDefault();
                void handleCreate();
              }}
              className="space-y-4"
            >
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
                <div className="flex items-center justify-between">
                  <Label>Images (facultatif)</Label>
                  {images.length > 0 && (
                    <span className="text-[11px] text-muted-foreground">
                      {images.length}/{MAX_ANNOUNCEMENT_IMAGES}
                    </span>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  onChange={handleImageChange}
                  className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-muted/80"
                />
                {images.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {images.map((img) => (
                      <div key={img.id} className="relative aspect-square">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.previewUrl}
                          alt="Aperçu"
                          className="h-full w-full rounded-lg border object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(img.id)}
                          className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-white shadow"
                          aria-label="Retirer l'image"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <ImagePlus className="h-3 w-3" />
                    PNG, JPG ou WEBP — jusqu&apos;à {MAX_ANNOUNCEMENT_IMAGES} images (8 Mo chacune).
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
                    {a.imageUrls.length > 0 && (
                      <div
                        className={`mt-3 grid gap-2 ${
                          a.imageUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3'
                        }`}
                      >
                        {a.imageUrls.map((url, i) => (
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt={`${a.title} — image ${i + 1}`}
                              className={`w-full rounded-lg border bg-muted/30 object-cover ${
                                a.imageUrls.length === 1 ? 'max-h-72 object-contain' : 'aspect-square'
                              }`}
                            />
                          </a>
                        ))}
                      </div>
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
