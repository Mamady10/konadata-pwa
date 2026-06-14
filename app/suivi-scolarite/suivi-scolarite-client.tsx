'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { getGuardianReportCardPdf } from '@/lib/actions/student-dossier';
import { formatPublicSchoolLabel } from '@/lib/school/org-name';
import type { PublicSchoolOption } from '@/lib/school/learner-application';
import { formatCurrency } from '@/lib/utils';
import { parseTuitionBalance } from '@/lib/school/student-payments';
import { reportCardPeriodLabel } from '@/lib/school/grading-period-settings';
import { GraduationCap, ArrowLeft, Download, CreditCard } from 'lucide-react';
import { LANDING_LINKS } from '@/lib/marketing/landing-links';
import {
  GUARDIAN_OTP_INTRO,
  guardianOtpChannelLabel,
} from '@/lib/school/guardian-otp-ui';
import type { GuardianOtpChannel } from '@/lib/auth/guardian-otp';

interface Props {
  schools: PublicSchoolOption[];
}

type Step = 'identify' | 'otp' | 'result';

function downloadBase64(base64: string, fileName: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function SuiviScolariteClient({ schools }: Props) {
  const [step, setStep] = useState<Step>('identify');
  const [schoolId, setSchoolId] = useState('');
  const [matricule, setMatricule] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [otpChannel, setOtpChannel] = useState<GuardianOtpChannel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  async function handleRequestOtp() {
    setError(null);
    setDevCode(null);
    setLoading(true);
    const res = await fetch('/api/guardian-portal/request-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId: schoolId,
        matricule: matricule.trim(),
        phone: phone.trim(),
      }),
    });
    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(json.error ?? 'Envoi du code échoué');
      return;
    }

    setChallengeId(json.challengeId as string);
    setStudentId(json.studentId as string);
    if (json.channel === 'whatsapp' || json.channel === 'sms') {
      setOtpChannel(json.channel);
    }
    if (json.devCode) setDevCode(json.devCode as string);
    setStep('otp');
  }

  async function handleVerifyOtp() {
    if (!challengeId || !studentId) return;
    setError(null);
    setLoading(true);
    const res = await fetch('/api/guardian-portal/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeId,
        studentId,
        code: otp.trim(),
      }),
    });
    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(json.error ?? 'Vérification échouée');
      return;
    }

    setData((json.data as Record<string, unknown>) ?? null);
    setStep('result');
  }

  async function handleBulletinPdf(cardId: string) {
    if (!cardId || !challengeId) return;
    setLoading(true);
    const result = await getGuardianReportCardPdf({
      challengeId,
      cardId,
    });
    setLoading(false);
    if ('error' in result && result.error) {
      setError(result.error);
      return;
    }
    if (result.base64 && result.fileName) {
      downloadBase64(result.base64, result.fileName);
    }
  }

  function resetFlow() {
    setStep('identify');
    setOtp('');
    setChallengeId(null);
    setStudentId(null);
    setDevCode(null);
    setOtpChannel(null);
    setData(null);
    setError(null);
  }

  const balance = data?.balance ? parseTuitionBalance(data.balance as Record<string, unknown>) : null;
  const bulletin = data?.latest_bulletin as Record<string, unknown> | null;
  const bulletinHistory = (data?.bulletin_history as Array<Record<string, unknown>>) ?? [];

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        <Link href={LANDING_LINKS.home} className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Accueil KonaData
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              Suivi scolarité
            </CardTitle>
            <CardDescription>{GUARDIAN_OTP_INTRO}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 'identify' && (
              <>
                <div className="space-y-2">
                  <Label>Établissement</Label>
                  <Select value={schoolId} onValueChange={setSchoolId}>
                    <SelectTrigger><SelectValue placeholder="Choisir l'école" /></SelectTrigger>
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
                  <Label>Matricule élève</Label>
                  <Input
                    value={matricule}
                    onChange={(e) => setMatricule(e.target.value)}
                    placeholder="Ex. TER-26-010"
                    className="font-mono uppercase"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Téléphone tuteur</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="6XX XX XX XX"
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button
                  className="w-full bg-[#2563EB]"
                  onClick={() => void handleRequestOtp()}
                  disabled={loading || !schoolId || !matricule.trim() || !phone.trim()}
                >
                  {loading ? 'Envoi…' : 'Recevoir le code (WhatsApp / SMS)'}
                </Button>
              </>
            )}

            {step === 'otp' && (
              <>
                <p className="text-sm rounded-lg bg-muted/50 p-3">
                  Un code a été envoyé
                  {otpChannel ? ` par ${guardianOtpChannelLabel(otpChannel)}` : ''} au numéro indiqué
                  pour le matricule{' '}
                  <strong className="font-mono">{matricule.trim().toUpperCase()}</strong>.
                  {devCode && (
                    <span className="block text-amber-700 font-mono mt-1">DEV : {devCode}</span>
                  )}
                </p>
                <div className="space-y-2">
                  <Label>
                    Code {otpChannel ? guardianOtpChannelLabel(otpChannel) : 'de confirmation'}
                  </Label>
                  <Input
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="6 chiffres"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={resetFlow}>
                    Retour
                  </Button>
                  <Button
                    className="flex-1 bg-[#2563EB]"
                    onClick={() => void handleVerifyOtp()}
                    disabled={loading || otp.trim().length < 4}
                  >
                    {loading ? 'Vérification…' : 'Confirmer et consulter'}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {step === 'result' && data && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{String(data.student_name)}</CardTitle>
              <CardDescription>
                {String(data.matricule)} · {String(data.class_name || 'Classe non assignée')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Statut :</span>
                <Badge>{String(data.enrollment_status_label)}</Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Année :</span>{' '}
                {String(data.academic_year)}
              </div>

              {balance && (
                <div className="rounded-lg border p-3 space-y-1">
                  <p className="font-medium">Situation scolarité</p>
                  <p>Total : {formatCurrency(balance.total_due_gnf)}</p>
                  <p>Payé : {formatCurrency(balance.paid_gnf)}</p>
                  <p className="font-medium text-primary">
                    Reste : {formatCurrency(balance.remaining_gnf)}
                  </p>
                </div>
              )}

              {(bulletinHistory.length > 0 || bulletin) && (
                <div className="rounded-lg border p-3 space-y-3">
                  <p className="font-medium">Bulletins publiés</p>
                  <ul className="space-y-2">
                    {(bulletinHistory.length > 0 ? bulletinHistory : bulletin ? [bulletin] : []).map(
                      (b) => (
                        <li
                          key={String(b.id)}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-2"
                        >
                          <div>
                            <p className="font-medium flex flex-wrap items-center gap-2">
                              <span>
                                {reportCardPeriodLabel(String(b.semester))} · {String(b.academic_year)}
                              </span>
                              <Badge variant="secondary">
                                {String(b.publication_status) === 'final' ? 'Définitif' : 'Provisoire'}
                              </Badge>
                            </p>
                            <p className="text-muted-foreground text-xs">
                              Moyenne{' '}
                              {b.average_score != null
                                ? Number(b.average_score).toFixed(2)
                                : '—'}
                              /20
                              {b.rank != null ? ` · Rang ${String(b.rank)}` : ''}
                              {b.has_archived_pdf ? ' · PDF archivé' : ''}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handleBulletinPdf(String(b.id))}
                            disabled={loading}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            PDF
                          </Button>
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}

              <Button asChild className="w-full" variant="outline">
                <Link href={LANDING_LINKS.payerScolarite}>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Payer la scolarité en ligne
                </Link>
              </Button>

              <Button variant="ghost" className="w-full text-xs" onClick={resetFlow}>
                Nouvelle consultation
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
