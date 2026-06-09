'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Phone, Send, ShieldCheck } from 'lucide-react';
import type { PublicNgoSurvey } from '@/lib/actions/ngo-public-survey';
import {
  getClientDeviceFingerprint,
  hasLocalParticipationMark,
  markLocalParticipation,
} from '@/lib/survey/device-fingerprint-client';

interface Props {
  token: string;
  survey: PublicNgoSurvey;
}

type Step = 'blocked' | 'phone' | 'otp' | 'survey' | 'done';

export function ParticipationOngClient({ token, survey }: Props) {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [maskedPhone, setMaskedPhone] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [deviceFp, setDeviceFp] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [locality, setLocality] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const question = survey.questions[0];
  const security = survey.security;

  useEffect(() => {
    getClientDeviceFingerprint().then(setDeviceFp);
    if (hasLocalParticipationMark(survey.id)) {
      setStep('blocked');
    } else if (!security.requirePhoneOtp) {
      setStep('survey');
    }
  }, [survey.id, security.requirePhoneOtp]);

  async function requestOtp() {
    setError(null);
    setLoading(true);
    setDevCode(null);
    try {
      const res = await fetch('/api/survey-participation/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          phone,
          deviceFingerprint: deviceFp,
          channel: security.otpChannel,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Impossible d\'envoyer le code');
        return;
      }
      setChallengeId(data.challengeId);
      setMaskedPhone(data.maskedPhone ?? null);
      if (data.devCode) setDevCode(String(data.devCode));
      setStep('otp');
    } catch {
      setError('Erreur réseau — réessayez');
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    if (!challengeId) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/survey-participation/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId, code: otpCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Code invalide');
        return;
      }
      setStep('survey');
    } catch {
      setError('Erreur réseau — réessayez');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!question) {
      setError('Ce sondage ne contient pas de question.');
      return;
    }
    if (!selected?.trim()) {
      setError('Veuillez sélectionner une réponse.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/survey-participation/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          challengeId: security.requirePhoneOtp ? challengeId : null,
          deviceFingerprint: deviceFp,
          answers: { [question.id]: selected },
          locality: locality.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Envoi impossible');
        return;
      }
      markLocalParticipation(survey.id, security.deviceLockDays);
      setStep('done');
    } catch {
      setError('Erreur réseau — réessayez');
    } finally {
      setLoading(false);
    }
  }

  if (step === 'blocked') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-3">
            <ShieldCheck className="h-12 w-12 text-amber-600 mx-auto" />
            <h1 className="text-xl font-bold">Participation déjà enregistrée</h1>
            <p className="text-sm text-muted-foreground">
              Cet appareil a déjà répondu à ce sondage. Une seule participation est autorisée.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
            <h1 className="text-xl font-bold">Merci pour votre participation</h1>
            <p className="text-sm text-muted-foreground">
              Votre réponse a été enregistrée pour le sondage « {survey.title} ».
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const header = (
    <CardHeader>
      <p className="text-xs text-muted-foreground uppercase tracking-wide">
        {survey.organizationName}
      </p>
      <CardTitle>{survey.title}</CardTitle>
      {survey.description && <p className="text-sm text-muted-foreground">{survey.description}</p>}
      {survey.region && <p className="text-xs text-muted-foreground">Région : {survey.region}</p>}
      <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
        <ShieldCheck className="h-3 w-3" />
        Participation sécurisée — sans création de compte
      </p>
    </CardHeader>
  );

  if (step === 'phone') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
        <Card className="max-w-lg w-full">
          {header}
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Entrez votre numéro de téléphone guinéen. Un code à 6 chiffres sera envoyé par{' '}
              {security.otpChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'}.
            </p>
            <div className="space-y-2">
              <Label>Téléphone mobile *</Label>
              <Input
                type="tel"
                placeholder="6XX XX XX XX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              className="w-full bg-[#2563EB]"
              disabled={loading || !phone.trim()}
              onClick={requestOtp}
            >
              <Phone className="h-4 w-4 mr-1" />
              {loading ? 'Envoi…' : 'Recevoir le code'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'otp') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
        <Card className="max-w-lg w-full">
          {header}
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Code envoyé {maskedPhone ? `au ${maskedPhone}` : ''}. Saisissez les 6 chiffres reçus.
            </p>
            {devCode && (
              <p className="text-xs bg-amber-50 border border-amber-200 rounded px-3 py-2 text-amber-800">
                Mode test — code : <strong>{devCode}</strong>
              </p>
            )}
            <div className="space-y-2">
              <Label>Code de vérification *</Label>
              <Input
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('phone')} disabled={loading}>
                Retour
              </Button>
              <Button
                className="flex-1 bg-[#2563EB]"
                disabled={loading || otpCode.length !== 6}
                onClick={verifyOtp}
              >
                {loading ? 'Vérification…' : 'Valider le code'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!question || question.type !== 'single_choice' || !question.options?.length) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-muted-foreground">Ce sondage n&apos;est pas configuré correctement.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
      <Card className="max-w-lg w-full">
        {header}
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-3">
              <Label className="text-base font-medium">{question.text}</Label>
              <div className="space-y-2">
                {question.options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setSelected(opt)}
                    className={`w-full text-left rounded-lg border px-4 py-3 text-sm transition-colors ${
                      selected === opt
                        ? 'border-[#2563EB] bg-[#2563EB]/10 font-medium'
                        : 'hover:bg-muted'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Localité (recommandé)</Label>
              <Input
                value={locality}
                onChange={(e) => setLocality(e.target.value)}
                placeholder="Village, quartier…"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full bg-[#2563EB]" disabled={loading}>
              <Send className="h-4 w-4 mr-1" />
              {loading ? 'Envoi…' : 'Envoyer ma réponse'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
