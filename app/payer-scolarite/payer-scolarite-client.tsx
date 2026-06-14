'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatPublicSchoolLabel } from '@/lib/school/org-name';
import type { PublicSchoolOption } from '@/lib/school/learner-application';
import { formatCurrency } from '@/lib/utils';
import { parseTuitionBalance } from '@/lib/school/student-payments';
import { GraduationCap, CreditCard, ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  GUARDIAN_OTP_INTRO,
  guardianOtpChannelLabel,
} from '@/lib/school/guardian-otp-ui';
import type { GuardianOtpChannel } from '@/lib/auth/guardian-otp';
import { LANDING_LINKS } from '@/lib/marketing/landing-links';
import { KonaDataLogo } from '@/components/brand/konadata-logo';

type Step = 'lookup' | 'otp' | 'amount';

interface LookupResult {
  student_id: string;
  enrollment_id: string | null;
  masked_name: string;
  matricule: string;
  balance: Record<string, unknown>;
  min_payment_gnf: number;
}

interface Props {
  schools: PublicSchoolOption[];
}

export function PayerScolariteClient({ schools }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('lookup');
  const [schoolId, setSchoolId] = useState('');
  const [matricule, setMatricule] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [amount, setAmount] = useState('');
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [otpChannel, setOtpChannel] = useState<GuardianOtpChannel | null>(null);

  const balance = lookup ? parseTuitionBalance(lookup.balance) : null;
  const minPay = lookup?.min_payment_gnf ?? 100_000;

  async function handleLookup() {
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { data, error: rpcErr } = await supabase.rpc('lookup_school_student_for_public_payment', {
      p_org_id: schoolId,
      p_matricule: matricule.trim(),
    });
    setLoading(false);

    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    const result = data as Record<string, unknown>;
    if (result?.error) {
      setError(String(result.error));
      return;
    }
    const lk = result as unknown as LookupResult;
    setLookup(lk);
    const bal = parseTuitionBalance(lk.balance);
    const remaining = bal?.remaining_gnf ?? lk.min_payment_gnf ?? 100_000;
    setAmount(String(remaining));
    setStep('otp');
  }

  async function handleRequestOtp() {
    setError(null);
    setDevCode(null);
    setLoading(true);
    const res = await fetch('/api/school-payment/request-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId: schoolId,
        studentId: lookup?.student_id,
        phone,
      }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json.error ?? 'Envoi du code échoué');
      return;
    }
    setChallengeId(json.challengeId);
    if (json.channel === 'whatsapp' || json.channel === 'sms') {
      setOtpChannel(json.channel);
    }
    if (json.devCode) setDevCode(json.devCode);
    setStep('amount');
  }

  async function handlePay() {
    if (!lookup || !challengeId) return;
    const parsed = Number(amount.replace(/\s/g, ''));
    if (!parsed || parsed < minPay) {
      setError(`Montant minimum : ${formatCurrency(minPay)}`);
      return;
    }
    if (balance && parsed > balance.remaining_gnf) {
      setError(`Maximum : ${formatCurrency(balance.remaining_gnf)}`);
      return;
    }

    setError(null);
    setLoading(true);
    const res = await fetch('/api/school-payment/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeId,
        studentId: lookup.student_id,
        enrollmentId: lookup.enrollment_id,
        code: otp,
        amountGnf: parsed,
      }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json.error ?? 'Vérification échouée');
      return;
    }
    router.push(json.redirectUrl ?? `/paiement-scolarite/${json.paymentToken}`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#F8FAFC]">
      <div className="w-full max-w-md space-y-4">
        <KonaDataLogo href={LANDING_LINKS.home} variant="wordmark" height={36} />
        <Button variant="ghost" size="sm" asChild>
          <Link href={LANDING_LINKS.home}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Accueil
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              Payer ma scolarité
            </CardTitle>
            <CardDescription>
              Sans compte KonaData — matricule + téléphone enregistré. {GUARDIAN_OTP_INTRO}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg p-2">{error}</p>
            )}

            {step === 'lookup' && (
              <>
                <div className="space-y-2">
                  <Label>Établissement</Label>
                  <Select value={schoolId} onValueChange={setSchoolId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir…" />
                    </SelectTrigger>
                    <SelectContent>
                      {schools.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {formatPublicSchoolLabel(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mat">Matricule</Label>
                  <Input
                    id="mat"
                    value={matricule}
                    onChange={(e) => setMatricule(e.target.value)}
                    placeholder="Ex. 2024-042"
                    className="font-mono uppercase"
                  />
                </div>
                <Button
                  className="w-full bg-[#2563EB]"
                  disabled={loading || !schoolId || !matricule.trim()}
                  onClick={() => void handleLookup()}
                >
                  {loading ? 'Recherche…' : 'Continuer'}
                </Button>
              </>
            )}

            {step === 'otp' && lookup && (
              <>
                <p className="text-sm rounded-lg bg-muted/50 p-3">
                  Élève : <strong>{lookup.masked_name}</strong> · Matricule {lookup.matricule}
                  {balance && (
                    <>
                      <br />
                      Reste à payer : <strong>{formatCurrency(balance.remaining_gnf)}</strong>
                    </>
                  )}
                </p>
                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone (élève ou tuteur)</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="6XX XX XX XX"
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep('lookup')}>
                    Retour
                  </Button>
                  <Button
                    className="flex-1 bg-[#2563EB]"
                    disabled={loading || !phone.trim()}
                    onClick={() => void handleRequestOtp()}
                  >
                    {loading ? 'Envoi…' : 'Recevoir le code (WhatsApp / SMS)'}
                  </Button>
                </div>
              </>
            )}

            {step === 'amount' && lookup && (
              <>
                <p className="text-sm text-muted-foreground">
                  Code envoyé
                  {otpChannel ? ` par ${guardianOtpChannelLabel(otpChannel)}` : ''} au numéro indiqué.
                  {devCode && (
                    <span className="block text-amber-700 font-mono mt-1">DEV : {devCode}</span>
                  )}
                </p>
                <div className="space-y-2">
                  <Label htmlFor="otp">
                    Code {otpChannel ? guardianOtpChannelLabel(otpChannel) : 'de confirmation'}
                  </Label>
                  <Input
                    id="otp"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6 chiffres"
                    className="font-mono text-center tracking-widest"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amt">
                    Montant à payer (min. {formatCurrency(minPay)})
                  </Label>
                  <Input
                    id="amt"
                    type="number"
                    min={minPay}
                    max={balance?.remaining_gnf}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full bg-[#2563EB]"
                  disabled={loading || otp.length < 6}
                  onClick={() => void handlePay()}
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  {loading ? 'Vérification…' : 'Aller au paiement'}
                </Button>
              </>
            )}

            <p className="text-xs text-center text-muted-foreground space-y-1">
              <span className="block">
                Consulter sans payer ?{' '}
                <Link href={LANDING_LINKS.suiviScolarite} className="text-primary underline">
                  Suivi scolarité
                </Link>
              </span>
              <span className="block">
                Déjà un compte ?{' '}
                <Link href="/login?redirect=%2Fetablissement%2Fcandidatures" className="text-primary underline">
                  Se connecter
                </Link>
              </span>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
