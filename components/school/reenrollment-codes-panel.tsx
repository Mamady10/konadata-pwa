'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createReenrollmentCode } from '@/lib/actions/learner-onboarding';
import { KeyRound } from 'lucide-react';

interface CodeRow {
  id: string;
  code: string;
  legacy_reference: string | null;
  is_active: boolean;
  used_at: string | null;
  created_at: string;
}

interface Props {
  codes: CodeRow[];
  codeExample?: string;
}

export function ReenrollmentCodesPanel({ codes, codeExample = 'LYCKAL-DIALA-2847' }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const fd = new FormData(e.currentTarget);
    const result = await createReenrollmentCode(fd);
    if (result.error) setMessage(result.error);
    else {
      setMessage('Code créé — communiquez-le à l\'élève pour sa réinscription.');
      e.currentTarget.reset();
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          Codes de réinscription
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Format permanent : <span className="font-mono font-medium">{codeExample}</span> (établissement +
          nom + chiffres). Le même code sert chaque année — sans classe ni année dans le code.
          Génération automatique à l&apos;ouverture d&apos;une nouvelle année scolaire, ou ajout
          manuel ci-dessous (ex. ancienne base papier).
        </p>
        <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-3 items-end">
          <div className="space-y-2">
            <Label>Code *</Label>
            <Input
              name="code"
              placeholder={codeExample}
              className="uppercase font-mono"
              required
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Nom de l&apos;élève (référence)</Label>
            <Input name="legacy_reference" placeholder="Aminata Diallo" />
          </div>
          <Button type="submit" disabled={loading} className="sm:col-span-3 bg-[#2563EB] w-fit">
            {loading ? 'Création…' : 'Ajouter un code'}
          </Button>
        </form>
        {message && (
          <p className="text-sm text-primary bg-primary/10 rounded-lg px-3 py-2">{message}</p>
        )}
        {codes.length > 0 && (
          <ul className="text-sm border rounded-lg divide-y max-h-48 overflow-y-auto">
            {codes.map((c) => (
              <li key={c.id} className="px-3 py-2 flex justify-between gap-2">
                <span className="font-mono font-medium">{c.code}</span>
                <span className="text-muted-foreground truncate">
                  {c.used_at ? 'Utilisé' : c.is_active ? 'Actif' : 'Inactif'}
                  {c.legacy_reference ? ` — ${c.legacy_reference}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
