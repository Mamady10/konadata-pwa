'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CalendarRange, CreditCard, GraduationCap, Save } from 'lucide-react';
import { updateStudentPaymentOperationalSettings } from '@/lib/actions/student-payments';
import { updateSchoolOrgSettings } from '@/lib/actions/school-settings';
import type { SchoolOrgSettings } from '@/lib/school/school-org-settings';
import {
  PAYMENT_KIND_LABELS,
  type StudentPaymentSettings,
} from '@/lib/school/student-payments';
import { formatCurrency } from '@/lib/utils';

interface Props {
  initialSettings: StudentPaymentSettings;
  loadError?: string;
  orgName: string;
  schoolSettings?: SchoolOrgSettings;
  canEditSchoolSettings?: boolean;
}

export function PaiementsElevesClient({
  initialSettings,
  loadError,
  orgName,
  schoolSettings,
  canEditSchoolSettings,
}: Props) {
  const [settings, setSettings] = useState(initialSettings);
  const [registrarPayments, setRegistrarPayments] = useState(
    schoolSettings?.registrar_can_record_payments ?? false
  );
  const [msg, setMsg] = useState<string | null>(loadError ?? null);
  const [loading, setLoading] = useState(false);

  function patch(partial: Partial<StudentPaymentSettings>) {
    setSettings((s) => ({ ...s, ...partial }));
  }

  async function handleSave() {
    setLoading(true);
    setMsg(null);
    const res = await updateStudentPaymentOperationalSettings({
      enabled: settings.enabled,
      allow_enrollment_payment: settings.allow_enrollment_payment,
      allow_reenrollment_payment: settings.allow_reenrollment_payment,
      allow_tuition_payment: settings.allow_tuition_payment,
      orange_money_enabled: settings.orange_money_enabled,
      orange_money_merchant_phone: settings.orange_money_merchant_phone,
      orange_money_merchant_label: settings.orange_money_merchant_label,
    });
    if (res.error) {
      setLoading(false);
      setMsg(res.error);
      return;
    }
    if (canEditSchoolSettings) {
      const schoolRes = await updateSchoolOrgSettings({
        registrar_can_record_payments: registrarPayments,
      });
      if (schoolRes.error) {
        setLoading(false);
        setMsg(schoolRes.error);
        return;
      }
    }
    setLoading(false);
    setMsg('Réglages enregistrés. Les familles voient l’échéancier sur Candidatures.');
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/parametres">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            Paiements élèves
          </h1>
          <p className="text-muted-foreground">
            {orgName} — activation en ligne, types autorisés et Orange Money.
          </p>
        </div>
      </div>

      <Card className="border-indigo-500/30 bg-indigo-500/[0.03]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-indigo-600" />
            Tarifs & échéancier (lecture seule)
          </CardTitle>
          <CardDescription>
            Inscription, réinscription, versement minimum et tranches de scolarité se configurent
            dans{' '}
            <Link href="/parametres/annee-scolaire" className="text-primary underline">
              Année scolaire & tarifs
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <dl className="grid sm:grid-cols-2 gap-x-4 gap-y-2">
            <dt className="text-muted-foreground">Inscription</dt>
            <dd className="font-medium">{formatCurrency(settings.enrollment_new_fee_gnf)}</dd>
            <dt className="text-muted-foreground">Réinscription</dt>
            <dd className="font-medium">
              {formatCurrency(settings.enrollment_reenrollment_fee_gnf)}
            </dd>
            <dt className="text-muted-foreground">Versement minimum scolarité</dt>
            <dd className="font-medium">{formatCurrency(settings.min_payment_gnf)}</dd>
          </dl>
          {settings.tuition_installments.length > 0 ? (
            <ul className="text-xs text-muted-foreground space-y-1 border rounded-md p-3">
              {settings.tuition_installments.map((inst, i) => (
                <li key={i}>
                  {inst.label || `Tranche ${i + 1}`} — {inst.percent} %
                  {inst.due_date ? ` · avant le ${inst.due_date}` : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              Aucune tranche — montant annuel de la classe affiché aux familles.
            </p>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href="/parametres/annee-scolaire">Modifier tarifs & tranches</Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Paiements en ligne
            <Badge variant={settings.enabled ? 'default' : 'secondary'}>
              {settings.enabled ? 'Activés' : 'Désactivés'}
            </Badge>
          </CardTitle>
          <CardDescription>
            Activez les paiements familles et choisissez les types autorisés. Les montants GNF
            proviennent de l&apos;année scolaire et des frais par classe.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">Autoriser les paiements en ligne</p>
              <p className="text-sm text-muted-foreground">
                Désactivé = les familles paient à la caisse uniquement.
              </p>
            </div>
            <Switch checked={settings.enabled} onCheckedChange={(v) => patch({ enabled: v })} />
          </div>

          <div className="space-y-3 rounded-lg border border-orange-200/60 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Orange Money (confirmation auto)</p>
                <p className="text-xs text-muted-foreground">
                  Webhook : <code className="text-[10px]">/api/school-payment/webhook/orange-money</code>
                </p>
              </div>
              <Switch
                checked={settings.orange_money_enabled}
                onCheckedChange={(v) => patch({ orange_money_enabled: v })}
                disabled={!settings.enabled}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="om_phone">Numéro marchand / caisse Orange Money</Label>
                <Input
                  id="om_phone"
                  value={settings.orange_money_merchant_phone ?? ''}
                  onChange={(e) =>
                    patch({ orange_money_merchant_phone: e.target.value || null })
                  }
                  placeholder="6XX XX XX XX"
                  disabled={!settings.enabled || !settings.orange_money_enabled}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="om_label">Libellé compte (affiché aux familles)</Label>
                <Input
                  id="om_label"
                  value={settings.orange_money_merchant_label ?? ''}
                  onChange={(e) =>
                    patch({ orange_money_merchant_label: e.target.value || null })
                  }
                  placeholder="Ex. Caisse scolarité Lycée Alpha"
                  disabled={!settings.enabled || !settings.orange_money_enabled}
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            <p className="text-sm font-medium">Types de paiement proposés aux familles</p>
            {(
              [
                ['allow_enrollment_payment', 'enrollment'] as const,
                ['allow_reenrollment_payment', 'reenrollment'] as const,
                ['allow_tuition_payment', 'tuition'] as const,
              ] as const
            ).map(([key, kind]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm">{PAYMENT_KIND_LABELS[kind]}</span>
                <Switch
                  checked={settings[key]}
                  onCheckedChange={(v) => patch({ [key]: v })}
                  disabled={!settings.enabled}
                />
              </div>
            ))}
          </div>

          {settings.enabled && (
            <p className="text-xs text-muted-foreground">
              Portails famille :{' '}
              <Link href="/payer-scolarite" className="text-primary underline">
                /payer-scolarite
              </Link>
              {' · '}
              <Link href="/suivi-scolarite" className="text-primary underline">
                /suivi-scolarite
              </Link>{' '}
              (matricule + téléphone tuteur + code SMS).
            </p>
          )}

          {canEditSchoolSettings && (
            <div className="rounded-lg border p-4 space-y-3">
              <p className="font-medium text-sm">Scolarité & encaissements</p>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="registrar-pay" className="text-sm font-normal">
                    La scolarité peut enregistrer les paiements au guichet
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Scolarité, inscription et réinscription (espèces ou autre) depuis Établissement →
                    Paiements.
                  </p>
                </div>
                <Switch
                  id="registrar-pay"
                  checked={registrarPayments}
                  onCheckedChange={setRegistrarPayments}
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button className="bg-[#2563EB]" disabled={loading} onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>

          {msg && (
            <p
              className={`text-sm ${msg.includes('enregistr') ? 'text-emerald-600' : 'text-destructive'}`}
            >
              {msg}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
