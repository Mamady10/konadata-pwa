'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Phone, MessageCircle, Smartphone } from 'lucide-react';
import {
  requestPhoneOtp,
  verifyPhoneOtp,
  type PhoneOtpChannel,
  type PhoneOtpPurpose,
} from '@/lib/auth/phone-otp-client';

interface Props {
  purpose: PhoneOtpPurpose;
  fullName?: string;
  accountIntent?: string;
  signupIntent?: string;
  onVerified: () => void | Promise<void>;
  submitLabel?: string;
  disabled?: boolean;
}

export function PhoneOtpPanel({
  purpose,
  fullName,
  accountIntent,
  signupIntent,
  onVerified,
  submitLabel,
  disabled = false,
}: Props) {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [channel, setChannel] = useState<PhoneOtpChannel>('whatsapp');
  const [code, setCode] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [maskedPhone, setMaskedPhone] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await requestPhoneOtp({ phone, purpose, channel });
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setChallengeId(res.challengeId ?? null);
    setMaskedPhone(res.maskedPhone ?? '');
    setDevCode(res.devCode ?? null);
    setStep('otp');
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!challengeId) return;
    setLoading(true);
    setError(null);
    const res = await verifyPhoneOtp({
      challengeId,
      code: code.trim(),
      fullName: purpose === 'signup' ? fullName : undefined,
      accountIntent,
      signupIntent,
    });
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    await onVerified();
  }

  if (step === 'otp') {
    return (
      <form onSubmit={handleVerifyOtp} className="space-y-4">
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
          <Label htmlFor="otp-code">Code à 6 chiffres</Label>
          <Input
            id="otp-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            required
            disabled={loading || disabled}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="bg-[#2563EB]" disabled={loading || disabled || code.length < 6}>
            {loading ? 'Vérification…' : submitLabel ?? (purpose === 'login' ? 'Se connecter' : 'Valider')}
          </Button>
          <Button
            type="button"
            variant="outline"
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
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleRequestOtp} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="auth-phone">Numéro de téléphone</Label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="auth-phone"
            name="auth_phone"
            type="tel"
            className="pl-9"
            placeholder="6XX XX XX XX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            disabled={loading || disabled}
          />
        </div>
        <p className="text-xs text-muted-foreground">Numéro guinéen (Orange, MTN, etc.)</p>
      </div>

      <div className="space-y-2">
        <Label>Recevoir le code par</Label>
        <div className="flex flex-wrap gap-2">
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
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full bg-[#2563EB]" disabled={loading || disabled || !phone.trim()}>
        {loading ? 'Envoi…' : 'Recevoir le code'}
      </Button>
    </form>
  );
}
