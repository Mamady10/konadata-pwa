/**
 * Métré / extrait des matériaux : dimensions des ouvrages -> volumes et surfaces
 * -> quantités de matériaux (ciment, sable, gravier, aciers, agglos, carreaux, peinture…).
 */

export type TakeoffKind =
  | 'footing'
  | 'strip_footing'
  | 'ground_beam'
  | 'column'
  | 'beam'
  | 'tie_beam'
  | 'slab'
  | 'concrete_wall'
  | 'blinding'
  | 'masonry'
  | 'plaster'
  | 'screed'
  | 'tiling'
  | 'painting';

export type TakeoffGroup = 'reinforced' | 'blinding' | 'masonry' | 'finishes';
export type BlockType = 'hollow10' | 'hollow15' | 'hollow20' | 'solid15' | 'solid20';
export type SteelMode = 'ratio' | 'detail';
export type TakeoffField =
  | 'length'
  | 'width'
  | 'height'
  | 'thickness'
  | 'area'
  | 'openings'
  | 'dosage'
  | 'coats'
  | 'blockType';

export interface TakeoffRebar {
  id: string;
  diameter: number;
  /** Nombre de barres (ou de cadres) par élément. */
  count: number;
  /** Longueur développée d'une barre / d'un cadre (m). */
  length: number;
}

export interface TakeoffItem {
  id: string;
  kind: TakeoffKind;
  label: string;
  count: number;
  length: number;
  width: number;
  height: number;
  thickness: number;
  /** Surface saisie directement (remplace longueur x hauteur/largeur si > 0). */
  area: number;
  /** Ouvertures déduites (m², total). */
  openings: number;
  /** Dosage en ciment (kg/m³ de béton ou de mortier). */
  dosage: number;
  steelMode: SteelMode;
  steelRatio: number;
  mainDiameter: number;
  secondaryDiameter: number;
  /** Part des aciers secondaires / cadres dans le ratio (%). */
  secondaryShare: number;
  rebars: TakeoffRebar[];
  blockType: BlockType;
  coats: number;
}

export interface TakeoffLosses {
  concrete: number;
  steel: number;
  blocks: number;
  mortar: number;
  tiles: number;
  paint: number;
}

export interface TakeoffParams {
  cementBagKg: number;
  sandPerM3Concrete: number;
  gravelPerM3Concrete: number;
  sandPerM3Mortar: number;
  blocksPerM2: number;
  blockMortarPerM2: Record<BlockType, number>;
  tileBedThickness: number;
  tileBedDosage: number;
  tileJointKgPerM2: number;
  paintYieldM2PerL: number;
  primerYieldM2PerL: number;
  tieWirePct: number;
  barLength: number;
  losses: TakeoffLosses;
}

export interface LotTakeoff {
  items: TakeoffItem[];
  params: TakeoffParams;
}

export const DEFAULT_TAKEOFF_PARAMS: TakeoffParams = {
  cementBagKg: 50,
  sandPerM3Concrete: 0.4,
  gravelPerM3Concrete: 0.8,
  sandPerM3Mortar: 1.1,
  blocksPerM2: 12.5,
  blockMortarPerM2: { hollow10: 0.01, hollow15: 0.015, hollow20: 0.02, solid15: 0.02, solid20: 0.025 },
  tileBedThickness: 0.03,
  tileBedDosage: 300,
  tileJointKgPerM2: 0.5,
  paintYieldM2PerL: 10,
  primerYieldM2PerL: 10,
  tieWirePct: 1,
  barLength: 12,
  losses: { concrete: 5, steel: 5, blocks: 5, mortar: 5, tiles: 10, paint: 5 },
};

export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  hollow10: 'Agglos creux 10',
  hollow15: 'Agglos creux 15',
  hollow20: 'Agglos creux 20',
  solid15: 'Agglos pleins 15',
  solid20: 'Agglos pleins 20',
};

export const REBAR_DIAMETERS = [6, 8, 10, 12, 14, 16, 20, 25];

export const TAKEOFF_GROUP_LABELS: Record<TakeoffGroup, string> = {
  reinforced: 'Béton armé',
  blinding: 'Béton de propreté',
  masonry: 'Maçonnerie',
  finishes: 'Enduits, chapes, carrelage, peinture',
};

interface KindMeta {
  label: string;
  group: TakeoffGroup;
  fields: TakeoffField[];
  fieldLabels: Partial<Record<TakeoffField, string>>;
  countLabel: string;
  defaults: Partial<TakeoffItem>;
}

const RC_FIELDS: TakeoffField[] = ['length', 'width', 'height', 'dosage'];

export const TAKEOFF_KINDS: Record<TakeoffKind, KindMeta> = {
  footing: {
    label: 'Semelle isolée',
    group: 'reinforced',
    fields: RC_FIELDS,
    fieldLabels: { length: 'Longueur', width: 'Largeur', height: 'Hauteur' },
    countLabel: 'Nombre',
    defaults: { length: 1.2, width: 1.2, height: 0.4, dosage: 350, steelRatio: 60, mainDiameter: 12, secondaryDiameter: 10, secondaryShare: 0 },
  },
  strip_footing: {
    label: 'Semelle filante',
    group: 'reinforced',
    fields: RC_FIELDS,
    fieldLabels: { length: 'Longueur totale', width: 'Largeur', height: 'Hauteur' },
    countLabel: 'Nombre',
    defaults: { length: 10, width: 0.6, height: 0.3, dosage: 350, steelRatio: 60, mainDiameter: 10, secondaryDiameter: 6, secondaryShare: 20 },
  },
  ground_beam: {
    label: 'Longrine',
    group: 'reinforced',
    fields: RC_FIELDS,
    fieldLabels: { length: 'Longueur', width: 'Largeur', height: 'Hauteur' },
    countLabel: 'Nombre',
    defaults: { length: 10, width: 0.2, height: 0.4, dosage: 350, steelRatio: 90, mainDiameter: 12, secondaryDiameter: 6, secondaryShare: 25 },
  },
  column: {
    label: 'Poteau',
    group: 'reinforced',
    fields: RC_FIELDS,
    fieldLabels: { length: 'Côté a', width: 'Côté b', height: 'Hauteur' },
    countLabel: 'Nombre',
    defaults: { length: 0.2, width: 0.2, height: 3, dosage: 350, steelRatio: 130, mainDiameter: 12, secondaryDiameter: 6, secondaryShare: 25 },
  },
  beam: {
    label: 'Poutre',
    group: 'reinforced',
    fields: RC_FIELDS,
    fieldLabels: { length: 'Portée', width: 'Largeur', height: 'Hauteur' },
    countLabel: 'Nombre',
    defaults: { length: 5, width: 0.2, height: 0.4, dosage: 350, steelRatio: 110, mainDiameter: 12, secondaryDiameter: 6, secondaryShare: 25 },
  },
  tie_beam: {
    label: 'Chaînage',
    group: 'reinforced',
    fields: RC_FIELDS,
    fieldLabels: { length: 'Longueur totale', width: 'Largeur', height: 'Hauteur' },
    countLabel: 'Nombre',
    defaults: { length: 10, width: 0.2, height: 0.2, dosage: 350, steelRatio: 90, mainDiameter: 10, secondaryDiameter: 6, secondaryShare: 25 },
  },
  slab: {
    label: 'Dalle pleine',
    group: 'reinforced',
    fields: RC_FIELDS,
    fieldLabels: { length: 'Longueur', width: 'Largeur', height: 'Épaisseur' },
    countLabel: 'Nombre',
    defaults: { length: 5, width: 4, height: 0.15, dosage: 350, steelRatio: 90, mainDiameter: 10, secondaryDiameter: 8, secondaryShare: 30 },
  },
  concrete_wall: {
    label: 'Voile béton',
    group: 'reinforced',
    fields: RC_FIELDS,
    fieldLabels: { length: 'Longueur', width: 'Épaisseur', height: 'Hauteur' },
    countLabel: 'Nombre',
    defaults: { length: 5, width: 0.2, height: 3, dosage: 350, steelRatio: 70, mainDiameter: 10, secondaryDiameter: 8, secondaryShare: 30 },
  },
  blinding: {
    label: 'Béton de propreté',
    group: 'blinding',
    fields: ['length', 'width', 'area', 'height', 'dosage'],
    fieldLabels: { length: 'Longueur', width: 'Largeur', height: 'Épaisseur' },
    countLabel: 'Nombre',
    defaults: { length: 1.4, width: 1.4, height: 0.05, dosage: 150 },
  },
  masonry: {
    label: 'Mur / cloison en agglos',
    group: 'masonry',
    fields: ['blockType', 'length', 'height', 'area', 'openings', 'dosage'],
    fieldLabels: { length: 'Longueur', height: 'Hauteur', dosage: 'Dosage mortier' },
    countLabel: 'Nombre',
    defaults: { length: 10, height: 3, dosage: 300, blockType: 'hollow15' },
  },
  plaster: {
    label: 'Enduit',
    group: 'finishes',
    fields: ['length', 'height', 'area', 'openings', 'thickness', 'dosage'],
    fieldLabels: { length: 'Longueur', height: 'Hauteur', dosage: 'Dosage mortier' },
    countLabel: 'Faces',
    defaults: { length: 10, height: 3, thickness: 0.02, dosage: 350, count: 2 },
  },
  screed: {
    label: 'Chape',
    group: 'finishes',
    fields: ['length', 'width', 'area', 'thickness', 'dosage'],
    fieldLabels: { length: 'Longueur', width: 'Largeur', dosage: 'Dosage mortier' },
    countLabel: 'Nombre',
    defaults: { length: 5, width: 4, thickness: 0.05, dosage: 350 },
  },
  tiling: {
    label: 'Carrelage',
    group: 'finishes',
    fields: ['length', 'width', 'area'],
    fieldLabels: { length: 'Longueur', width: 'Largeur' },
    countLabel: 'Nombre',
    defaults: { length: 5, width: 4 },
  },
  painting: {
    label: 'Peinture',
    group: 'finishes',
    fields: ['length', 'height', 'area', 'openings', 'coats'],
    fieldLabels: { length: 'Longueur', height: 'Hauteur' },
    countLabel: 'Faces',
    defaults: { length: 10, height: 3, coats: 2, count: 2 },
  },
};

export const TAKEOFF_KIND_ORDER: TakeoffKind[] = [
  'footing',
  'strip_footing',
  'ground_beam',
  'column',
  'beam',
  'tie_beam',
  'slab',
  'concrete_wall',
  'blinding',
  'masonry',
  'plaster',
  'screed',
  'tiling',
  'painting',
];

export function isReinforced(kind: TakeoffKind): boolean {
  return TAKEOFF_KINDS[kind].group === 'reinforced';
}

function takeoffId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function newTakeoffItem(kind: TakeoffKind): TakeoffItem {
  const meta = TAKEOFF_KINDS[kind];
  return {
    id: takeoffId(),
    kind,
    label: meta.label,
    count: 1,
    length: 0,
    width: 0,
    height: 0,
    thickness: 0,
    area: 0,
    openings: 0,
    dosage: 350,
    steelMode: 'ratio',
    steelRatio: 0,
    mainDiameter: 12,
    secondaryDiameter: 6,
    secondaryShare: 0,
    rebars: [],
    blockType: 'hollow15',
    coats: 2,
    ...meta.defaults,
  };
}

export function newTakeoffRebar(diameter = 12): TakeoffRebar {
  return { id: takeoffId(), diameter, count: 4, length: 3 };
}

export function emptyLotTakeoff(): LotTakeoff {
  return { items: [], params: structuredCloneParams(DEFAULT_TAKEOFF_PARAMS) };
}

function structuredCloneParams(p: TakeoffParams): TakeoffParams {
  return { ...p, blockMortarPerM2: { ...p.blockMortarPerM2 }, losses: { ...p.losses } };
}

/** Masse linéique d'une barre HA (kg/m) = 0,00617 x d². */
export function rebarKgPerMeter(diameter: number): number {
  return 0.00617 * diameter * diameter;
}

// ─── Calcul ─────────────────────────────────────────────────────────

export interface TakeoffItemResult {
  item: TakeoffItem;
  /** Volume (m³) pour le béton, surface (m²) pour le reste. */
  quantity: number;
  unit: 'm³' | 'm²';
  formwork: number;
  steelKg: number;
}

export interface TakeoffMaterial {
  key: string;
  designation: string;
  unit: string;
  quantity: number;
}

export interface TakeoffResult {
  items: TakeoffItemResult[];
  materials: TakeoffMaterial[];
  concreteVolume: number;
  steelKg: number;
}

const n = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0);
const withLoss = (v: number, pct: number) => v * (1 + n(pct) / 100);
const ceilTo = (v: number, step: number) => Math.ceil(v / step - 1e-9) * step;
const round3 = (v: number) => Math.round(v * 1000) / 1000;

function wallArea(item: TakeoffItem): number {
  const gross = n(item.area) > 0 ? n(item.area) : n(item.length) * n(item.height);
  return Math.max(0, gross * n(item.count) - n(item.openings));
}

function floorArea(item: TakeoffItem): number {
  const base = n(item.area) > 0 ? n(item.area) : n(item.length) * n(item.width);
  return base * n(item.count);
}

function formworkArea(item: TakeoffItem): number {
  const { length: a, width: b, height: h } = item;
  const c = n(item.count);
  switch (item.kind) {
    case 'footing':
    case 'column':
      return 2 * (n(a) + n(b)) * n(h) * c;
    case 'strip_footing':
    case 'ground_beam':
    case 'tie_beam':
    case 'concrete_wall':
      return 2 * n(a) * n(h) * c;
    case 'beam':
      return (2 * n(h) + n(b)) * n(a) * c;
    case 'slab':
      return n(a) * n(b) * c;
    default:
      return 0;
  }
}

/** Aciers d'un élément, en kg par diamètre. */
function steelByDiameter(item: TakeoffItem, volume: number): Map<number, number> {
  const out = new Map<number, number>();
  const add = (d: number, kg: number) => {
    if (kg > 0 && d > 0) out.set(d, (out.get(d) ?? 0) + kg);
  };
  if (item.steelMode === 'detail') {
    for (const r of item.rebars) {
      add(r.diameter, n(r.count) * n(r.length) * rebarKgPerMeter(r.diameter) * n(item.count));
    }
  } else {
    const kg = volume * n(item.steelRatio);
    const share = Math.min(100, n(item.secondaryShare)) / 100;
    add(item.mainDiameter, kg * (1 - share));
    add(item.secondaryDiameter, kg * share);
  }
  return out;
}

export function computeTakeoff(takeoff: LotTakeoff): TakeoffResult {
  const p = takeoff.params;
  const L = p.losses;
  let cementConcrete = 0;
  let cementMortar = 0;
  let sandConcrete = 0;
  let sandMortar = 0;
  let gravel = 0;
  let formwork = 0;
  let tiles = 0;
  let joint = 0;
  let paint = 0;
  let primer = 0;
  let concreteVolume = 0;
  const steel = new Map<number, number>();
  const blocks = new Map<BlockType, number>();

  const items = takeoff.items.map((item): TakeoffItemResult => {
    const addMortar = (volume: number, dosage: number) => {
      cementMortar += volume * n(dosage);
      sandMortar += volume * n(p.sandPerM3Mortar);
    };

    if (isReinforced(item.kind) || item.kind === 'blinding') {
      const volume =
        item.kind === 'blinding'
          ? floorArea(item) * n(item.height)
          : n(item.length) * n(item.width) * n(item.height) * n(item.count);
      concreteVolume += volume;
      cementConcrete += volume * n(item.dosage);
      sandConcrete += volume * n(p.sandPerM3Concrete);
      gravel += volume * n(p.gravelPerM3Concrete);
      const fw = formworkArea(item);
      formwork += fw;
      let steelKg = 0;
      if (isReinforced(item.kind)) {
        for (const [d, kg] of steelByDiameter(item, volume)) {
          steel.set(d, (steel.get(d) ?? 0) + kg);
          steelKg += kg;
        }
      }
      return { item, quantity: round3(volume), unit: 'm³', formwork: round3(fw), steelKg: round3(steelKg) };
    }

    if (item.kind === 'masonry') {
      const area = wallArea(item);
      blocks.set(item.blockType, (blocks.get(item.blockType) ?? 0) + area * n(p.blocksPerM2));
      addMortar(area * n(p.blockMortarPerM2[item.blockType]), item.dosage);
      return { item, quantity: round3(area), unit: 'm²', formwork: 0, steelKg: 0 };
    }

    if (item.kind === 'plaster') {
      const area = wallArea(item);
      addMortar(area * n(item.thickness), item.dosage);
      return { item, quantity: round3(area), unit: 'm²', formwork: 0, steelKg: 0 };
    }

    if (item.kind === 'screed') {
      const area = floorArea(item);
      addMortar(area * n(item.thickness), item.dosage);
      return { item, quantity: round3(area), unit: 'm²', formwork: 0, steelKg: 0 };
    }

    if (item.kind === 'tiling') {
      const area = floorArea(item);
      tiles += area;
      joint += area * n(p.tileJointKgPerM2);
      addMortar(area * n(p.tileBedThickness), p.tileBedDosage);
      return { item, quantity: round3(area), unit: 'm²', formwork: 0, steelKg: 0 };
    }

    // Peinture
    const area = wallArea(item);
    if (n(p.paintYieldM2PerL) > 0) paint += (area * Math.max(1, n(item.coats))) / p.paintYieldM2PerL;
    if (n(p.primerYieldM2PerL) > 0) primer += area / p.primerYieldM2PerL;
    return { item, quantity: round3(area), unit: 'm²', formwork: 0, steelKg: 0 };
  });

  const materials: TakeoffMaterial[] = [];
  const push = (key: string, designation: string, unit: string, quantity: number) => {
    if (quantity > 0) materials.push({ key, designation, unit, quantity: round3(quantity) });
  };

  const cementKg = withLoss(cementConcrete, L.concrete) + withLoss(cementMortar, L.mortar);
  const bagKg = n(p.cementBagKg) || 50;
  push('cement', `Ciment CPJ 42.5 (sac de ${bagKg} kg)`, 'sac', Math.ceil(cementKg / bagKg - 1e-9));
  push('sand', 'Sable', 'm³', ceilTo(withLoss(sandConcrete, L.concrete) + withLoss(sandMortar, L.mortar), 0.1));
  push('gravel', 'Gravier', 'm³', ceilTo(withLoss(gravel, L.concrete), 0.1));

  let steelTotal = 0;
  const barLength = n(p.barLength) || 12;
  for (const d of [...steel.keys()].sort((a, b) => a - b)) {
    const kg = steel.get(d) ?? 0;
    steelTotal += kg;
    const meters = withLoss(kg / rebarKgPerMeter(d), L.steel);
    push(`steel-${d}`, `Fer HA${d} (barre de ${barLength} m)`, 'barre', Math.ceil(meters / barLength - 1e-9));
  }
  push('tie-wire', 'Fil à ligaturer', 'kg', Math.ceil(withLoss((steelTotal * n(p.tieWirePct)) / 100, L.steel) - 1e-9));
  push('formwork', 'Coffrage bois (surface à coffrer)', 'm²', Math.ceil(formwork - 1e-9));

  for (const type of Object.keys(BLOCK_TYPE_LABELS) as BlockType[]) {
    const count = blocks.get(type) ?? 0;
    push(`block-${type}`, BLOCK_TYPE_LABELS[type], 'u', Math.ceil(withLoss(count, L.blocks) - 1e-9));
  }
  push('tiles', 'Carreaux', 'm²', Math.ceil(withLoss(tiles, L.tiles) - 1e-9));
  push('tile-joint', 'Ciment blanc (joints)', 'kg', Math.ceil(withLoss(joint, L.tiles) - 1e-9));
  push('primer', "Peinture d'impression", 'L', Math.ceil(withLoss(primer, L.paint) - 1e-9));
  push('paint', 'Peinture de finition', 'L', Math.ceil(withLoss(paint, L.paint) - 1e-9));

  return { items, materials, concreteVolume: round3(concreteVolume), steelKg: round3(steelTotal) };
}

// ─── Validation (données reçues du client ou de la base) ─────────────

function num(v: unknown, fallback = 0, max = 1e9): number {
  const x = typeof v === 'string' ? Number(v.replace(/\s/g, '').replace(',', '.')) : Number(v);
  return Number.isFinite(x) && x >= 0 ? Math.min(x, max) : fallback;
}

export function parseLotTakeoff(raw: unknown): LotTakeoff | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const itemsRaw = Array.isArray(o.items) ? o.items : [];
  const pr = (o.params ?? {}) as Record<string, unknown>;
  const d = DEFAULT_TAKEOFF_PARAMS;
  const lossesRaw = (pr.losses ?? {}) as Record<string, unknown>;
  const mortarRaw = (pr.blockMortarPerM2 ?? {}) as Record<string, unknown>;
  const params: TakeoffParams = {
    cementBagKg: num(pr.cementBagKg, d.cementBagKg, 1000) || d.cementBagKg,
    sandPerM3Concrete: num(pr.sandPerM3Concrete, d.sandPerM3Concrete, 10),
    gravelPerM3Concrete: num(pr.gravelPerM3Concrete, d.gravelPerM3Concrete, 10),
    sandPerM3Mortar: num(pr.sandPerM3Mortar, d.sandPerM3Mortar, 10),
    blocksPerM2: num(pr.blocksPerM2, d.blocksPerM2, 100),
    blockMortarPerM2: Object.fromEntries(
      (Object.keys(d.blockMortarPerM2) as BlockType[]).map((k) => [k, num(mortarRaw[k], d.blockMortarPerM2[k], 1)])
    ) as Record<BlockType, number>,
    tileBedThickness: num(pr.tileBedThickness, d.tileBedThickness, 1),
    tileBedDosage: num(pr.tileBedDosage, d.tileBedDosage, 1000),
    tileJointKgPerM2: num(pr.tileJointKgPerM2, d.tileJointKgPerM2, 100),
    paintYieldM2PerL: num(pr.paintYieldM2PerL, d.paintYieldM2PerL, 1000),
    primerYieldM2PerL: num(pr.primerYieldM2PerL, d.primerYieldM2PerL, 1000),
    tieWirePct: num(pr.tieWirePct, d.tieWirePct, 100),
    barLength: num(pr.barLength, d.barLength, 100) || d.barLength,
    losses: Object.fromEntries(
      (Object.keys(d.losses) as (keyof TakeoffLosses)[]).map((k) => [k, num(lossesRaw[k], d.losses[k], 100)])
    ) as unknown as TakeoffLosses,
  };

  const items = itemsRaw.slice(0, 300).flatMap((itemRaw): TakeoffItem[] => {
    const it = (itemRaw ?? {}) as Record<string, unknown>;
    const kind = it.kind as TakeoffKind;
    if (!TAKEOFF_KINDS[kind]) return [];
    const base = newTakeoffItem(kind);
    const rebarsRaw = Array.isArray(it.rebars) ? it.rebars : [];
    return [
      {
        ...base,
        id: String(it.id ?? '').slice(0, 64) || base.id,
        label: String(it.label ?? '').trim().slice(0, 120) || base.label,
        count: num(it.count, base.count, 100000),
        length: num(it.length, 0, 100000),
        width: num(it.width, 0, 100000),
        height: num(it.height, 0, 100000),
        thickness: num(it.thickness, 0, 100),
        area: num(it.area, 0, 10000000),
        openings: num(it.openings, 0, 10000000),
        dosage: num(it.dosage, base.dosage, 1000),
        steelMode: it.steelMode === 'detail' ? 'detail' : 'ratio',
        steelRatio: num(it.steelRatio, base.steelRatio, 1000),
        mainDiameter: num(it.mainDiameter, base.mainDiameter, 50),
        secondaryDiameter: num(it.secondaryDiameter, base.secondaryDiameter, 50),
        secondaryShare: num(it.secondaryShare, base.secondaryShare, 100),
        blockType: (it.blockType as BlockType) in BLOCK_TYPE_LABELS ? (it.blockType as BlockType) : base.blockType,
        coats: num(it.coats, base.coats, 10),
        rebars: rebarsRaw.slice(0, 50).map((rRaw) => {
          const r = (rRaw ?? {}) as Record<string, unknown>;
          return {
            id: String(r.id ?? '').slice(0, 64) || takeoffId(),
            diameter: num(r.diameter, 12, 50),
            count: num(r.count, 0, 100000),
            length: num(r.length, 0, 1000),
          };
        }),
      },
    ];
  });

  return { items, params };
}
