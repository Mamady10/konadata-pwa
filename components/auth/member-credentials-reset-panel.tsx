'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert, Smartphone } from 'lucide-react';
import { adminResetMemberCredentials } from '@/lib/actions/member-credentials';
import { isSyntheticPhoneEmail } from '@/lib/auth/phone-email';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth/password-policy';
import type { AppRole } from '@/types/database';

export interface MemberCredentialsRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: AppRole | string;
}

interface Props {
  member: MemberCredentialsRow;
  canReset: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function MemberCredentialsResetPanel({
  member,
  canReset,
  onClose,
  onSuccess,
}: Props) {
  const [newPhone, setNewPhone] = useState(member.phone ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isPhoneAccount = isSyntheticPhoneEmail(member.email) || Boolean(member.phone?.trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData();
    fd.set('target_user_id', member.id);
    fd.set('new_phone', newPhone);
    fd.set('new_password', newPassword);
    fd.set('confirm_password', confirmPassword);
    const res = await adminResetMemberCredentials(fd);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.success && res.message) {
      onSuccess(res.message);
      onClose();
    }
  }

  if (!canReset) return null;

  return (
    <Card className="border-amber-200 bg-amber-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-700" />
          Secours compte — {member.name}
        </CardTitle>
        <CardDescription>
          {isPhoneAccount
            ? 'Perte de numéro WhatsApp : saisissez le nouveau numéro actif et un mot de passe temporaire à transmettre en personne.'
            : 'Compte email : définissez un nouveau mot de passe temporaire.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          {isPhoneAccount && (
            <div className="space-y-2">
              <Label htmlFor="reset-phone">Nouveau numéro WhatsApp *</Label>
              <div className="relative">
                <Smartphone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="reset-phone"
                  type="tel"
                  className="pl-9"
                  placeholder="6XX XX XX XX"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  required
                  autoComplete="off"
                />
              </div>
              {member.phone && (
                <p className="text-xs text-muted-foreground">
                  Ancien numéro enregistré : {member.phone}
                </p>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="reset-password">Nouveau mot de passe temporaire *</Label>
            <Input
              id="reset-password"
              type="password"
              minLength={MIN_PASSWORD_LENGTH}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reset-confirm">Confirmer le mot de passe *</Label>
            <Input
              id="reset-confirm"
              type="password"
              minLength={MIN_PASSWORD_LENGTH}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Vérifiez l&apos;identité du collaborateur (pièce d&apos;identité) avant validation. Ne communiquez
            le mot de passe que de vive voix ou par canal sécurisé.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={loading} className="bg-amber-700 hover:bg-amber-700/90">
              {loading ? 'Enregistrement…' : 'Réinitialiser le compte'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Annuler
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
