'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditCard, Plus, Save, Trash2 } from 'lucide-react';
import {
  saveAcademicYearFeeSetup,
  type AcademicYearFeeSetup,
} from '@/lib/actions/academic-year-fees';
import {
  sumInstallmentPercents,
  type TuitionInstallment,
} from '@/lib/school/student-payments';
import { formatCurrency } from '@/lib/utils';

const DEFAULT_PERCENT_SCHEDULE: TuitionInstallment[] = [
  { label: '1ère tranche', percent: 40, due_date: '' },
  { label: '2e tranche', percent: 30, due_date: '' },
  { label: '3e tranche', percent: 30, due_date: '' },
];

function emptyInstallment(): TuitionInstallment {
  return { label: '', percent: 0, due_date: '' };
}

interface Props {
  initialSetup: AcademicYearFeeSetup;
  prepNextYear?: boolean;
}

export function AnneeScolaireFees({ initialSetup, prepNextYear }: Props) {
  const [year] = useState(initialSetup.year);
  const [enrollmentNew, setEnrollmentNew] = useState(
    initialSetup.paymentSettings.enrollment_new_fee_gnf
  );
  const [enrollmentRe, setEnrollmentRe] = useState(
    initialSetup.paymentSettings.enrollment_reenrollment_fee_gnf
  );
  const [minPayment, setMinPayment] = useState(initialSetup.paymentSettings.min_payment_gnf);
  const [installments, setInstallments] = useState<TuitionInstallment[]>(
    initialSetup.paymentSettings.tuition_installments.length > 0
      ? initialSetup.paymentSettings.tuition_installments
      : [...DEFAULT_PERCENT_SCHEDULE]
  );
  const [classFees, setClassFees] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const c of initialSetup.classes) {
      const fee =
        c.tuition_fee_gnf != null && c.tuition_fee_gnf > 0
          ? String(c.tuition_fee_gnf)
          : String(initialSetup.orgDefaultTuitionGnf);
      map[c.id] = fee;
    }
    return map;
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const percentTotal = sumInstallmentPercents(installments);
  const percentOk = installments.length === 0 || Math.abs(percentTotal - 100) < 0.01;

  function patchInstallment(index: number, partial: Partial<TuitionInstallment>) {
    setInstallments((list) => {
      const next = [...list];
      next[index] = { ...next[index], ...partial };
      return next;
    });
  }

  async function handleSave() {
    if (!percentOk) {
      setMsg('Les tranches doivent totaliser 100 %.');
      return;
    }
    setLoading(true);
    setMsg(null);
    const res = await saveAcademicYearFeeSetup({
      enrollmentNewFeeGnf: enrollmentNew,
      enrollmentReenrollmentFeeGnf: enrollmentRe,
      minPaymentGnf: minPayment,
      tuitionInstallments: installments,
      classTuitions: initialSetup.classes.map((c) => ({
        classId: c.id,
        tuitionFeeGnf: Math.max(0, Number(classFees[c.id]) || 0),
      })),
    });
    setLoading(false);
    if ('error' in res && res.error) {
      setMsg(res.error);
      return;
    }
    setMsg(`Tarifs et échéancier enregistrés pour ${year}.`);
  }

  return (
    <Card className="border-emerald-500/30">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-emerald-600" />
          Tarifs &amp; échéancier — {year}
        </CardTitle>
        <CardDescription>
          {prepNextYear
            ? `Préparez la rentrée ${year} : inscription, réinscription, tranches et frais par classe. Les réglages s'appliquent dès l'ouverture de l'année.`
            : `Mettez à jour les frais chaque rentrée : inscription, réinscription, tranches de scolarité et montant annuel par classe de ${year}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fee-new">Frais d&apos;inscription (GNF)</Label>
            <Input
              id="fee-new"
              type="number"
              min={0}
              value={enrollmentNew}
              onChange={(e) => setEnrollmentNew(Math.max(0, Number(e.target.value) || 0))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fee-re">Frais de réinscription (GNF)</Label>
            <Input
              id="fee-re"
              type="number"
              min={0}
              value={enrollmentRe}
              onChange={(e) => setEnrollmentRe(Math.max(0, Number(e.target.value) || 0))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="min-pay">Versement minimum scolarité (GNF)</Label>
            <Input
              id="min-pay"
              type="number"
              min={10000}
              step={10000}
              value={minPayment}
              onChange={(e) => setMinPayment(Math.max(10_000, Number(e.target.value) || 100_000))}
            />
          </div>
        </div>

        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">Échéancier scolarité (% + dates)</p>
              <p className="text-xs text-muted-foreground">
                Même calendrier pour toutes les classes ; le montant GNF de chaque tranche est
                calculé selon les frais de la classe.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setInstallments([...DEFAULT_PERCENT_SCHEDULE])}
              >
                Modèle 40-30-30
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setInstallments((l) => [...l, emptyInstallment()])}
              >
                <Plus className="h-3 w-3 mr-1" />
                Tranche
              </Button>
            </div>
          </div>
          {installments.map((inst, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-12 items-end border rounded-md p-2">
              <div className="sm:col-span-4 space-y-1">
                <Label className="text-xs">Libellé</Label>
                <Input
                  value={inst.label}
                  onChange={(e) => patchInstallment(i, { label: e.target.value })}
                />
              </div>
              <div className="sm:col-span-3 space-y-1">
                <Label className="text-xs">Part (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={inst.percent || ''}
                  onChange={(e) =>
                    patchInstallment(i, {
                      percent: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                    })
                  }
                />
              </div>
              <div className="sm:col-span-4 space-y-1">
                <Label className="text-xs">Date limite</Label>
                <Input
                  type="date"
                  value={inst.due_date}
                  onChange={(e) => patchInstallment(i, { due_date: e.target.value })}
                />
              </div>
              <div className="sm:col-span-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setInstallments((l) => l.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          <p
            className={`text-xs ${percentOk ? 'text-muted-foreground' : 'text-amber-800 font-medium'}`}
          >
            Total des parts : {percentTotal.toFixed(0)} %
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium">Frais de scolarité par classe ({year})</p>
          {initialSetup.classes.length === 0 ? (
            <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-4">
              Aucune classe active pour {year}.
              {prepNextYear
                ? ' Ouvrez la nouvelle année (avec copie des classes) pour les renseigner ici, ou créez-les dans '
                : ' Ouvrez la nouvelle année ou créez des classes dans '}
              <Link href="/etablissement/formations" className="text-primary underline">
                Formations
              </Link>
              . Les frais d&apos;inscription, réinscription et tranches peuvent être enregistrés dès
              maintenant.
            </p>
          ) : (
            <ul className="space-y-2">
              {initialSetup.classes.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{c.name}</p>
                    {c.level && (
                      <p className="text-xs text-muted-foreground">{c.level}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      className="w-36"
                      value={classFees[c.id] ?? ''}
                      onChange={(e) =>
                        setClassFees((m) => ({ ...m, [c.id]: e.target.value }))
                      }
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">GNF / an</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {initialSetup.classes.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Défaut établissement si non renseigné :{' '}
              {formatCurrency(initialSetup.orgDefaultTuitionGnf)}
            </p>
          )}
        </div>

        {msg && (
          <p
            className={`text-sm rounded-lg px-3 py-2 ${
              msg.includes('enregistrés')
                ? 'bg-emerald-500/10 text-emerald-900'
                : 'bg-destructive/10 text-destructive'
            }`}
          >
            {msg}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleSave} disabled={loading || !percentOk}>
            <Save className="h-4 w-4" />
            {loading ? 'Enregistrement…' : `Enregistrer les tarifs ${year}`}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/parametres/paiements-eleves">Paiements en ligne (Orange Money…)</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
