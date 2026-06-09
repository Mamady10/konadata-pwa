'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createStaffStudentPaymentLink } from '@/lib/actions/student-payments';
import {
  DEFAULT_STUDENT_PAYMENT_SETTINGS,
  PAYMENT_KIND_LABELS,
  formatStaffPaymentEnrollmentLabel,
  suggestedStaffPaymentAmount,
  type StaffPaymentEnrollmentOption,
  type StudentPaymentKind,
  type StudentPaymentSettings,
} from '@/lib/school/student-payments';
import { formatCurrency } from '@/lib/utils';
import { Link2, Copy, Check } from 'lucide-react';

interface Props {
  students: Array<{ id: string; full_name: string; matricule?: string }>;
  minPaymentGnf?: number;
  paymentSettings?: StudentPaymentSettings | null;
  enrollments?: StaffPaymentEnrollmentOption[];
}

export function StaffPaymentLinkPanel({
  students,
  minPaymentGnf = 100_000,
  paymentSettings = null,
  enrollments = [],
}: Props) {
  const settings = paymentSettings ?? DEFAULT_STUDENT_PAYMENT_SETTINGS;

  const [studentId, setStudentId] = useState('');
  const [enrollmentId, setEnrollmentId] = useState('');
  const [paymentKind, setPaymentKind] = useState<StudentPaymentKind>('tuition');
  const [amount, setAmount] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const availableKinds = useMemo(() => {
    const kinds: StudentPaymentKind[] = [];
    if (settings.allow_tuition_payment) kinds.push('tuition');
    if (settings.allow_enrollment_payment) kinds.push('enrollment');
    if (settings.allow_reenrollment_payment) kinds.push('reenrollment');
    return kinds.length ? kinds : (['tuition'] as StudentPaymentKind[]);
  }, [settings]);

  const dossiersForLink = useMemo(() => {
    if (!studentId || paymentKind === 'tuition') return [];
    return enrollments.filter((e) => {
      if (e.studentId !== studentId) return false;
      if (paymentKind === 'enrollment') return (e.requestType || 'new') === 'new';
      return e.requestType === 'reenrollment';
    });
  }, [enrollments, studentId, paymentKind]);

  const fixedAmount = useMemo(
    () => (paymentKind === 'tuition' ? 0 : suggestedStaffPaymentAmount(paymentKind, settings)),
    [paymentKind, settings]
  );

  useEffect(() => {
    if (!availableKinds.includes(paymentKind)) {
      setPaymentKind(availableKinds[0]);
    }
  }, [availableKinds, paymentKind]);

  useEffect(() => {
    if (paymentKind === 'tuition') {
      setEnrollmentId('');
      return;
    }
    setEnrollmentId((current) => {
      if (dossiersForLink.length === 1) return dossiersForLink[0].id;
      if (current && dossiersForLink.some((d) => d.id === current)) return current;
      return '';
    });
  }, [paymentKind, dossiersForLink]);

  useEffect(() => {
    if (paymentKind === 'tuition') return;
    if (fixedAmount > 0) setAmount(String(fixedAmount));
  }, [paymentKind, fixedAmount]);

  async function generate() {
    if (!studentId) {
      setError('Choisissez un élève');
      return;
    }
    if (paymentKind !== 'tuition' && !enrollmentId) {
      setError('Choisissez le dossier d\'inscription ou de réinscription');
      return;
    }

    let amountGnf: number | null = null;
    if (paymentKind === 'tuition') {
      const parsed = Number(amount.replace(/\s/g, ''));
      if (!parsed || parsed < minPaymentGnf) {
        setError(`Montant minimum : ${formatCurrency(minPaymentGnf)}`);
        return;
      }
      amountGnf = parsed;
    } else if (fixedAmount <= 0) {
      setError('Frais non configurés — renseignez-les dans Paramètres → Paiements élèves');
      return;
    }

    setLoading(true);
    setError(null);
    setLink(null);
    const res = await createStaffStudentPaymentLink(
      studentId,
      paymentKind,
      paymentKind === 'tuition' ? null : enrollmentId,
      amountGnf
    );
    setLoading(false);

    if (res.error) {
      setError(res.error);
      return;
    }
    const token = (res.data as { payment_token?: string })?.payment_token;
    if (!token) {
      setError('Lien non généré');
      return;
    }
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    setLink(`${origin}/paiement-scolarite/${token}`);
  }

  async function copyLink() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Lien de paiement (élève sans compte)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          Générez un lien à envoyer par WhatsApp/SMS — scolarité, inscription ou réinscription.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label>Élève</Label>
            <Select
              value={studentId}
              onValueChange={(v) => {
                setStudentId(v);
                setEnrollmentId('');
                setLink(null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Matricule ou nom…" />
              </SelectTrigger>
              <SelectContent>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.full_name}
                    {s.matricule ? ` · ${s.matricule}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Type de frais</Label>
            <Select
              value={paymentKind}
              onValueChange={(v) => {
                setPaymentKind(v as StudentPaymentKind);
                setLink(null);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableKinds.map((k) => (
                  <SelectItem key={k} value={k}>
                    {PAYMENT_KIND_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {paymentKind === 'tuition' ? (
            <div className="space-y-1">
              <Label>Montant (GNF)</Label>
              <Input
                type="number"
                min={minPaymentGnf}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={String(minPaymentGnf)}
              />
            </div>
          ) : (
            <div className="space-y-1">
              <Label>Montant (GNF)</Label>
              <Input
                type="text"
                readOnly
                value={fixedAmount > 0 ? formatCurrency(fixedAmount) : 'Non configuré'}
                className="bg-muted/40"
              />
            </div>
          )}

          {paymentKind !== 'tuition' && (
            <div className="space-y-1 sm:col-span-2">
              <Label>Dossier</Label>
              <Select value={enrollmentId} onValueChange={setEnrollmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir le dossier" />
                </SelectTrigger>
                <SelectContent>
                  {dossiersForLink.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {formatStaffPaymentEnrollmentLabel(d)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {studentId && dossiersForLink.length === 0 && (
                <p className="text-xs text-amber-700">
                  Aucun dossier {paymentKind === 'enrollment' ? 'd\'inscription' : 'de réinscription'}{' '}
                  en cours pour cet élève.
                </p>
              )}
            </div>
          )}

          <div className={`flex items-end ${paymentKind !== 'tuition' ? 'sm:col-span-2' : ''}`}>
            <Button
              className="w-full bg-[#2563EB]"
              disabled={loading}
              onClick={() => void generate()}
            >
              {loading ? 'Génération…' : 'Générer le lien'}
            </Button>
          </div>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        {link && (
          <div className="flex gap-2 items-center rounded-lg border p-2 bg-muted/30">
            <code className="text-[10px] flex-1 break-all">{link}</code>
            <Button type="button" size="sm" variant="outline" onClick={() => void copyLink()}>
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
