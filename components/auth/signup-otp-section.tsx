'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MessageCircle, Smartphone, Mail } from 'lucide-react';
import type { AuthMethod } from '@/components/auth/auth-method-toggle';
import type { PhoneOtpChannel } from '@/lib/auth/phone-otp-client';
import {
  completeSignupWithEmailOtp,
  completeSignupWithPhoneOtp,
  requestSignupEmailOtp,
  requestSignupPhoneOtp,
} from '@/lib/auth/signup-otp-client';

export type SignupOtpStep = 'form' | 'verify';

export function useSignupOtp() {
  const [step, setStep] = useState<SignupOtpStep>('form');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [channel, setChannel] = useState<PhoneOtpChannel>('whatsapp');
  const [maskedContact, setMaskedContact] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpLoading, setOtpLoading] = useState(false);

  function resetOtp() {
    setStep('form');
    setChallengeId(null);
    setOtpCode('');
    setMaskedContact('');
    setDevCode(null);
    setOtpError(null);
  }

  async function requestOtp(params: {
    method: AuthMethod;
    phone?: string;
    email?: string;
  }): Promise<boolean> {
    setOtpLoading(true);
    setOtpError(null);
    try {
      if (params.method === 'phone') {
        const phone = params.phone?.trim() ?? '';
        if (!phone) {
          setOtpError('Numéro WhatsApp requis.');
          return false;
        }
        const res = await requestSignupPhoneOtp({ phone, channel });
        if (res.error) {
          setOtpError(res.error);
          return false;
        }
        setChallengeId(res.challengeId ?? null);
        setMaskedContact(res.maskedPhone ?? '');
        setDevCode(res.devCode ?? null);
        setStep('verify');
        return true;
      }

      const email = params.email?.trim() ?? '';
      if (!email) {
        setOtpError('Email requis.');
        return false;
      }
      const res = await requestSignupEmailOtp(email);
      if (res.error) {
        setOtpError(res.error);
        return false;
      }
      setChallengeId(res.challengeId ?? null);
      setMaskedContact(res.maskedEmail ?? '');
      setDevCode(res.devCode ?? null);
      setStep('verify');
      return true;
    } finally {
      setOtpLoading(false);
    }
  }

  async function completeSignup(params: {
    method: AuthMethod;
    password: string;
    fullName: string;
    accountIntent?: string;
    signupIntent?: string;
  }): Promise<{ success: true } | { error: string }> {
    if (!challengeId) {
      return { error: 'Demandez d\'abord un code de confirmation.' };
    }
    const code = otpCode.trim();
    if (code.length < 6) {
      return { error: 'Saisissez le code à 6 chiffres reçu.' };
    }

    setOtpLoading(true);
    setOtpError(null);
    try {
      const payload = {
        challengeId,
        code,
        password: params.password,
        fullName: params.fullName,
        accountIntent: params.accountIntent,
        signupIntent: params.signupIntent,
      };
      const res =
        params.method === 'phone'
          ? await completeSignupWithPhoneOtp(payload)
          : await completeSignupWithEmailOtp(payload);

      if (res.error) {
        setOtpError(res.error);
        return { error: res.error };
      }
      return { success: true };
    } finally {
      setOtpLoading(false);
    }
  }

  return {
    step,
    challengeId,
    otpCode,
    setOtpCode,
    channel,
    setChannel,
    maskedContact,
    devCode,
    otpError,
    otpLoading,
    requestOtp,
    completeSignup,
    resetOtp,
  };
}

interface SignupOtpSectionProps {
  method: AuthMethod;
  step: SignupOtpStep;
  channel: PhoneOtpChannel;
  onChannelChange: (channel: PhoneOtpChannel) => void;
  otpCode: string;
  onOtpCodeChange: (code: string) => void;
  maskedContact: string;
  devCode: string | null;
  error: string | null;
  loading: boolean;
  onChangeContact: () => void;
}

export function SignupOtpSection({
  method,
  step,
  channel,
  onChannelChange,
  otpCode,
  onOtpCodeChange,
  maskedContact,
  devCode,
  error,
  loading,
  onChangeContact,
}: SignupOtpSectionProps) {
  if (step === 'form') {
    return (
      <div className="space-y-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4">
        <p className="text-sm text-muted-foreground">
          Pour sécuriser votre compte, confirmez votre{' '}
          {method === 'phone' ? 'numéro WhatsApp' : 'adresse email'} avec un code à 6 chiffres.
        </p>
        {method === 'phone' && (
          <div className="space-y-2">
            <Label>Recevoir le code par</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={channel === 'whatsapp' ? 'default' : 'outline'}
                className={channel === 'whatsapp' ? 'bg-[#2563EB]' : ''}
                onClick={() => onChannelChange('whatsapp')}
              >
                <MessageCircle className="h-4 w-4 mr-1" />
                WhatsApp
              </Button>
              <Button
                type="button"
                size="sm"
                variant={channel === 'sms' ? 'default' : 'outline'}
                className={channel === 'sms' ? 'bg-[#2563EB]' : ''}
                onClick={() => onChannelChange('sms')}
              >
                <Smartphone className="h-4 w-4 mr-1" />
                SMS
              </Button>
            </div>
          </div>
        )}
        {method === 'email' && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Mail className="h-3.5 w-3.5" />
            Le code sera envoyé par email (si configuré sur le serveur).
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-500/5 p-4">
      <p className="text-sm text-muted-foreground">
        Code envoyé {method === 'phone' ? (channel === 'whatsapp' ? 'sur WhatsApp' : 'par SMS') : 'par email'}
        {maskedContact ? ` à ${maskedContact}` : ''}.
      </p>
      {devCode && (
        <p className="text-xs rounded-lg bg-amber-50 border border-amber-200 p-2 text-amber-900">
          Mode développement — code : <strong>{devCode}</strong>
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="signup-otp-code">Code de confirmation *</Label>
        <Input
          id="signup-otp-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          value={otpCode}
          onChange={(e) => onOtpCodeChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
          required
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="button" variant="ghost" size="sm" onClick={onChangeContact} disabled={loading}>
        Modifier {method === 'phone' ? 'le numéro' : "l'email"} / renvoyer un code
      </Button>
    </div>
  );
}
