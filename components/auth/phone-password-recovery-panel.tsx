'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Phone, MessageCircle, Smartphone, Lock, CheckCircle2 } from 'lucide-react';
import {
  requestPhoneOtp,
  resetPasswordWithPhoneOtp,
  type PhoneOtpChannel,
} from '@/lib/auth/phone-otp-client';
import { LANDING_LINKS } from '@/lib/marketing/landing-links';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth/password-policy';

export function PhonePasswordRecoveryPanel() {
  const [step, setStep] = useState<'phone' | 'reset' | 'done'>('phone');
  const [phone, setPhone] = useState('');
  const [channel, setChannel] = useState<PhoneOtpChannel>('whatsapp');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [maskedPhone, setMaskedPhone] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await requestPhoneOtp({ phone, purpose: 'recovery', channel });
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setChallengeId(res.challengeId ?? null);
    setMaskedPhone(res.maskedPhone ?? '');
    setDevCode(res.devCode ?? null);
    setStep('reset');
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (!challengeId) return;
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`);
      return;
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    setError(null);
    const res = await resetPasswordWithPhoneOtp({ challengeId, code: code.trim(), password });
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setStep('done');
  }

  if (step === 'done') {
    return (
      <div className="text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <p className="text-sm text-muted-foreground">
          Mot de passe mis à jour. Connectez-vous avec votre numéro et le nouveau mot de passe.
        </p>
        <Link href={LANDING_LINKS.login}>
          <Button className="w-full bg-[#2563EB]">Aller à la connexion</Button>
        </Link>
      </div>
    );
  }

  if (step === 'reset') {
    return (
      <form onSubmit={handleReset} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Code envoyé {channel === 'whatsapp' ? 'sur WhatsApp' : 'par SMS'}
          {maskedPhone ? ` au ${maskedPhone}` : ''}.
        </p>
        {devCode && (
          <p className="text-xs rounded-lg bg-amber-50 border border-amber-200 p-2 text-amber-900">
            Mode développement — code : <strong>{devCode}</strong>
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="recovery-code">Code à 6 chiffres</Label>
          <Input
            id="recovery-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="recovery-password">Nouveau mot de passe</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="recovery-password"
              type="password"
              className="pl-9"
              minLength={MIN_PASSWORD_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="recovery-confirm">Confirmer le mot de passe</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="recovery-confirm"
              type="password"
              className="pl-9"
              minLength={MIN_PASSWORD_LENGTH}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          type="submit"
          className="w-full bg-[#2563EB]"
          disabled={loading || code.length < 6}
        >
          {loading ? 'Enregistrement…' : 'Enregistrer le nouveau mot de passe'}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={loading}
          onClick={() => {
            setStep('phone');
            setCode('');
            setChallengeId(null);
            setError(null);
          }}
        >
          Changer de numéro
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleRequestOtp} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="recovery-phone">Numéro de téléphone du compte</Label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="recovery-phone"
            type="tel"
            className="pl-9"
            placeholder="6XX XX XX XX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Recevoir le code par</Label>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={channel === 'whatsapp' ? 'default' : 'outline'}
            className={channel === 'whatsapp' ? 'bg-[#2563EB]' : ''}
            onClick={() => setChannel('whatsapp')}
          >
            <MessageCircle className="h-4 w-4 mr-1" />
            WhatsApp
          </Button>
          <Button
            type="button"
            size="sm"
            variant={channel === 'sms' ? 'default' : 'outline'}
            className={channel === 'sms' ? 'bg-[#2563EB]' : ''}
            onClick={() => setChannel('sms')}
          >
            <Smartphone className="h-4 w-4 mr-1" />
            SMS
          </Button>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full bg-[#2563EB]" disabled={loading || !phone.trim()}>
        {loading ? 'Envoi…' : 'Recevoir le code de récupération'}
      </Button>
    </form>
  );
}
