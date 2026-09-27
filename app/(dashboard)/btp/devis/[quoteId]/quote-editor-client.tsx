'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  deleteBtpQuote,
  duplicateBtpQuote,
  getBtpQuoteExportAssets,
  saveBtpQuote,
  setBtpQuoteStatus,
  syncQuotePricesToCatalog,
} from '@/lib/actions/btp-quotes';
import {
  computeQuoteTotals,
  duplicateLot,
  formatQuoteAmount,
  newDetailedLot,
  newLumpSumLot,
  QUOTE_SECTION_LABELS,
  QUOTE_SECTIONS,
  quoteDisplayNumber,
  quoteValidUntil,
  type BtpQuote,
  type PriceCatalogItem,
  type QuoteHeader,
  type QuoteLot,
  type QuoteStatus,
} from '@/lib/btp/quotes/quote-types';
import { amountInWordsGnf } from '@/lib/btp/quotes/amount-in-words';
import type { QuotePdfAssets } from '@/lib/btp/quotes/quote-pdf';
import { QuoteLotCard, QUOTE_CATALOG_DATALIST_ID } from '@/components/btp/quotes/quote-lot-card';
import { QuoteNumberInput } from '@/components/btp/quotes/quote-number-input';
import { QuoteStatusBadge } from '@/components/btp/quotes/quote-status-badge';
import {
  ArrowLeft,
  BookPlus,
  CheckCircle2,
  Copy,
  FileDown,
  FileSpreadsheet,
  GitBranch,
  Loader2,
  Lock,
  Plus,
  RotateCcw,
  Save,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react';

const EDITABLE: QuoteStatus[] = ['draft', 'sent'];

function headerFromQuote(q: BtpQuote): QuoteHeader {
  return {
    title: q.title,
    subtitle: q.subtitle,
    clientName: q.clientName,
    clientContact: q.clientContact,
    clientAddress: q.clientAddress,
    location: q.location,
    quoteDate: q.quoteDate,
    validityDays: q.validityDays,
    notes: q.notes,
    vatEnabled: q.vatEnabled,
    vatRate: q.vatRate,
  };
}

/** « Élévation niveau 1 » → « Élévation niveau 2 » ; sinon « … (2) ». */
function nextLotTitle(title: string, existing: string[]): string {
  const m = title.match(/^(.*?)(\d+)(\D*)$/);
  let candidate = m ? `${m[1]}${Number(m[2]) + 1}${m[3]}` : `${title} (2)`;
  let guard = 0;
  while (existing.includes(candidate) && guard < 50) {
    const mm = candidate.match(/^(.*?)(\d+)(\D*)$/);
    candidate = mm ? `${mm[1]}${Number(mm[2]) + 1}${mm[3]}` : `${candidate} (2)`;
    guard += 1;
  }
  return candidate;
}

interface Props {
  initialQuote: BtpQuote;
  catalog: PriceCatalogItem[];
  isDirector: boolean;
}

export function QuoteEditorClient({ initialQuote, catalog, isDirector }: Props) {
  const router = useRouter();
  const [meta, setMeta] = useState(initialQuote);
  const [header, setHeader] = useState<QuoteHeader>(() => headerFromQuote(initialQuote));
  const [lots, setLots] = useState<QuoteLot[]>(initialQuote.lots);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const assetsRef = useRef<QuotePdfAssets | null>(null);

  const locked = !EDITABLE.includes(meta.status);
  const totals = useMemo(() => computeQuoteTotals(lots, header), [lots, header]);
  const catalogByKey = useMemo(
    () => new Map(catalog.map((c) => [c.designation.trim().toLowerCase(), c])),
    [catalog]
  );
  const validUntil = quoteValidUntil(header.quoteDate, header.validityDays);

  const setHeaderField = <K extends keyof QuoteHeader>(key: K, value: QuoteHeader[K]) => {
    setHeader((h) => ({ ...h, [key]: value }));
    setDirty(true);
  };
  const updateLots = (updater: (prev: QuoteLot[]) => QuoteLot[]) => {
    setLots(updater);
    setDirty(true);
  };

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const save = useCallback(async (): Promise<boolean> => {
    if (locked) return true;
    setBusy('save');
    setMessage(null);
    const result = await saveBtpQuote({ id: meta.id, header, lots });
    setBusy(null);
    if ('error' in result) {
      setMessage({ type: 'error', text: result.error });
      return false;
    }
    setMeta(result.quote);
    setDirty(false);
    setMessage({ type: 'ok', text: 'Devis enregistré.' });
    return true;
  }, [locked, meta.id, header, lots]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (dirty) void save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dirty, save]);

  function currentQuote(): BtpQuote {
    return { ...meta, ...header, lots, totalHt: totals.totalHt, totalTtc: totals.totalTtc };
  }

  async function loadAssets(): Promise<QuotePdfAssets | null> {
    if (assetsRef.current) return assetsRef.current;
    const res = await getBtpQuoteExportAssets();
    if ('error' in res) {
      setMessage({ type: 'error', text: res.error });
      return null;
    }
    assetsRef.current = res;
    return res;
  }

  async function exportPdf() {
    setBusy('pdf');
    try {
      const assets = await loadAssets();
      if (!assets) return;
      const { downloadQuotePdf } = await import('@/lib/btp/quotes/quote-pdf');
      downloadQuotePdf(currentQuote(), assets);
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Export PDF impossible.' });
    } finally {
      setBusy(null);
    }
  }

  async function exportExcel() {
    setBusy('excel');
    try {
      const assets = await loadAssets();
      if (!assets) return;
      const { downloadQuoteExcel } = await import('@/lib/btp/quotes/quote-excel');
      await downloadQuoteExcel(currentQuote(), assets.orgName);
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Export Excel impossible.' });
    } finally {
      setBusy(null);
    }
  }

  async function changeStatus(status: QuoteStatus) {
    if (dirty && !(await save())) return;
    setBusy(`status-${status}`);
    const result = await setBtpQuoteStatus(meta.id, status);
    setBusy(null);
    if ('error' in result) {
      setMessage({ type: 'error', text: result.error });
      return;
    }
    setMeta((m) => ({ ...m, status }));
    setMessage({ type: 'ok', text: 'Statut mis à jour.' });
  }

  async function duplicate(mode: 'copy' | 'version') {
    if (dirty && !(await save())) return;
    setBusy(mode);
    const result = await duplicateBtpQuote(meta.id, mode);
    setBusy(null);
    if ('error' in result) {
      setMessage({ type: 'error', text: result.error });
      return;
    }
    router.push(`/btp/devis/${result.id}`);
  }

  async function syncCatalog() {
    if (dirty && !(await save())) return;
    setBusy('sync');
    const result = await syncQuotePricesToCatalog(meta.id);
    setBusy(null);
    if ('error' in result) {
      setMessage({ type: 'error', text: result.error });
      return;
    }
    setMessage({
      type: 'ok',
      text: `Catalogue mis à jour : ${result.added} article(s) ajouté(s), ${result.updated} prix modifié(s).`,
    });
    router.refresh();
  }

  async function remove() {
    if (!confirm(`Supprimer définitivement le devis ${quoteDisplayNumber(meta)} ?`)) return;
    setBusy('delete');
    const result = await deleteBtpQuote(meta.id);
    setBusy(null);
    if ('error' in result) {
      setMessage({ type: 'error', text: result.error });
      return;
    }
    setDirty(false);
    router.push('/btp/devis');
  }

  const spin = (key: string) => busy === key && <Loader2 className="h-4 w-4 animate-spin" />;

  return (
    <div className="space-y-5 pb-24">
      <datalist id={QUOTE_CATALOG_DATALIST_ID}>
        {catalog.map((c) => (
          <option key={c.id} value={c.designation}>
            {`${c.unit} · ${formatQuoteAmount(c.unitPrice)} GNF`}
          </option>
        ))}
      </datalist>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/btp/devis"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Tous les devis
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{header.title || 'Devis sans titre'}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="font-mono">{quoteDisplayNumber(meta)}</span>
            <QuoteStatusBadge status={meta.status} />
            {dirty && <span className="text-amber-600">Modifications non enregistrées</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!locked && (
            <Button onClick={() => void save()} disabled={!dirty || busy !== null} className="bg-[#2563EB]">
              {spin('save') || <Save className="h-4 w-4" />} Enregistrer
            </Button>
          )}
          <Button variant="outline" onClick={exportPdf} disabled={busy !== null}>
            {spin('pdf') || <FileDown className="h-4 w-4" />} PDF
          </Button>
          <Button variant="outline" onClick={exportExcel} disabled={busy !== null}>
            {spin('excel') || <FileSpreadsheet className="h-4 w-4" />} Excel
          </Button>
        </div>
      </div>

      {message && (
        <p
          className={
            message.type === 'error'
              ? 'rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'
              : 'rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700'
          }
        >
          {message.text}
        </p>
      )}

      {locked && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Lock className="h-4 w-4" />
          <span className="flex-1">
            Ce devis est clôturé ({meta.status === 'accepted' ? 'accepté' : meta.status === 'refused' ? 'refusé' : 'annulé'}) :
            il n&apos;est plus modifiable. Créez une nouvelle version pour l&apos;ajuster.
          </span>
          <Button size="sm" onClick={() => duplicate('version')} disabled={busy !== null}>
            {spin('version') || <GitBranch className="h-4 w-4" />} Nouvelle version
          </Button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5 min-w-0">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Informations du devis</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Intitulé du projet</Label>
                <Input
                  value={header.title}
                  disabled={locked}
                  onChange={(e) => setHeaderField('title', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Sous-titre</Label>
                <Input
                  value={header.subtitle}
                  disabled={locked}
                  onChange={(e) => setHeaderField('subtitle', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Lieu des travaux</Label>
                <Input
                  value={header.location}
                  disabled={locked}
                  onChange={(e) => setHeaderField('location', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Client / maître d&apos;ouvrage</Label>
                <Input
                  value={header.clientName}
                  disabled={locked}
                  onChange={(e) => setHeaderField('clientName', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Contact client (téléphone, e-mail)</Label>
                <Input
                  value={header.clientContact}
                  disabled={locked}
                  onChange={(e) => setHeaderField('clientContact', e.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Adresse du client</Label>
                <Input
                  value={header.clientAddress}
                  disabled={locked}
                  onChange={(e) => setHeaderField('clientAddress', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Date du devis</Label>
                <Input
                  type="date"
                  value={header.quoteDate}
                  disabled={locked}
                  onChange={(e) => setHeaderField('quoteDate', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Validité (jours)</Label>
                <Input
                  type="number"
                  min={0}
                  value={header.validityDays}
                  disabled={locked}
                  onChange={(e) => setHeaderField('validityDays', Number(e.target.value) || 0)}
                />
                {validUntil && (
                  <p className="text-xs text-muted-foreground">
                    Valable jusqu&apos;au {validUntil.split('-').reverse().join('/')}
                  </p>
                )}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Conditions / remarques (imprimées sur le devis)</Label>
                <textarea
                  value={header.notes}
                  disabled={locked}
                  onChange={(e) => setHeaderField('notes', e.target.value)}
                  rows={3}
                  placeholder="Ex. Acompte de 30 % à la commande, solde selon avancement…"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                />
              </div>
            </CardContent>
          </Card>

          {lots.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center text-muted-foreground">
                Aucun lot. Ajoutez un lot détaillé (matériaux, matériels, main d&apos;œuvre, suivi) ou un
                lot forfaitaire (imprévus, transport…).
              </CardContent>
            </Card>
          )}

          {lots.map((lot, index) => (
            <QuoteLotCard
              key={lot.id}
              lot={lot}
              index={index}
              count={lots.length}
              locked={locked}
              catalogByKey={catalogByKey}
              onChange={(next) => updateLots((prev) => prev.map((l) => (l.id === next.id ? next : l)))}
              onMove={(delta) =>
                updateLots((prev) => {
                  const arr = [...prev];
                  const target = index + delta;
                  if (target < 0 || target >= arr.length) return prev;
                  [arr[index], arr[target]] = [arr[target], arr[index]];
                  return arr;
                })
              }
              onDuplicate={() =>
                updateLots((prev) => {
                  const arr = [...prev];
                  const copy = duplicateLot(lot, nextLotTitle(lot.title, prev.map((l) => l.title)));
                  arr.splice(index + 1, 0, copy);
                  return arr;
                })
              }
              onDelete={() => {
                if (!confirm(`Supprimer le lot « ${lot.title} » ?`)) return;
                updateLots((prev) => prev.filter((l) => l.id !== lot.id));
              }}
            />
          ))}

          {!locked && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => updateLots((prev) => [...prev, newDetailedLot(`Lot ${prev.length + 1}`)])}
              >
                <Plus className="h-4 w-4" /> Lot détaillé
              </Button>
              <Button
                variant="outline"
                onClick={() => updateLots((prev) => [...prev, newLumpSumLot('Travaux divers et imprévus')])}
              >
                <Plus className="h-4 w-4" /> Lot forfaitaire (imprévus, transport…)
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <Card className="border-[#0f2a4a]/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Récapitulatif</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
                {totals.lots.map((lt, i) => (
                  <div key={lt.lot.id} className="flex justify-between gap-2">
                    <span className="truncate text-muted-foreground">
                      {i + 1}. {lt.lot.title}
                      {lt.lot.quantity !== 1 && ` ×${lt.lot.quantity}`}
                    </span>
                    <span className="tabular-nums whitespace-nowrap">{formatQuoteAmount(lt.recapTotal)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>Total HT</span>
                <span className="tabular-nums">{formatQuoteAmount(totals.totalHt)} GNF</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2">
                  <Switch
                    checked={header.vatEnabled}
                    disabled={locked}
                    onCheckedChange={(v) => setHeaderField('vatEnabled', v)}
                  />
                  <span>Appliquer la TVA</span>
                </label>
                {header.vatEnabled && (
                  <div className="flex items-center gap-1">
                    <QuoteNumberInput
                      ariaLabel="Taux de TVA"
                      value={header.vatRate}
                      decimals={2}
                      disabled={locked}
                      onChange={(v) => setHeaderField('vatRate', Math.min(100, v))}
                      className="w-16"
                    />
                    <span>%</span>
                  </div>
                )}
              </div>
              {header.vatEnabled && (
                <div className="flex justify-between">
                  <span>TVA {header.vatRate} %</span>
                  <span className="tabular-nums">{formatQuoteAmount(totals.vatAmount)} GNF</span>
                </div>
              )}
              <div className="flex justify-between rounded-md bg-[#0f2a4a] px-3 py-2 font-bold text-white">
                <span>{header.vatEnabled ? 'Total TTC' : 'Total'}</span>
                <span className="tabular-nums">{formatQuoteAmount(totals.totalTtc)} GNF</span>
              </div>
              <p className="text-xs italic text-muted-foreground">
                Arrêté à la somme de : {amountInWordsGnf(totals.totalTtc)}.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Répartition</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {QUOTE_SECTIONS.map((s) => (
                <div key={s} className="flex justify-between">
                  <span className="text-muted-foreground">{QUOTE_SECTION_LABELS[s]}</span>
                  <span className="tabular-nums">{formatQuoteAmount(totals.bySection[s])}</span>
                </div>
              ))}
              {totals.lumpSumTotal > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Forfaits (imprévus…)</span>
                  <span className="tabular-nums">{formatQuoteAmount(totals.lumpSumTotal)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Suivi du devis</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {meta.status === 'draft' && (
                <Button variant="outline" onClick={() => changeStatus('sent')} disabled={busy !== null}>
                  {spin('status-sent') || <Send className="h-4 w-4" />} Marquer comme envoyé au client
                </Button>
              )}
              {meta.status === 'sent' && (
                <>
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-600/90"
                    onClick={() => changeStatus('accepted')}
                    disabled={busy !== null}
                  >
                    {spin('status-accepted') || <CheckCircle2 className="h-4 w-4" />} Accepté par le client
                  </Button>
                  <Button variant="outline" onClick={() => changeStatus('refused')} disabled={busy !== null}>
                    {spin('status-refused') || <XCircle className="h-4 w-4" />} Refusé
                  </Button>
                  <Button variant="ghost" onClick={() => changeStatus('draft')} disabled={busy !== null}>
                    <RotateCcw className="h-4 w-4" /> Repasser en brouillon
                  </Button>
                </>
              )}
              {locked && isDirector && (
                <Button variant="ghost" onClick={() => changeStatus('draft')} disabled={busy !== null}>
                  <RotateCcw className="h-4 w-4" /> Rouvrir (brouillon)
                </Button>
              )}
              {!locked && (
                <Button variant="ghost" onClick={() => duplicate('version')} disabled={busy !== null}>
                  {spin('version') || <GitBranch className="h-4 w-4" />} Nouvelle version
                </Button>
              )}
              <Button variant="ghost" onClick={() => duplicate('copy')} disabled={busy !== null}>
                {spin('copy') || <Copy className="h-4 w-4" />} Copier comme nouveau devis
              </Button>
              <Button variant="ghost" onClick={syncCatalog} disabled={busy !== null}>
                {spin('sync') || <BookPlus className="h-4 w-4" />} Mettre à jour le catalogue de prix
              </Button>
              {meta.status !== 'cancelled' && meta.status !== 'accepted' && (
                <Button variant="ghost" onClick={() => changeStatus('cancelled')} disabled={busy !== null}>
                  <XCircle className="h-4 w-4" /> Annuler le devis
                </Button>
              )}
              {isDirector && (
                <Button
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={remove}
                  disabled={busy !== null}
                >
                  {spin('delete') || <Trash2 className="h-4 w-4" />} Supprimer
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {!locked && dirty && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 py-3 shadow-lg backdrop-blur md:left-64">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <span className="text-sm text-amber-700">Modifications non enregistrées (Ctrl+S)</span>
            <Button onClick={() => void save()} disabled={busy !== null} className="bg-[#2563EB]">
              {spin('save') || <Save className="h-4 w-4" />} Enregistrer · {formatQuoteAmount(totals.totalTtc)} GNF
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
