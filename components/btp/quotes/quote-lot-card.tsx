'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  applyTakeoffToLines,
  computeLotTotals,
  emptyLine,
  formatQuoteAmount,
  lineAmount,
  QUOTE_SECTION_LABELS,
  type PriceCatalogItem,
  type QuoteLine,
  type QuoteLot,
  type QuoteSection,
} from '@/lib/btp/quotes/quote-types';
import type { TakeoffMaterial } from '@/lib/btp/quotes/takeoff';
import { QuoteNumberInput } from './quote-number-input';
import { QuoteTakeoffPanel } from './quote-takeoff-panel';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Copy, Plus, Ruler, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export const QUOTE_CATALOG_DATALIST_ID = 'btp-quote-catalog';

const textInputClass =
  'h-8 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60';

interface Props {
  lot: QuoteLot;
  index: number;
  count: number;
  locked: boolean;
  catalogByKey: Map<string, PriceCatalogItem>;
  onChange: (lot: QuoteLot) => void;
  onMove: (delta: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function focusLine(lineId: string) {
  window.setTimeout(() => {
    document.querySelector<HTMLInputElement>(`[data-line-designation="${lineId}"]`)?.focus();
  }, 30);
}

export function QuoteLotCard({
  lot,
  index,
  count,
  locked,
  catalogByKey,
  onChange,
  onMove,
  onDuplicate,
  onDelete,
}: Props) {
  const [open, setOpen] = useState(true);
  const [showTakeoff, setShowTakeoff] = useState(false);
  const totals = computeLotTotals(lot);
  const isLumpSum = lot.kind === 'lump_sum';
  const takeoffCount = lot.takeoff?.items.length ?? 0;

  const patch = (changes: Partial<QuoteLot>) => onChange({ ...lot, ...changes });

  /** Prix du catalogue : désignation exacte, sinon article commençant par le nom de base (« Ciment », « Fer HA12 »…). */
  function catalogPrice(designation: string) {
    const full = designation.trim().toLowerCase();
    const base = full.split(' (')[0];
    const match =
      catalogByKey.get(full) ??
      catalogByKey.get(base) ??
      [...catalogByKey.entries()].find(([key]) => key.startsWith(base))?.[1];
    return match ? { unit: match.unit, unitPrice: match.unitPrice } : undefined;
  }

  function applyTakeoff(materials: TakeoffMaterial[]) {
    patch({ lines: applyTakeoffToLines(lot.lines, materials, catalogPrice) });
  }

  function updateLine(lineId: string, changes: Partial<QuoteLine>) {
    patch({ lines: lot.lines.map((l) => (l.id === lineId ? { ...l, ...changes } : l)) });
  }

  function changeDesignation(line: QuoteLine, designation: string) {
    const match = catalogByKey.get(designation.trim().toLowerCase());
    if (match && !line.unitPrice) {
      updateLine(line.id, { designation, unit: line.unit || match.unit, unitPrice: match.unitPrice });
    } else {
      updateLine(line.id, { designation });
    }
  }

  function addLine(section: QuoteSection, afterId?: string) {
    const line = emptyLine(section);
    const lines = [...lot.lines];
    const pos = afterId ? lines.findIndex((l) => l.id === afterId) : -1;
    if (pos >= 0) {
      lines.splice(pos + 1, 0, line);
    } else {
      const lastOfSection = lines.map((l) => l.section).lastIndexOf(section);
      lines.splice(lastOfSection >= 0 ? lastOfSection + 1 : lines.length, 0, line);
    }
    patch({ lines });
    focusLine(line.id);
  }

  function removeLine(lineId: string) {
    patch({ lines: lot.lines.filter((l) => l.id !== lineId) });
  }

  let lineNumber = 0;

  return (
    <div className="rounded-xl border bg-background shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b bg-[#0f2a4a] px-3 py-2 text-white rounded-t-xl">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded p-1 hover:bg-white/10"
          aria-label={open ? 'Replier le lot' : 'Déplier le lot'}
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <span className="text-xs font-semibold uppercase tracking-wide text-white/70">Lot {index + 1}</span>
        <input
          value={lot.title}
          disabled={locked}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder="Intitulé du lot"
          className="h-8 min-w-[180px] flex-1 rounded-md border border-white/20 bg-white/10 px-2 text-sm font-semibold text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/40"
        />
        <select
          value={lot.kind}
          disabled={locked}
          onChange={(e) => {
            const kind = e.target.value as QuoteLot['kind'];
            if (kind === lot.kind) return;
            if (kind === 'lump_sum' && lot.lines.some((l) => l.designation || l.unitPrice)) {
              if (!confirm('Passer en forfait supprime le détail des lignes de ce lot. Continuer ?')) return;
            }
            patch(
              kind === 'lump_sum'
                ? { kind, lines: [], unit: 'fft', lumpSumAmount: totals.unitTotal }
                : { kind, lines: [emptyLine('materials')], unit: 'ens' }
            );
          }}
          className="h-8 rounded-md border border-white/20 bg-white/10 px-2 text-sm text-white [&>option]:text-foreground"
        >
          <option value="detailed">Détaillé</option>
          <option value="lump_sum">Forfait</option>
        </select>
        <div className="flex items-center gap-1 text-sm">
          <span className="text-white/70">×</span>
          <QuoteNumberInput
            ariaLabel="Nombre de fois (multiplicateur)"
            value={lot.quantity}
            disabled={locked}
            onChange={(quantity) => patch({ quantity })}
            className="w-16 border-white/20 bg-white/10 text-white"
          />
          <input
            value={lot.unit}
            disabled={locked}
            onChange={(e) => patch({ unit: e.target.value })}
            aria-label="Unité du lot"
            className="h-8 w-14 rounded-md border border-white/20 bg-white/10 px-2 text-sm text-white"
          />
        </div>
        <div className="ml-auto flex items-center">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-white hover:bg-white/10 hover:text-white"
            disabled={locked || index === 0}
            onClick={() => onMove(-1)}
            aria-label="Monter"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-white hover:bg-white/10 hover:text-white"
            disabled={locked || index === count - 1}
            onClick={() => onMove(1)}
            aria-label="Descendre"
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-white hover:bg-white/10 hover:text-white"
            disabled={locked}
            onClick={onDuplicate}
            title="Dupliquer (ex. niveau suivant, prix ajustables)"
            aria-label="Dupliquer le lot"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-red-200 hover:bg-white/10 hover:text-red-100"
            disabled={locked}
            onClick={onDelete}
            aria-label="Supprimer le lot"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {open && (
        <div className="p-3 space-y-3">
          {isLumpSum ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted-foreground">Montant forfaitaire (par unité)</span>
              <QuoteNumberInput
                ariaLabel="Montant forfaitaire"
                decimals={0}
                value={lot.lumpSumAmount}
                disabled={locked}
                onChange={(lumpSumAmount) => patch({ lumpSumAmount })}
                className="w-48"
              />
              <span className="text-sm text-muted-foreground">GNF</span>
            </div>
          ) : (
            <>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowTakeoff((v) => !v)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium',
                  showTakeoff ? 'border-blue-300 bg-blue-50 text-[#0f2a4a]' : 'hover:bg-muted'
                )}
              >
                <Ruler className="h-3.5 w-3.5" />
                Métré / extrait des matériaux
                {takeoffCount > 0 && (
                  <span className="rounded-full bg-[#2563EB] px-1.5 text-[10px] text-white">{takeoffCount}</span>
                )}
                {showTakeoff ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            </div>
            {showTakeoff && (
              <QuoteTakeoffPanel
                takeoff={lot.takeoff}
                locked={locked}
                onChange={(takeoff) => patch({ takeoff })}
                onApply={applyTakeoff}
              />
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="w-10 px-1 py-1.5 text-center">N°</th>
                    <th className="px-1 py-1.5 text-left">Désignation</th>
                    <th className="w-20 px-1 py-1.5 text-left">Unité</th>
                    <th className="w-24 px-1 py-1.5 text-right">Quantité</th>
                    <th className="w-32 px-1 py-1.5 text-right">PU (GNF)</th>
                    <th className="w-36 px-1 py-1.5 text-right">Montant</th>
                    <th className="w-9" />
                  </tr>
                </thead>
                {totals.sections.map((sec) => (
                  <tbody key={sec.section}>
                    <tr>
                      <td colSpan={7} className="pt-3 pb-1">
                        <div className="flex items-center justify-between rounded-md bg-muted/60 px-2 py-1">
                          <span className="text-xs font-semibold uppercase tracking-wide">
                            {QUOTE_SECTION_LABELS[sec.section]}
                          </span>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            Sous-total : {formatQuoteAmount(sec.total)}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {sec.lines.map((line) => {
                      lineNumber += 1;
                      return (
                        <tr key={line.id} className="group">
                          <td className="px-1 py-0.5 text-center text-xs text-muted-foreground">
                            {lineNumber}
                            {line.takeoffKey && (
                              <span
                                className="block text-[9px] font-medium uppercase text-[#2563EB]"
                                title="Quantité calculée par le métré"
                              >
                                métré
                              </span>
                            )}
                          </td>
                          <td className="px-1 py-0.5">
                            <input
                              data-line-designation={line.id}
                              list={QUOTE_CATALOG_DATALIST_ID}
                              value={line.designation}
                              disabled={locked}
                              onChange={(e) => changeDesignation(line, e.target.value)}
                              placeholder="Désignation"
                              className={textInputClass}
                            />
                          </td>
                          <td className="px-1 py-0.5">
                            <input
                              value={line.unit}
                              disabled={locked}
                              onChange={(e) => updateLine(line.id, { unit: e.target.value })}
                              placeholder="u"
                              className={textInputClass}
                            />
                          </td>
                          <td className="px-1 py-0.5">
                            <QuoteNumberInput
                              ariaLabel="Quantité"
                              value={line.quantity}
                              disabled={locked}
                              onChange={(quantity) => updateLine(line.id, { quantity })}
                            />
                          </td>
                          <td className="px-1 py-0.5">
                            <QuoteNumberInput
                              ariaLabel="Prix unitaire"
                              decimals={0}
                              value={line.unitPrice}
                              disabled={locked}
                              onChange={(unitPrice) => updateLine(line.id, { unitPrice })}
                              onEnter={() => addLine(sec.section, line.id)}
                            />
                          </td>
                          <td className="px-1 py-0.5 text-right tabular-nums font-medium">
                            {lineAmount(line) ? formatQuoteAmount(lineAmount(line)) : '-'}
                          </td>
                          <td className="px-0.5 py-0.5 text-right">
                            {!locked && (
                              <button
                                type="button"
                                onClick={() => removeLine(line.id)}
                                className="rounded p-1 text-muted-foreground opacity-60 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                                aria-label="Supprimer la ligne"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {!locked && (
                      <tr>
                        <td />
                        <td colSpan={6} className="px-1 py-0.5">
                          <button
                            type="button"
                            onClick={() => addLine(sec.section)}
                            className="inline-flex items-center gap-1 text-xs text-[#2563EB] hover:underline"
                          >
                            <Plus className="h-3 w-3" /> Ligne {QUOTE_SECTION_LABELS[sec.section].toLowerCase()}
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                ))}
              </table>
            </div>
            </>
          )}
        </div>
      )}

      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-3 py-2 text-sm rounded-b-xl'
        )}
      >
        <span className="font-semibold uppercase">Total {lot.title || `lot ${index + 1}`}</span>
        <span className="tabular-nums">
          <span className="font-bold">{formatQuoteAmount(totals.unitTotal)} GNF</span>
          {lot.quantity !== 1 && (
            <span className="text-muted-foreground">
              {' '}
              × {lot.quantity} = <span className="font-bold text-foreground">{formatQuoteAmount(totals.recapTotal)} GNF</span>
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
