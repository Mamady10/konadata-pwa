'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Play,
  Square,
  MapPin,
  Users,
  Link2,
  Copy,
  BarChart3,
  Mail,
  Send,
  ShieldAlert,
  CreditCard,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/utils';
import { SURVEY_CHARGE_STATUS_LABELS } from '@/lib/ngo/survey-billing';
import type { NgoSurveyQuestion } from '@/lib/ngo/survey-questions';
import { ParticipationQrCode } from './participation-qr-code';

interface Props {
  survey: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    rawStatus: string;
    region: string | null;
    projectName: string | null;
    startsAt: string | null;
    endsAt: string | null;
    targetResponses: number | null;
    collectionMode: string;
    questions: NgoSurveyQuestion[];
    publicToken: string | null;
    allowsOnlineParticipation: boolean;
  };
  stats: {
    responseCount: number;
    targetResponses: number | null;
    progressPct: number | null;
    byRegion: { label: string; count: number }[];
    byChoice: { label: string; count: number }[];
    assignedAgents: number;
  };
  responses: { id: string; locality: string; answer: string; createdAt: string }[];
  assignedAgents: { id: string; name: string }[];
  availableStaff: { id: string; name: string }[];
  isDirector: boolean;
  participationUrl: string | null;
  participationReady: boolean;
  directorEmail: string | null;
  onActivate: (id: string, status: string) => Promise<{ error?: string }>;
  onClose: (id: string, status: string) => Promise<{ error?: string }>;
  onAssignAgents: (surveyId: string, ids: string[]) => Promise<{ error?: string }>;
  onSendParticipationLink: (
    surveyId: string,
    emails: string,
    message?: string
  ) => Promise<{ error?: string; success?: boolean; sent?: number }>;
  onSendPaymentEmail: (
    surveyId: string
  ) => Promise<{ error?: string; success?: boolean; sentTo?: string; emailSkipped?: boolean }>;
  securityAlerts: { id: string; severity: string; message: string; createdAt: string }[];
  charge: {
    status: string;
    amountGnf: number;
    paymentToken: string | null;
    targetResponses: number;
    ceoNotes?: string | null;
    isRevision?: boolean;
    previousAmountGnf?: number | null;
  } | null;
}

export function SondageDetailClient({
  survey,
  stats,
  responses,
  assignedAgents,
  availableStaff,
  isDirector,
  participationUrl,
  participationReady,
  directorEmail,
  onActivate,
  onClose,
  onAssignAgents,
  onSendParticipationLink,
  onSendPaymentEmail,
  securityAlerts,
  charge,
}: Props) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [paymentEmailStatus, setPaymentEmailStatus] = useState<string | null>(null);
  const [paymentEmailSending, setPaymentEmailSending] = useState(false);
  const [selectedAgents, setSelectedAgents] = useState<string[]>(
    assignedAgents.map((a) => a.id).filter(Boolean)
  );

  async function activate() {
    const res = await onActivate(survey.id, 'active');
    setMsg(res.error ?? 'Sondage activé');
    router.refresh();
  }

  async function closeSurvey() {
    const res = await onClose(survey.id, 'closed');
    setMsg(res.error ?? 'Sondage clôturé');
    router.refresh();
  }

  async function saveAgents() {
    const res = await onAssignAgents(survey.id, selectedAgents);
    setMsg(res.error ?? 'Agents assignés');
    router.refresh();
  }

  function toggleAgent(id: string) {
    setSelectedAgents((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const period =
    survey.startsAt || survey.endsAt
      ? `${survey.startsAt ? new Date(survey.startsAt).toLocaleString('fr-FR') : '—'} → ${survey.endsAt ? new Date(survey.endsAt).toLocaleString('fr-FR') : '—'}`
      : 'Non programmé';

  const maxChoiceCount = Math.max(1, ...stats.byChoice.map((c) => c.count));

  async function copyParticipationLink() {
    if (!participationUrl) return;
    await navigator.clipboard.writeText(participationUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  async function sendParticipationEmail(recipients: string) {
    if (!recipients.trim()) {
      setEmailStatus('Indiquez au moins un numéro ou une adresse email.');
      return;
    }
    setEmailSending(true);
    setEmailStatus(null);
    const res = await onSendParticipationLink(survey.id, recipients, emailMessage);
    setEmailSending(false);
    if (res.error) {
      setEmailStatus(res.error);
      return;
    }
    setEmailStatus(
      res.sent && res.sent > 1
        ? `Lien envoyé à ${res.sent} destinataires.`
        : 'Lien de participation envoyé.'
    );
    setEmailRecipients('');
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/ong/sondages">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{survey.title}</h1>
          <p className="text-muted-foreground">{survey.description ?? 'Enquête terrain ONG'}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="outline">{survey.status}</Badge>
            <Badge variant="secondary">{survey.collectionMode}</Badge>
            {survey.region && <Badge variant="secondary">{survey.region}</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline" asChild>
            <Link href={`/ong/sondages/${survey.id}/analytiques`}>
              <BarChart3 className="h-4 w-4 mr-1" />
              Analytiques
            </Link>
          </Button>
          {['active', 'scheduled'].includes(survey.rawStatus) && (
            <Button asChild>
              <Link href={`/ong/sondages/${survey.id}/collecter`}>Collecter</Link>
            </Button>
          )}
          {isDirector && survey.rawStatus !== 'active' && survey.rawStatus !== 'closed' && (
            <Button variant="outline" onClick={activate}>
              <Play className="h-4 w-4" /> Activer
            </Button>
          )}
          {isDirector && survey.rawStatus === 'active' && (
            <Button variant="outline" onClick={closeSurvey}>
              <Square className="h-4 w-4" /> Clôturer
            </Button>
          )}
        </div>
      </div>

      {msg && <p className="text-sm text-muted-foreground bg-muted rounded-lg px-3 py-2">{msg}</p>}

      {isDirector && charge && charge.status !== 'waived' && (
        <Card className={charge.status === 'pending_payment' ? 'border-amber-300' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Facturation campagne (hors abonnement)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={charge.status === 'paid' ? 'default' : 'secondary'}>
                {SURVEY_CHARGE_STATUS_LABELS[charge.status] ?? charge.status}
              </Badge>
              <span className="font-semibold">
                {charge.status === 'awaiting_ceo_quote'
                  ? 'Tarif en cours'
                  : formatCurrency(charge.amountGnf)}
              </span>
              <span className="text-sm text-muted-foreground">
                pour {charge.targetResponses} personnes cibles
              </span>
            </div>
            {charge.status === 'awaiting_ceo_quote' && (
              <p className="text-sm text-muted-foreground">
                Votre demande a été transmise à KonaData. Le tarif sera fixé selon votre organisation
                et le nombre de personnes cibles. Vous recevrez un email avec le lien de paiement.
              </p>
            )}
            {charge.isRevision && charge.previousAmountGnf != null && (
              <p className="text-sm text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
                Tarif mis à jour suite à négociation :{' '}
                <span className="line-through">{formatCurrency(charge.previousAmountGnf)}</span>
                {' → '}
                <strong>{formatCurrency(charge.amountGnf)}</strong>
              </p>
            )}
            {charge.ceoNotes && (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">Note KonaData :</span> {charge.ceoNotes}
              </p>
            )}
            {charge.status === 'awaiting_payment' && charge.paymentToken && (
              <div className="flex flex-wrap gap-2">
                <Button asChild className="bg-[#2563EB]">
                  <Link href={`/paiement-sondage/${charge.paymentToken}`}>
                    Payer la campagne
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={paymentEmailSending}
                  onClick={async () => {
                    setPaymentEmailSending(true);
                    setPaymentEmailStatus(null);
                    const res = await onSendPaymentEmail(survey.id);
                    setPaymentEmailSending(false);
                    if (res.error) {
                      setPaymentEmailStatus(res.error);
                      return;
                    }
                    setPaymentEmailStatus(
                      res.sentTo
                        ? `Lien de paiement envoyé à ${res.sentTo}`
                        : 'Email envoyé'
                    );
                  }}
                >
                  <Mail className="h-3 w-3 mr-1" />
                  {paymentEmailSending ? 'Envoi…' : 'Envoyer lien par email'}
                </Button>
              </div>
            )}
            {paymentEmailStatus && (
              <p className="text-xs text-muted-foreground">{paymentEmailStatus}</p>
            )}
            {charge.status === 'awaiting_payment' && (
              <p className="text-xs text-muted-foreground">
                Le sondage reste en brouillon tant que la campagne n&apos;est pas réglée.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {isDirector && securityAlerts.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-amber-900">
              <ShieldAlert className="h-4 w-4" />
              Alertes sécurité ({securityAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {securityAlerts.map((a) => (
              <div
                key={a.id}
                className={`text-sm flex justify-between gap-3 rounded px-2 py-1.5 ${
                  a.severity === 'critical' ? 'bg-red-100 text-red-900' : 'bg-amber-100/80 text-amber-900'
                }`}
              >
                <span>{a.message}</span>
                <span className="text-xs shrink-0 opacity-70">{a.createdAt}</span>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Pic de réponses ou répétitions suspectes (même choix + localité). Vérifiez les
              résultats avant publication.
            </p>
          </CardContent>
        </Card>
      )}

      {isDirector && survey.publicToken && survey.allowsOnlineParticipation && participationUrl && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Partager le sondage
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!participationReady && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p className="font-medium">Le QR / lien ne fonctionnera pas tant que :</p>
                <ul className="list-disc pl-5 mt-1 space-y-0.5 text-xs">
                  {survey.rawStatus === 'draft' && (
                    <li>le sondage n&apos;est pas <strong>activé</strong> (bouton Activer)</li>
                  )}
                  {charge &&
                    !['paid', 'waived'].includes(charge.status) && (
                      <li>
                        la campagne n&apos;est pas payée (statut :{' '}
                        {SURVEY_CHARGE_STATUS_LABELS[charge.status] ?? charge.status})
                      </li>
                    )}
                </ul>
              </div>
            )}
            <div className="flex flex-col md:flex-row gap-6">
              {participationReady ? (
                <ParticipationQrCode url={participationUrl} surveyTitle={survey.title} />
              ) : (
                <div className="w-[260px] h-[260px] shrink-0 rounded-lg border border-dashed flex items-center justify-center text-center text-xs text-muted-foreground p-4">
                  QR disponible après activation et paiement de la campagne
                </div>
              )}
              <div className="flex-1 space-y-4 min-w-0">
                <p className="text-sm text-muted-foreground">
                  Copiez le lien, envoyez-le par email ou publiez le QR code sur vos réseaux pour
                  inviter les participants au QCM.
                </p>
                <div className="flex flex-wrap gap-2 items-center">
                  <code className="text-xs bg-muted px-2 py-1 rounded break-all flex-1 min-w-0">
                    {participationUrl}
                  </code>
                  <Button size="sm" variant="outline" onClick={copyParticipationLink}>
                    <Copy className="h-3 w-3 mr-1" />
                    {linkCopied ? 'Copié' : 'Copier'}
                  </Button>
                </div>

                <div className="rounded-lg border p-4 space-y-3">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Envoyer le lien (WhatsApp, SMS ou email)
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="survey-email-to">Destinataire(s)</Label>
                    <Input
                      id="survey-email-to"
                      type="text"
                      placeholder="+224 6XX XX XX XX, email@exemple.com"
                      value={emailRecipients}
                      onChange={(e) => setEmailRecipients(e.target.value)}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Numéros (WhatsApp/SMS) et/ou emails séparés par une virgule ou un espace.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="survey-email-msg">Message (optionnel)</Label>
                    <Input
                      id="survey-email-msg"
                      placeholder="Votre avis compte pour notre projet…"
                      value={emailMessage}
                      onChange={(e) => setEmailMessage(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="bg-[#2563EB]"
                      disabled={emailSending}
                      onClick={() => sendParticipationEmail(emailRecipients)}
                    >
                      <Send className="h-3 w-3 mr-1" />
                      {emailSending ? 'Envoi…' : 'Envoyer'}
                    </Button>
                    {directorEmail && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={emailSending}
                        onClick={() => sendParticipationEmail(directorEmail)}
                      >
                        M&apos;envoyer le lien
                      </Button>
                    )}
                  </div>
                  {emailStatus && (
                    <p className="text-xs text-muted-foreground">{emailStatus}</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isDirector && survey.publicToken && !survey.allowsOnlineParticipation && (
        <p className="text-sm text-muted-foreground bg-amber-500/10 border border-amber-200 rounded-lg px-3 py-2">
          Participation en ligne désactivée : choisissez le mode « Mixte » ou « Auto-déclaration » pour activer le lien public.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Réponses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {stats.responseCount}
              {stats.targetResponses ? ` / ${stats.targetResponses}` : ''}
            </p>
            {stats.progressPct != null && (
              <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-[#2563EB] rounded-full"
                  style={{ width: `${stats.progressPct}%` }}
                />
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Période</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{period}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Projet</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{survey.projectName ?? '—'}</CardContent>
        </Card>
      </div>

      {isDirector && availableStaff.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Agents assignés ({stats.assignedAgents})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {availableStaff.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleAgent(s.id)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    selectedAgents.includes(s.id)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-muted'
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
            <Button size="sm" onClick={saveAgents}>
              Enregistrer les assignations
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-decimal list-inside text-sm space-y-2">
            {survey.questions.map((q) => (
              <li key={q.id}>
                <span>{q.text}</span>
                {q.options?.length ? (
                  <ul className="list-disc list-inside ml-4 mt-1 text-muted-foreground">
                    {q.options.map((opt) => (
                      <li key={opt}>{opt}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-muted-foreground"> ({q.type})</span>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {stats.byChoice.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Résultats par réponse
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/ong/sondages/${survey.id}/analytiques`}>
                Dashboard complet →
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.byChoice.map((c) => (
              <div key={c.label} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{c.label}</span>
                  <span className="text-muted-foreground">
                    {c.count}
                    {stats.responseCount > 0
                      ? ` (${Math.round((c.count / stats.responseCount) * 100)} %)`
                      : ''}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-[#2563EB] rounded-full transition-all"
                    style={{ width: `${(c.count / maxChoiceCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {stats.byRegion.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Par localité
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.byRegion.map((r) => (
              <div key={r.label} className="flex justify-between text-sm">
                <span>{r.label}</span>
                <span className="font-medium">{r.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dernières réponses</CardTitle>
        </CardHeader>
        <CardContent>
          {responses.length ? (
            <ul className="text-sm space-y-2">
              {responses.map((r) => (
                <li key={r.id} className="flex justify-between gap-3 border-b pb-2 last:border-0">
                  <span className="truncate">
                    <span className="font-medium">{r.answer}</span>
                    {r.locality !== '—' && (
                      <span className="text-muted-foreground"> · {r.locality}</span>
                    )}
                  </span>
                  <span className="text-muted-foreground shrink-0">{r.createdAt}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Aucune réponse pour l&apos;instant.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
