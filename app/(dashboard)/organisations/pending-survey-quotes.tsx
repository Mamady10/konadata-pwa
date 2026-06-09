'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ClipboardList } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { COLLECTION_MODE_LABELS } from '@/lib/ngo/survey-settings';
import type { NgoSurveyCollectionMode } from '@/lib/ngo/survey-settings';
import { platformSetNgoSurveyCharge } from '@/lib/actions/ngo-survey-billing';
import type { SurveyChargeCeoRow } from '@/lib/ngo/survey-billing';

interface Props {
  rows: SurveyChargeCeoRow[];
}

export function PendingSurveyQuotes({ rows: initialRows }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [editing, setEditing] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [resendEmail, setResendEmail] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!initialRows.length && rows.length === 0) return null;

  const pendingQuote = rows.filter((r) => r.status === 'awaiting_ceo_quote');
  const awaitingPayment = rows.filter((r) => r.status === 'awaiting_payment');

  function openEdit(row: SurveyChargeCeoRow) {
    setEditing(row.charge_id);
    setAmount(
      row.status === 'awaiting_payment' && row.amount_gnf > 0
        ? String(row.amount_gnf)
        : ''
    );
    setNotes(row.ceo_notes ?? '');
    setResendEmail(true);
    setMsg(null);
  }

  async function submitCharge(row: SurveyChargeCeoRow) {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < 0) {
      setMsg('Montant invalide');
      return;
    }
    const isRevision = row.status === 'awaiting_payment';
    setLoading(true);
    setMsg(null);
    const res = await platformSetNgoSurveyCharge(row.charge_id, amt, notes, {
      resendEmail: isRevision ? resendEmail : true,
    });
    setLoading(false);
    if (res.error) {
      setMsg(res.error);
      return;
    }

    setRows((prev) =>
      prev.map((r) =>
        r.charge_id === row.charge_id
          ? {
              ...r,
              status: 'awaiting_payment',
              amount_gnf: amt,
              ceo_notes: notes.trim() || r.ceo_notes,
            }
          : r
      )
    );
    setEditing(null);

    if (isRevision) {
      setMsg(
        res.emailSent
          ? `Tarif mis à jour (${formatCurrency(amt)}) — email envoyé au directeur.`
          : res.emailWarning
            ? `Tarif mis à jour.${res.emailWarning ? ` (${res.emailWarning})` : ''}`
            : `Tarif mis à jour à ${formatCurrency(amt)} (email non renvoyé).`
      );
    } else {
      setMsg(
        res.emailSent
          ? `Tarif ${formatCurrency(amt)} validé — lien de paiement envoyé au directeur.`
          : `Tarif validé.${res.emailWarning ? ` (${res.emailWarning})` : ''}`
      );
    }
    router.refresh();
  }

  function renderRow(row: SurveyChargeCeoRow) {
    const isRevision = row.status === 'awaiting_payment';

    return (
      <div key={row.charge_id} className="rounded-lg border p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-semibold">{row.survey_title}</p>
            <p className="text-sm text-muted-foreground">{row.organization_name}</p>
          </div>
          <Badge variant={isRevision ? 'outline' : 'secondary'}>
            {isRevision ? 'Paiement en attente' : 'En attente tarif'}
          </Badge>
        </div>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <span>
            <span className="text-muted-foreground">Cibles : </span>
            <strong>{row.target_responses}</strong>
          </span>
          <span>
            <span className="text-muted-foreground">Région : </span>
            {row.survey_region ?? '—'}
          </span>
          <span>
            <span className="text-muted-foreground">Mode : </span>
            {COLLECTION_MODE_LABELS[row.collection_mode as NgoSurveyCollectionMode] ??
              row.collection_mode}
          </span>
          <span>
            <span className="text-muted-foreground">Soumis : </span>
            {new Date(row.submitted_at).toLocaleString('fr-FR')}
          </span>
          {isRevision && (
            <span className="sm:col-span-2">
              <span className="text-muted-foreground">Tarif actuel : </span>
              <strong>{formatCurrency(row.amount_gnf)}</strong>
            </span>
          )}
        </div>
        {row.survey_description && (
          <p className="text-sm text-muted-foreground">{row.survey_description}</p>
        )}
        {row.ceo_notes && editing !== row.charge_id && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">Note CEO :</span> {row.ceo_notes}
          </p>
        )}
        {editing === row.charge_id ? (
          <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t">
            <div className="space-y-2">
              <Label>{isRevision ? 'Nouveau montant (GNF)' : 'Montant campagne (GNF)'}</Label>
              <Input
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="75000"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Note CEO (optionnel)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Tarif négocié, campagne terrain Kindia…"
              />
            </div>
            {isRevision && (
              <label className="flex items-center gap-2 sm:col-span-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  className="rounded border"
                  checked={resendEmail}
                  onChange={(e) => setResendEmail(e.target.checked)}
                />
                Renvoyer l&apos;email au directeur avec le nouveau tarif
              </label>
            )}
            <div className="flex gap-2 sm:col-span-2">
              <Button
                className="bg-[#2563EB]"
                disabled={loading}
                onClick={() => submitCharge(row)}
              >
                {isRevision ? 'Enregistrer le nouveau tarif' : 'Valider et envoyer le lien de paiement'}
              </Button>
              <Button variant="outline" onClick={() => setEditing(null)}>
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
            {isRevision ? 'Modifier le tarif' : 'Fixer le tarif'}
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className="border-[#2563EB]/30 mb-8">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-[#2563EB]" />
          Sondages ONG — tarification ({rows.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Fixez ou modifiez le montant campagne selon l&apos;organisation et les personnes cibles —
          distinct de l&apos;abonnement plateforme. Le tarif reste modifiable tant que le directeur
          n&apos;a pas payé.
        </p>
        {msg && <p className="text-sm bg-muted rounded-lg px-3 py-2">{msg}</p>}

        {pendingQuote.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-muted-foreground">
              Nouvelles demandes ({pendingQuote.length})
            </p>
            {pendingQuote.map(renderRow)}
          </div>
        )}

        {awaitingPayment.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-muted-foreground">
              Tarifs envoyés — paiement en attente ({awaitingPayment.length})
            </p>
            {awaitingPayment.map(renderRow)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
