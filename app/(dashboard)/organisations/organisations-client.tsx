'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  platformSetBillingOffer,
  platformSendPaymentOfferEmail,
  platformActivateSchoolTrial,
  platformSuspendOrganization,
  platformRestoreOrganizationAccess,
  recordOfferActivationPayment,
  prepareSchoolRenewalBilling,
  type PendingOrganizationRow,
  type PlatformAccessMode,
} from '@/lib/actions/billing';
import { getSchoolBillingQuoteForCeo } from '@/lib/actions/school-onboarding';
import { ORG_TYPE_LABELS, type OrganizationType } from '@/types/database';
import { formatCurrency } from '@/lib/utils';
import {
  Building2,
  Users,
  MapPin,
  ExternalLink,
  Copy,
  Mail,
  ListChecks,
  FileText,
  Ban,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import {
  formatApplicationProfileForCeo,
  type OrgApplicationProfile,
} from '@/lib/org/org-registration-profile';
import { AiPlanOfferFields } from '@/components/platform/ai-plan-offer-fields';
import { getAiPlanDefaults } from '@/lib/ai/quota/plan-defaults';

interface Props {
  rows: PendingOrganizationRow[];
}

export function OrganisationsClient({ rows }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [activation, setActivation] = useState('');
  const [monthlyBase, setMonthlyBase] = useState('');
  const [perStudent, setPerStudent] = useState('');
  const [notes, setNotes] = useState('');
  const [trialMode, setTrialMode] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function startEdit(row: PendingOrganizationRow) {
    setEditing(row.id);
    setNotes('');
    setTrialMode(row.access_mode === 'trial_30d');
    setMsg(null);
    let act = Number(row.activation_amount_gnf ?? 0);
    let base = Number(row.monthly_base_gnf ?? 0);
    let per = Number(row.per_enrolled_student_gnf ?? 0);

    if (row.type === 'school') {
      if (!base) base = 3_600_000;
      if (!per) per = 300_000;
      const quote = await getSchoolBillingQuoteForCeo(row.id);
      if (!quote.error && quote.declaredAnnual > 0) {
        act = quote.declaredAnnual;
        setMsg(
          `Devis indicatif (effectif déclaré) : ${formatCurrency(quote.declaredAnnual)} — après import élèves : ${formatCurrency(quote.enrolledAnnual)}`
        );
      } else if (!act) {
        act = base + (row.declared_expected_students ?? 0) * per;
      }
    }

    setActivation(String(act));
    setMonthlyBase(String(base));
    setPerStudent(String(per));
  }

  async function copyPaymentLink(
    token: string,
    orgName: string,
    amountGnf: number,
    ceoNotes?: string | null
  ) {
    const url = `${window.location.origin}/paiement-organisation/${token}`;
    const lines = [
      `${orgName} — Activation KonaData`,
      `Montant validé : ${formatCurrency(amountGnf)}`,
      url,
    ];
    if (ceoNotes?.trim()) lines.push(`Note : ${ceoNotes.trim()}`);
    await navigator.clipboard.writeText(lines.join('\n'));
    setMsg('Lien + montant copiés — envoyez au responsable de l’organisation.');
  }

  async function saveOffer(
    orgId: string,
    orgType: string,
    aiPlan: { tier: string; monthlyCredits: number; maxRequestsPerDay: number }
  ) {
    const mode: PlatformAccessMode = orgType === 'school' && trialMode ? 'trial_30d' : 'annual';
    const res = await platformSetBillingOffer(
      orgId,
      mode === 'trial_30d' ? Number(activation) || 0 : Number(activation),
      Number(monthlyBase),
      Number(perStudent),
      notes || undefined,
      mode,
      aiPlan
    );
    if ('error' in res && res.error) {
      setMsg(res.error);
    } else if (res.emailSent) {
      setMsg('Tarif validé — lien de paiement envoyé par email au directeur.');
    } else if (res.emailWarning) {
      setMsg(`Tarif validé — ${res.emailWarning}`);
    } else if (mode === 'trial_30d') {
      setMsg('Essai 30 jours validé — montant 0 possible ; activez l’essai ou attendez paiement MoMo.');
    } else {
      setMsg('Tarif validé — statut « À payer ». Copiez le lien ou envoyez-le par email.');
    }
    setEditing(null);
  }

  async function sendPaymentEmail(orgId: string, orgName: string) {
    const res = await platformSendPaymentOfferEmail(orgId);
    if ('error' in res && res.error) {
      setMsg(res.error);
    } else {
      setMsg(`Lien de paiement envoyé à ${res.sentTo ?? 'le directeur'} (${orgName}).`);
    }
  }

  async function activateTrial(orgId: string) {
    const res = await platformActivateSchoolTrial(orgId, notes || undefined);
    setMsg(
      'error' in res && res.error
        ? res.error
        : 'Essai 30 jours activé — le directeur a accès au module pendant 30 jours.'
    );
  }

  async function markPaid(orgId: string) {
    const res = await recordOfferActivationPayment(orgId, 'CEO-validated');
    setMsg('error' in res && res.error ? res.error : 'Organisation activée.');
  }

  async function suspendOrg(orgId: string, orgName: string) {
    const reason = window.prompt(
      `Motif de suspension pour « ${orgName} » (visible par le directeur) :`,
      'Décision KonaData — contactez le support.'
    );
    if (reason === null) return;
    const res = await platformSuspendOrganization(orgId, reason);
    setMsg(
      'error' in res && res.error
        ? res.error
        : 'Accès organisation bloqué (abonnement en cours non utilisé tant que suspendu).'
    );
  }

  async function restoreOrg(orgId: string) {
    const res = await platformRestoreOrganizationAccess(orgId);
    setMsg(
      'error' in res && res.error ? res.error : 'Accès rétabli selon le statut d’abonnement.'
    );
  }

  function billingStatusLabel(status: string): string {
    if (status === 'pending_payment') return 'En attente paiement';
    if (status === 'pending_renewal') return 'Renouvellement à payer';
    if (status === 'suspended') return 'Suspendu (CEO)';
    if (status === 'active') return 'Actif';
    return status;
  }

  const pending = rows.filter((r) => r.billing_status === 'pending_payment');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Organisations</h1>
        <p className="text-muted-foreground">
          {rows.length} organisations — {pending.length} en attente d&apos;activation
        </p>
      </div>

      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

      <Card className="border-primary/20 bg-primary/[0.02]">
        <CardContent className="pt-6 space-y-3">
          <p className="font-semibold flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" />
            Parcours activation école
          </p>
          <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
            <li>Fixer le tarif + palier KonaAI (crédits / requêtes) → statut « À payer »</li>
            <li>Directeur paie via Paramètres (ou « Activer » / essai 30 jours)</li>
            <li>À l&apos;activation : quotas IA appliqués automatiquement</li>
          </ol>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {rows.map((org) => {
          const type = org.type as OrganizationType;
          const isEditing = editing === org.id;
          return (
            <Card key={org.id}>
              <CardContent className="p-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{org.name}</h3>
                      <Badge variant="outline" className="mt-1">
                        {ORG_TYPE_LABELS[type] ?? org.type}
                      </Badge>
                      <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                        {org.declared_expected_students != null && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            ~{org.declared_expected_students} élèves déclarés
                          </span>
                        )}
                        {org.declared_city && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {org.declared_city}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Badge
                    variant={
                      org.billing_status === 'active'
                        ? 'default'
                        : org.billing_status === 'suspended'
                          ? 'secondary'
                          : 'destructive'
                    }
                  >
                    {billingStatusLabel(org.billing_status)}
                  </Badge>
                </div>

                {org.billing_status === 'suspended' && org.ceo_suspend_reason && (
                  <p className="text-sm text-destructive border-l-2 border-destructive pl-3">
                    {org.ceo_suspend_reason}
                  </p>
                )}
                {org.billing_status === 'active' && org.subscription_valid_until && (
                  <p className="text-xs text-muted-foreground">
                    Abonnement valide jusqu&apos;au{' '}
                    {new Date(org.subscription_valid_until).toLocaleDateString('fr-FR')}
                  </p>
                )}

                {org.offer_status && (
                  <p className="text-sm">
                    Offre : {org.offer_status}
                    {org.access_mode === 'trial_30d' && (
                      <Badge variant="secondary" className="ml-2">
                        Essai 30j
                      </Badge>
                    )}
                    {' '}— activation{' '}
                    <strong>{formatCurrency(org.activation_amount_gnf ?? 0)}</strong>
                    {type === 'school' && (
                      <>
                        {' '}
                        | annuel {formatCurrency(org.monthly_base_gnf ?? 0)} +{' '}
                        {formatCurrency(org.per_enrolled_student_gnf ?? 0)}/élève/an
                      </>
                    )}
                  </p>
                )}
                {(org.ai_plan_tier || (org.application_profile as OrgApplicationProfile | null)?.requested_ai_plan) && (
                  <p className="text-xs text-muted-foreground">
                    KonaAI :{' '}
                    <strong>
                      {getAiPlanDefaults(
                        org.ai_plan_tier ??
                          (org.application_profile as OrgApplicationProfile)?.requested_ai_plan?.tier ??
                          'essentiel'
                      ).label}
                    </strong>
                    {' '}
                    — {org.ai_monthly_credits ?? (org.application_profile as OrgApplicationProfile)?.requested_ai_plan?.monthly_credits ?? '—'}{' '}
                    crédits/mois,{' '}
                    {org.ai_max_requests_per_day ??
                      (org.application_profile as OrgApplicationProfile)?.requested_ai_plan
                        ?.max_requests_per_day ??
                      '—'}{' '}
                    req./jour
                  </p>
                )}

                {formatApplicationProfileForCeo(
                  org.application_profile as OrgApplicationProfile | null
                ).length > 0 && (
                  <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Dossier d&apos;inscription
                    </p>
                    <dl className="grid gap-1 text-sm sm:grid-cols-2">
                      {formatApplicationProfileForCeo(
                        org.application_profile as OrgApplicationProfile | null
                      ).map((row) => (
                        <div key={row.label}>
                          <dt className="text-muted-foreground text-xs">{row.label}</dt>
                          <dd className="font-medium">{row.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}

                {org.ceo_notes && org.offer_status === 'draft' && (
                  <p className="text-xs text-muted-foreground italic">{org.ceo_notes}</p>
                )}

                {isEditing ? (
                  <form
                    className="grid gap-3 sm:grid-cols-3 border rounded-lg p-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      saveOffer(org.id, org.type, {
                        tier: String(fd.get('ai_plan_tier') ?? 'essentiel'),
                        monthlyCredits: Number(fd.get('ai_monthly_credits')) || 0,
                        maxRequestsPerDay: Number(fd.get('ai_max_requests_per_day')) || 0,
                      });
                    }}
                  >
                    <div>
                      <Label>
                        {org.type === 'school'
                          ? 'Montant annuel à payer avant accès (GNF)'
                          : 'Activation (GNF)'}
                      </Label>
                      <Input value={activation} onChange={(e) => setActivation(e.target.value)} type="number" />
                    </div>
                    <div>
                      <Label>
                        {org.type === 'school' ? 'Forfait annuel (GNF)' : 'Base mensuelle (GNF)'}
                      </Label>
                      <Input value={monthlyBase} onChange={(e) => setMonthlyBase(e.target.value)} type="number" />
                    </div>
                    <div>
                      <Label>
                        {org.type === 'school'
                          ? 'GNF / élève inscrit / an'
                          : 'GNF / élève (si applicable)'}
                      </Label>
                      <Input value={perStudent} onChange={(e) => setPerStudent(e.target.value)} type="number" />
                    </div>
                    <div className="sm:col-span-3">
                      <Label>Note au client</Label>
                      <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
                    </div>
                    {org.type === 'school' && (
                      <div className="sm:col-span-3 flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`trial-${org.id}`}
                          checked={trialMode}
                          onChange={(e) => {
                            setTrialMode(e.target.checked);
                            if (e.target.checked) setActivation('0');
                          }}
                        />
                        <Label htmlFor={`trial-${org.id}`} className="font-normal cursor-pointer">
                          Proposer un essai 30 jours (accès module, puis abonnement annuel)
                        </Label>
                      </div>
                    )}
                    <AiPlanOfferFields
                      orgType={org.type}
                      trialMode={trialMode}
                      initialTier={org.ai_plan_tier}
                      initialCredits={org.ai_monthly_credits}
                      initialRequests={org.ai_max_requests_per_day}
                      requestedTier={
                        (org.application_profile as OrgApplicationProfile | null)?.requested_ai_plan
                          ?.tier
                      }
                      requestedCredits={
                        (org.application_profile as OrgApplicationProfile | null)?.requested_ai_plan
                          ?.monthly_credits
                      }
                      requestedRequests={
                        (org.application_profile as OrgApplicationProfile | null)?.requested_ai_plan
                          ?.max_requests_per_day
                      }
                    />
                    <div className="sm:col-span-3 flex gap-2 flex-wrap">
                      <Button type="submit" className="bg-[#2563EB]">
                        Valider le tarif
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                        Annuler
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => startEdit(org)}>
                      Fixer le tarif
                    </Button>
                    {org.payment_token && org.offer_status === 'awaiting_payment' && (
                      <>
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/paiement-organisation/${org.payment_token}`} target="_blank">
                            <ExternalLink className="h-4 w-4" />
                            Ouvrir paiement
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            copyPaymentLink(
                              org.payment_token!,
                              org.name,
                              Number(org.activation_amount_gnf ?? 0),
                              org.ceo_notes
                            )
                          }
                        >
                          <Copy className="h-4 w-4" />
                          Copier lien + montant
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => sendPaymentEmail(org.id, org.name)}
                          title="Envoie le lien au directeur (email org_admin ou organisation)"
                        >
                          <Mail className="h-4 w-4" />
                          Envoyer par email
                        </Button>
                      </>
                    )}
                    {org.type === 'school' && org.billing_status === 'pending_payment' && (
                      <Button size="sm" variant="secondary" onClick={() => activateTrial(org.id)}>
                        Activer essai 30 jours (sans paiement)
                      </Button>
                    )}
                    {org.billing_status === 'pending_payment' && (
                      <Button size="sm" onClick={() => markPaid(org.id)}>
                        Activer (paiement reçu)
                      </Button>
                    )}
                    {org.billing_status === 'suspended' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-emerald-600 text-emerald-700"
                        onClick={() => restoreOrg(org.id)}
                      >
                        <ShieldCheck className="h-4 w-4 mr-1" />
                        Rétablir l&apos;accès
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => suspendOrg(org.id, org.name)}
                      >
                        <Ban className="h-4 w-4 mr-1" />
                        Bloquer l&apos;accès
                      </Button>
                    )}
                    {org.type === 'school' && org.billing_status === 'active' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          if (
                            !confirm(
                              `Préparer le renouvellement annuel pour « ${org.name} » ? L’établissement sera bloqué jusqu’au paiement.`
                            )
                          ) {
                            return;
                          }
                          const res = await prepareSchoolRenewalBilling(org.id);
                          setMsg(
                            'error' in res && res.error
                              ? res.error
                              : 'Renouvellement préparé — établissement bloqué jusqu’au paiement.'
                          );
                        }}
                      >
                        Préparer renouvellement annuel
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
