'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createNgoSurvey, updateNgoSurveyStatus } from '@/lib/actions/ngo-surveys';
import { formatCurrency } from '@/lib/utils';
import { SURVEY_CHARGE_STATUS_LABELS } from '@/lib/ngo/survey-billing';
import { ClipboardList, Plus, Search, Play, Square, Settings, Eye, CreditCard } from 'lucide-react';
import { motion } from 'framer-motion';

interface SurveyRow {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  rawStatus: string;
  date?: string;
  responseCount: number;
  targetResponses: number | null;
  collectionMode: string;
  chargeStatus?: string | null;
  chargeAmountGnf?: number | null;
  paymentToken?: string | null;
  campaignEndsAt?: string | null;
  finalReportAt?: string | null;
}

interface Props {
  items: SurveyRow[];
  projects: { id: string; name: string }[];
  isDirector: boolean;
  settingsEnabled: boolean;
  surveyOnly?: boolean;
  canCreateSurvey?: boolean;
  createBlockedMessage?: string;
}

export function SondagesClient({
  items: initialItems,
  projects,
  isDirector,
  settingsEnabled,
  surveyOnly = false,
  canCreateSurvey = true,
  createBlockedMessage,
}: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('draft');
  const [collectionMode, setCollectionMode] = useState('mixed');
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set('status', status);
    fd.set('collection_mode', collectionMode);
    const result = await createNgoSurvey(fd);
    if (result.error) {
      setError(result.error);
      return;
    }
    setShowForm(false);
    if (result.awaitingCeoQuote) {
      const ceoPart = result.ceoNotified
        ? ' KonaData a été notifiée par email.'
        : result.ceoNotifyWarning
          ? ` (${result.ceoNotifyWarning})`
          : '';
      setPaymentNotice(
        `Demande envoyée — le CEO KonaData fixera le tarif selon votre organisation et le nombre de cibles.${ceoPart}`
      );
    }
    router.refresh();
  }

  async function handleStatus(id: string, newStatus: string) {
    const result = await updateNgoSurveyStatus(id, newStatus);
    if (result.error) setError(result.error);
    router.refresh();
  }

  const items = initialItems.filter(
    (i) =>
      i.title.toLowerCase().includes(query.toLowerCase()) ||
      i.subtitle.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Sondages</h1>
            <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-200">
              {isDirector ? 'Direction' : 'Collecte terrain'}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {initialItems.length} enquête(s)
            {!settingsEnabled && ' — module désactivé dans Paramètres'}
          </p>
        </div>
        <div className="flex gap-2">
          {isDirector && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/parametres/sondages-ong">
                <Settings className="h-4 w-4" />
                Paramètres
              </Link>
            </Button>
          )}
          {isDirector && settingsEnabled && canCreateSurvey && (
            <Button onClick={() => setShowForm(!showForm)} className="bg-[#2563EB] hover:bg-[#2563EB]/90">
              <Plus className="h-4 w-4" /> Programmer
            </Button>
          )}
        </div>
      </div>

      {surveyOnly && isDirector && (
        <p className="text-sm bg-teal-500/10 border border-teal-200 rounded-lg px-3 py-2 text-teal-900">
          <strong>Abonnement par campagne</strong> — vous pouvez préparer un nouveau sondage même si
          une campagne précédente est en cours. Chaque sondage doit être payé avant activation.
          Après le rapport final, l&apos;accès à cette campagne se termine 15 jours plus tard.
        </p>
      )}

      {isDirector && !canCreateSurvey && createBlockedMessage && (
        <p className="text-sm bg-amber-500/10 border border-amber-200 rounded-lg px-3 py-2 text-amber-900">
          {createBlockedMessage}
        </p>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Nouveau sondage</CardTitle>
          </CardHeader>
          <CardContent>
            {error && <p className="text-sm text-destructive mb-3">{error}</p>}
            <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Titre *</Label>
                <Input name="title" required />
              </div>
              <div className="space-y-2">
                <Label>Projet lié</Label>
                <select
                  name="project_id"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  defaultValue=""
                >
                  <option value="">— Aucun —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Région</Label>
                <Input name="region" placeholder="Kindia, Labé…" />
              </div>
              <div className="space-y-2">
                <Label>Début programmé</Label>
                <Input name="starts_at" type="datetime-local" />
              </div>
              <div className="space-y-2">
                <Label>Fin programmée</Label>
                <Input name="ends_at" type="datetime-local" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Personnes cibles (objectif réponses) *</Label>
                <Input name="target_responses" type="number" min={1} placeholder="500" required />
                <p className="text-xs text-muted-foreground">
                  Transmis à KonaData pour établir le devis campagne (hors abonnement).
                </p>
              </div>
              <div className="space-y-2">
                <Label>Statut initial</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Brouillon</SelectItem>
                    <SelectItem value="scheduled">Programmé</SelectItem>
                    <SelectItem value="active">En cours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Mode collecte</Label>
                <Select value={collectionMode} onValueChange={setCollectionMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="field_agent">Agents terrain</SelectItem>
                    <SelectItem value="mixed">Mixte</SelectItem>
                    <SelectItem value="self_service">Auto-déclaration</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Question principale *</Label>
                <Input name="question" placeholder="Avez-vous accès à l'eau potable ?" required />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-muted-foreground text-xs">
                  Réponses attendues (QCM — le participant en choisit une)
                </Label>
              </div>
              <div className="space-y-2">
                <Label>Option 1 *</Label>
                <Input name="option_1" placeholder="Oui, quotidiennement" required />
              </div>
              <div className="space-y-2">
                <Label>Option 2 *</Label>
                <Input name="option_2" placeholder="Parfois" required />
              </div>
              <div className="space-y-2">
                <Label>Option 3 *</Label>
                <Input name="option_3" placeholder="Non, jamais" required />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Description</Label>
                <Input name="description" />
              </div>
              <div className="sm:col-span-2 flex gap-2">
                <Button type="submit" className="bg-[#2563EB]">
                  Enregistrer
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Annuler
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {paymentNotice && (
        <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          {paymentNotice}
        </p>
      )}

      {error && !showForm && <p className="text-sm text-destructive">{error}</p>}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher…"
          className="pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {items.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <ClipboardList className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link href={`/ong/sondages/${item.id}`} className="font-semibold hover:text-primary truncate block">
                        {item.title}
                      </Link>
                      <p className="text-sm text-muted-foreground truncate">{item.subtitle}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-[10px]">
                          {item.status}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{item.collectionMode}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {item.responseCount}
                        {item.targetResponses ? ` / ${item.targetResponses}` : ''} réponses
                        {item.date ? ` · ${item.date}` : ''}
                      </p>
                      {item.chargeStatus && item.chargeStatus !== 'waived' && (
                        <p className="text-[10px] mt-1 space-y-0.5">
                          <Badge
                            variant={item.chargeStatus === 'paid' ? 'default' : 'secondary'}
                            className="text-[10px]"
                          >
                            {SURVEY_CHARGE_STATUS_LABELS[item.chargeStatus] ?? item.chargeStatus}
                            {item.chargeAmountGnf
                              ? ` · ${formatCurrency(item.chargeAmountGnf)}`
                              : ''}
                          </Badge>
                          {item.campaignEndsAt && item.chargeStatus !== 'expired' && (
                            <span className="block text-muted-foreground">
                              Accès jusqu&apos;au{' '}
                              {new Date(item.campaignEndsAt).toLocaleDateString('fr-FR')}
                            </span>
                          )}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-3">
                        <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                          <Link href={`/ong/sondages/${item.id}`}>
                            <Eye className="h-3 w-3" /> Suivi
                          </Link>
                        </Button>
                        {['active', 'scheduled'].includes(item.rawStatus) && (
                          <Button size="sm" className="h-7 text-xs" asChild>
                            <Link href={`/ong/sondages/${item.id}/collecter`}>Collecter</Link>
                          </Button>
                        )}
                        {isDirector &&
                          item.paymentToken &&
                          item.chargeStatus === 'awaiting_payment' && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                              <Link href={`/paiement-sondage/${item.paymentToken}`}>
                                <CreditCard className="h-3 w-3" /> Payer
                              </Link>
                            </Button>
                          )}
                        {isDirector && item.rawStatus !== 'active' && item.rawStatus !== 'closed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => handleStatus(item.id, 'active')}
                          >
                            <Play className="h-3 w-3" /> Activer
                          </Button>
                        )}
                        {isDirector && item.rawStatus === 'active' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => handleStatus(item.id, 'closed')}
                          >
                            <Square className="h-3 w-3" /> Clôturer
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {isDirector
                ? 'Aucun sondage. Programmez une enquête ou vérifiez Paramètres → Sondages ONG.'
                : 'Aucun sondage assigné. Demandez à la direction de vous assigner une enquête.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
