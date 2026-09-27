'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  BLOCK_TYPE_LABELS,
  computeTakeoff,
  emptyLotTakeoff,
  isReinforced,
  newTakeoffItem,
  newTakeoffRebar,
  REBAR_DIAMETERS,
  rebarKgPerMeter,
  TAKEOFF_GROUP_LABELS,
  TAKEOFF_KIND_ORDER,
  TAKEOFF_KINDS,
  type BlockType,
  type LotTakeoff,
  type TakeoffField,
  type TakeoffGroup,
  type TakeoffItem,
  type TakeoffKind,
  type TakeoffLosses,
  type TakeoffMaterial,
  type TakeoffParams,
} from '@/lib/btp/quotes/takeoff';
import { formatQuoteQuantity } from '@/lib/btp/quotes/quote-types';
import { QuoteNumberInput } from './quote-number-input';
import { ArrowDownToLine, ChevronDown, ChevronRight, Copy, Plus, Ruler, Settings2, Trash2 } from 'lucide-react';

const FIELD_UNITS: Partial<Record<TakeoffField, string>> = {
  length: 'm',
  width: 'm',
  height: 'm',
  thickness: 'm',
  area: 'm²',
  openings: 'm²',
  dosage: 'kg/m³',
  coats: 'couches',
};

const DEFAULT_FIELD_LABELS: Partial<Record<TakeoffField, string>> = {
  thickness: 'Épaisseur',
  area: 'ou surface directe',
  openings: 'Ouvertures à déduire',
  dosage: 'Dosage ciment',
  coats: 'Couches',
};

const selectClass =
  'h-8 w-full rounded-md border border-input bg-background px-2 text-sm disabled:opacity-60';

const LOSS_LABELS: Record<keyof TakeoffLosses, string> = {
  concrete: 'Béton',
  steel: 'Aciers',
  blocks: 'Agglos',
  mortar: 'Mortier',
  tiles: 'Carrelage',
  paint: 'Peinture',
};

interface Props {
  takeoff: LotTakeoff | undefined;
  locked: boolean;
  onChange: (takeoff: LotTakeoff) => void;
  onApply: (materials: TakeoffMaterial[]) => void;
}

function NumberField({
  label,
  unit,
  value,
  onChange,
  disabled,
}: {
  label: string;
  unit?: string;
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <label className="block space-y-0.5">
      <span className="text-[11px] text-muted-foreground">
        {label}
        {unit ? ` (${unit})` : ''}
      </span>
      <QuoteNumberInput value={value} onChange={onChange} disabled={disabled} ariaLabel={label} />
    </label>
  );
}

export function QuoteTakeoffPanel({ takeoff, locked, onChange, onApply }: Props) {
  const current = takeoff ?? emptyLotTakeoff();
  const [showParams, setShowParams] = useState(false);
  const result = useMemo(() => computeTakeoff(current), [current]);

  const setItems = (items: TakeoffItem[]) => onChange({ ...current, items });
  const updateItem = (id: string, changes: Partial<TakeoffItem>) =>
    setItems(current.items.map((i) => (i.id === id ? { ...i, ...changes } : i)));
  const setParams = (changes: Partial<TakeoffParams>) =>
    onChange({ ...current, params: { ...current.params, ...changes } });

  const groups = (Object.keys(TAKEOFF_GROUP_LABELS) as TakeoffGroup[]).map((g) => ({
    group: g,
    kinds: TAKEOFF_KIND_ORDER.filter((k) => TAKEOFF_KINDS[k].group === g),
  }));

  return (
    <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-[#0f2a4a]">
          <Ruler className="h-4 w-4" /> Métré : dimensions des ouvrages → quantités de matériaux
        </p>
        {!locked && (
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            value=""
            onChange={(e) => {
              const kind = e.target.value as TakeoffKind;
              if (kind) setItems([...current.items, newTakeoffItem(kind)]);
            }}
          >
            <option value="">+ Ajouter un ouvrage…</option>
            {groups.map(({ group, kinds }) => (
              <optgroup key={group} label={TAKEOFF_GROUP_LABELS[group]}>
                {kinds.map((k) => (
                  <option key={k} value={k}>
                    {TAKEOFF_KINDS[k].label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        )}
      </div>

      {current.items.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Ajoutez les ouvrages du lot (semelles, poteaux, poutres, dalle, murs, enduits…) avec leurs
          dimensions : KonaData calcule le ciment, le sable, le gravier, les aciers, les agglos, les
          carreaux et la peinture, puis les reporte dans la rubrique Matériaux.
        </p>
      )}

      {current.items.map((item) => {
        const meta = TAKEOFF_KINDS[item.kind];
        const res = result.items.find((r) => r.item.id === item.id);
        const reinforced = isReinforced(item.kind);
        return (
          <div key={item.id} className="space-y-2 rounded-md border bg-background p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-[#0f2a4a]/10 px-1.5 py-0.5 text-[11px] font-medium text-[#0f2a4a]">
                {meta.label}
              </span>
              <input
                value={item.label}
                disabled={locked}
                onChange={(e) => updateItem(item.id, { label: e.target.value })}
                className="h-8 min-w-[140px] flex-1 rounded-md border border-input bg-background px-2 text-sm"
                aria-label="Repère de l'ouvrage"
              />
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {meta.countLabel}
                <QuoteNumberInput
                  value={item.count}
                  onChange={(count) => updateItem(item.id, { count })}
                  disabled={locked}
                  className="w-16"
                  ariaLabel={meta.countLabel}
                />
              </div>
              {!locked && (
                <>
                  <button
                    type="button"
                    className="rounded p-1 text-muted-foreground hover:bg-muted"
                    title="Dupliquer"
                    onClick={() => {
                      const copy = { ...item, id: newTakeoffItem(item.kind).id, rebars: item.rebars.map((r) => ({ ...r, id: newTakeoffRebar().id })) };
                      const idx = current.items.findIndex((i) => i.id === item.id);
                      const items = [...current.items];
                      items.splice(idx + 1, 0, copy);
                      setItems(items);
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                    title="Supprimer"
                    onClick={() => setItems(current.items.filter((i) => i.id !== item.id))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {meta.fields.map((field) =>
                field === 'blockType' ? (
                  <label key={field} className="block space-y-0.5">
                    <span className="text-[11px] text-muted-foreground">Type d&apos;agglos</span>
                    <select
                      className={selectClass}
                      value={item.blockType}
                      disabled={locked}
                      onChange={(e) => updateItem(item.id, { blockType: e.target.value as BlockType })}
                    >
                      {(Object.keys(BLOCK_TYPE_LABELS) as BlockType[]).map((b) => (
                        <option key={b} value={b}>
                          {BLOCK_TYPE_LABELS[b]}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <NumberField
                    key={field}
                    label={meta.fieldLabels[field] ?? DEFAULT_FIELD_LABELS[field] ?? field}
                    unit={FIELD_UNITS[field]}
                    value={item[field] as number}
                    disabled={locked}
                    onChange={(v) => updateItem(item.id, { [field]: v } as Partial<TakeoffItem>)}
                  />
                )
              )}
            </div>

            {reinforced && (
              <div className="space-y-2 rounded-md bg-muted/40 p-2">
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="font-medium">Aciers :</span>
                  {(['ratio', 'detail'] as const).map((mode) => (
                    <label key={mode} className="flex items-center gap-1">
                      <input
                        type="radio"
                        checked={item.steelMode === mode}
                        disabled={locked}
                        onChange={() =>
                          updateItem(item.id, {
                            steelMode: mode,
                            rebars:
                              mode === 'detail' && item.rebars.length === 0
                                ? [newTakeoffRebar(item.mainDiameter), { ...newTakeoffRebar(item.secondaryDiameter || 6), count: 10, length: 0.8 }]
                                : item.rebars,
                          })
                        }
                      />
                      {mode === 'ratio' ? 'Ratio (kg/m³)' : 'Nomenclature détaillée'}
                    </label>
                  ))}
                </div>
                {item.steelMode === 'ratio' ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <NumberField
                      label="Ratio d'acier"
                      unit="kg/m³"
                      value={item.steelRatio}
                      disabled={locked}
                      onChange={(steelRatio) => updateItem(item.id, { steelRatio })}
                    />
                    {(['mainDiameter', 'secondaryDiameter'] as const).map((key) => (
                      <label key={key} className="block space-y-0.5">
                        <span className="text-[11px] text-muted-foreground">
                          {key === 'mainDiameter' ? 'Aciers principaux' : 'Cadres / aciers secondaires'}
                        </span>
                        <select
                          className={selectClass}
                          value={item[key]}
                          disabled={locked}
                          onChange={(e) => updateItem(item.id, { [key]: Number(e.target.value) })}
                        >
                          {REBAR_DIAMETERS.map((d) => (
                            <option key={d} value={d}>
                              HA{d}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                    <NumberField
                      label="Part cadres / secondaires"
                      unit="%"
                      value={item.secondaryShare}
                      disabled={locked}
                      onChange={(secondaryShare) => updateItem(item.id, { secondaryShare: Math.min(100, secondaryShare) })}
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="grid grid-cols-[90px_1fr_1fr_90px_28px] gap-2 text-[11px] text-muted-foreground">
                      <span>Diamètre</span>
                      <span>Barres ou cadres / élément</span>
                      <span>Longueur développée (m)</span>
                      <span className="text-right">Poids total</span>
                      <span />
                    </div>
                    {item.rebars.map((r) => (
                      <div key={r.id} className="grid grid-cols-[90px_1fr_1fr_90px_28px] items-center gap-2">
                        <select
                          className={selectClass}
                          value={r.diameter}
                          disabled={locked}
                          onChange={(e) =>
                            updateItem(item.id, {
                              rebars: item.rebars.map((x) => (x.id === r.id ? { ...x, diameter: Number(e.target.value) } : x)),
                            })
                          }
                        >
                          {REBAR_DIAMETERS.map((d) => (
                            <option key={d} value={d}>
                              HA{d}
                            </option>
                          ))}
                        </select>
                        <QuoteNumberInput
                          value={r.count}
                          disabled={locked}
                          onChange={(count) =>
                            updateItem(item.id, { rebars: item.rebars.map((x) => (x.id === r.id ? { ...x, count } : x)) })
                          }
                        />
                        <QuoteNumberInput
                          value={r.length}
                          disabled={locked}
                          onChange={(length) =>
                            updateItem(item.id, { rebars: item.rebars.map((x) => (x.id === r.id ? { ...x, length } : x)) })
                          }
                        />
                        <span className="text-right text-xs tabular-nums">
                          {formatQuoteQuantity(Math.round(r.count * r.length * rebarKgPerMeter(r.diameter) * item.count * 10) / 10)} kg
                        </span>
                        {!locked && (
                          <button
                            type="button"
                            className="rounded p-1 text-muted-foreground hover:text-red-600"
                            onClick={() => updateItem(item.id, { rebars: item.rebars.filter((x) => x.id !== r.id) })}
                            aria-label="Supprimer la barre"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                    {!locked && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs text-[#2563EB] hover:underline"
                        onClick={() => updateItem(item.id, { rebars: [...item.rebars, newTakeoffRebar(10)] })}
                      >
                        <Plus className="h-3 w-3" /> Barre / cadre
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {res && (
              <p className="text-xs text-muted-foreground">
                = <strong className="text-foreground">{formatQuoteQuantity(res.quantity)} {res.unit}</strong>
                {res.formwork > 0 && ` · coffrage ${formatQuoteQuantity(res.formwork)} m²`}
                {res.steelKg > 0 && ` · acier ${formatQuoteQuantity(Math.round(res.steelKg))} kg`}
              </p>
            )}
          </div>
        );
      })}

      <div>
        <button
          type="button"
          onClick={() => setShowParams((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-medium text-[#0f2a4a] hover:underline"
        >
          {showParams ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          <Settings2 className="h-3.5 w-3.5" /> Hypothèses de calcul (dosages, rendements, pertes)
        </button>
        {showParams && (
          <div className="mt-2 space-y-3 rounded-md border bg-background p-2.5">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              <NumberField label="Sac de ciment" unit="kg" value={current.params.cementBagKg} disabled={locked} onChange={(cementBagKg) => setParams({ cementBagKg })} />
              <NumberField label="Sable / m³ de béton" unit="m³" value={current.params.sandPerM3Concrete} disabled={locked} onChange={(sandPerM3Concrete) => setParams({ sandPerM3Concrete })} />
              <NumberField label="Gravier / m³ de béton" unit="m³" value={current.params.gravelPerM3Concrete} disabled={locked} onChange={(gravelPerM3Concrete) => setParams({ gravelPerM3Concrete })} />
              <NumberField label="Sable / m³ de mortier" unit="m³" value={current.params.sandPerM3Mortar} disabled={locked} onChange={(sandPerM3Mortar) => setParams({ sandPerM3Mortar })} />
              <NumberField label="Agglos par m²" value={current.params.blocksPerM2} disabled={locked} onChange={(blocksPerM2) => setParams({ blocksPerM2 })} />
              <NumberField label="Longueur des barres" unit="m" value={current.params.barLength} disabled={locked} onChange={(barLength) => setParams({ barLength })} />
              <NumberField label="Fil à ligaturer" unit="% acier" value={current.params.tieWirePct} disabled={locked} onChange={(tieWirePct) => setParams({ tieWirePct })} />
              <NumberField label="Lit de pose carrelage" unit="m" value={current.params.tileBedThickness} disabled={locked} onChange={(tileBedThickness) => setParams({ tileBedThickness })} />
              <NumberField label="Dosage lit de pose" unit="kg/m³" value={current.params.tileBedDosage} disabled={locked} onChange={(tileBedDosage) => setParams({ tileBedDosage })} />
              <NumberField label="Joints carrelage" unit="kg/m²" value={current.params.tileJointKgPerM2} disabled={locked} onChange={(tileJointKgPerM2) => setParams({ tileJointKgPerM2 })} />
              <NumberField label="Rendement peinture" unit="m²/L/couche" value={current.params.paintYieldM2PerL} disabled={locked} onChange={(paintYieldM2PerL) => setParams({ paintYieldM2PerL })} />
              <NumberField label="Rendement impression" unit="m²/L" value={current.params.primerYieldM2PerL} disabled={locked} onChange={(primerYieldM2PerL) => setParams({ primerYieldM2PerL })} />
            </div>
            <div>
              <p className="mb-1 text-[11px] font-medium text-muted-foreground">Mortier de pose des agglos (m³ par m² de mur)</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {(Object.keys(BLOCK_TYPE_LABELS) as BlockType[]).map((b) => (
                  <NumberField
                    key={b}
                    label={BLOCK_TYPE_LABELS[b]}
                    value={current.params.blockMortarPerM2[b]}
                    disabled={locked}
                    onChange={(v) => setParams({ blockMortarPerM2: { ...current.params.blockMortarPerM2, [b]: v } })}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-[11px] font-medium text-muted-foreground">Pertes (%)</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {(Object.keys(LOSS_LABELS) as (keyof TakeoffLosses)[]).map((k) => (
                  <NumberField
                    key={k}
                    label={LOSS_LABELS[k]}
                    value={current.params.losses[k]}
                    disabled={locked}
                    onChange={(v) => setParams({ losses: { ...current.params.losses, [k]: v } })}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {result.materials.length > 0 && (
        <div className="rounded-md border bg-background">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-2.5 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide">
              Extrait des matériaux
              <span className="ml-2 font-normal normal-case text-muted-foreground">
                béton {formatQuoteQuantity(result.concreteVolume)} m³ · acier{' '}
                {formatQuoteQuantity(Math.round(result.steelKg))} kg · pertes incluses
              </span>
            </p>
            {!locked && (
              <Button type="button" size="sm" className="h-8 bg-[#2563EB]" onClick={() => onApply(result.materials)}>
                <ArrowDownToLine className="h-4 w-4" /> Reporter dans les Matériaux du lot
              </Button>
            )}
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y">
              {result.materials.map((m) => (
                <tr key={m.key}>
                  <td className="px-2.5 py-1.5">{m.designation}</td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums font-medium">{formatQuoteQuantity(m.quantity)}</td>
                  <td className="w-16 px-2.5 py-1.5 text-muted-foreground">{m.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t px-2.5 py-1.5 text-[11px] text-muted-foreground">
            Les prix viennent du catalogue. Les lignes reportées sont marquées « métré » et mises à jour à
            chaque nouveau report ; les prix que vous avez saisis sont conservés.
          </p>
        </div>
      )}
    </div>
  );
}
