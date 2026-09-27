'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { setBtpQuoteAccess, type QuoteAccessMember } from '@/lib/actions/btp-quotes';
import { ROLE_LABELS } from '@/types/database';
import { ShieldCheck } from 'lucide-react';

export function QuoteAccessManager({ initialMembers }: { initialMembers: QuoteAccessMember[] }) {
  const [members, setMembers] = useState(initialMembers);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(member: QuoteAccessMember, grant: boolean) {
    setError(null);
    setPending(member.profileId);
    const result = await setBtpQuoteAccess(member.profileId, grant);
    setPending(null);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setMembers((prev) => prev.map((m) => (m.profileId === member.profileId ? { ...m, granted: grant } : m)));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Qui peut établir des devis ?
        </CardTitle>
        <CardDescription>
          Le directeur et le directeur adjoint ont toujours accès. Activez l&apos;accès pour les membres
          qui préparent les devis (métreur, conducteur de travaux…). Seul le directeur peut supprimer un
          devis.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun autre membre actif dans l&apos;organisation.</p>
        ) : (
          <div className="divide-y rounded-lg border">
            {members.map((m) => (
              <label
                key={m.profileId}
                className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{m.fullName}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {ROLE_LABELS[m.role] ?? m.role} · {m.email}
                  </p>
                </div>
                <Switch
                  checked={m.granted}
                  disabled={pending === m.profileId}
                  onCheckedChange={(checked) => toggle(m, checked)}
                />
              </label>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
