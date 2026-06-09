'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, MapPin, Send } from 'lucide-react';
import type { NgoSurveyQuestion } from '@/lib/ngo/survey-questions';

interface Props {
  surveyId: string;
  title: string;
  questions: NgoSurveyQuestion[];
  requireGps: boolean;
  onSubmit: (
    surveyId: string,
    answers: Record<string, unknown>,
    meta?: { locality?: string; latitude?: number; longitude?: number }
  ) => Promise<{ error?: string; success?: boolean }>;
}

export function CollecterClient({ surveyId, title, questions, requireGps, onSubmit }: Props) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [locality, setLocality] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  function setAnswer(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  async function captureGps() {
    setGpsLoading(true);
    setError(null);
    if (!navigator.geolocation) {
      setError('Géolocalisation non supportée sur cet appareil.');
      setGpsLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsLoading(false);
      },
      () => {
        setError('Impossible d\'obtenir la position GPS.');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const payload: Record<string, unknown> = {};
    for (const q of questions) {
      const val = answers[q.id];
      if (q.required && !val?.trim()) {
        setError(`Répondez à : ${q.text}`);
        setLoading(false);
        return;
      }
      if (q.type === 'yes_no') payload[q.id] = val === 'oui';
      else if (q.type === 'number') payload[q.id] = val ? Number(val) : null;
      else payload[q.id] = val ?? null;
    }

    const res = await onSubmit(surveyId, payload, {
      locality: locality.trim() || undefined,
      latitude: coords?.lat,
      longitude: coords?.lng,
    });

    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    router.push(`/ong/sondages/${surveyId}`);
    router.refresh();
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/ong/sondages/${surveyId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold">Collecte terrain</h1>
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Formulaire</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {questions.map((q) => (
              <div key={q.id} className="space-y-2">
                <Label>
                  {q.text}
                  {q.required && ' *'}
                </Label>
                {q.type === 'yes_no' ? (
                  <div className="flex gap-2">
                    {['oui', 'non'].map((v) => (
                      <Button
                        key={v}
                        type="button"
                        size="sm"
                        variant={answers[q.id] === v ? 'default' : 'outline'}
                        onClick={() => setAnswer(q.id, v)}
                      >
                        {v === 'oui' ? 'Oui' : 'Non'}
                      </Button>
                    ))}
                  </div>
                ) : q.type === 'single_choice' && q.options?.length ? (
                  <div className="space-y-2">
                    {q.options.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setAnswer(q.id, opt)}
                        className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors ${
                          answers[q.id] === opt
                            ? 'border-primary bg-primary/10 font-medium'
                            : 'hover:bg-muted'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                ) : q.type === 'number' ? (
                  <Input
                    type="number"
                    value={answers[q.id] ?? ''}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                  />
                ) : (
                  <Input
                    value={answers[q.id] ?? ''}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                  />
                )}
              </div>
            ))}

            <div className="space-y-2">
              <Label>Localité / village</Label>
              <Input value={locality} onChange={(e) => setLocality(e.target.value)} placeholder="Quartier, village…" />
            </div>

            {requireGps && (
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Position GPS requise
                </p>
                <Button type="button" variant="outline" size="sm" onClick={captureGps} disabled={gpsLoading}>
                  {gpsLoading ? 'Localisation…' : coords ? 'Position enregistrée' : 'Capturer GPS'}
                </Button>
                {coords && (
                  <p className="text-xs text-muted-foreground">
                    {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                  </p>
                )}
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full bg-[#2563EB]" disabled={loading}>
              <Send className="h-4 w-4 mr-1" />
              {loading ? 'Envoi…' : 'Enregistrer la réponse'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
