export type BtpItemCategory = 'materials' | 'equipment' | 'consumables' | 'tools' | 'other';

export const BTP_ITEM_CATEGORY_LABELS: Record<BtpItemCategory, string> = {
  materials: 'Matériaux',
  equipment: 'Équipement',
  consumables: 'Consommables',
  tools: 'Outillage',
  other: 'Autre',
};

export interface BtpDeliveryNoteItem {
  item: string;
  category?: BtpItemCategory | string;
  qty: number | string;
  unit?: string;
  description?: string;
}

export function parseDeliveryNoteItems(raw: unknown): BtpDeliveryNoteItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((row): BtpDeliveryNoteItem[] => {
    if (!row || typeof row !== 'object') return [];
    const o = row as Record<string, unknown>;
    const item = String(o.item ?? o.material ?? '').trim();
    if (!item) return [];
    const qty = o.qty ?? o.quantity;
    return [
      {
        item,
        category: (o.category as string) || undefined,
        qty: typeof qty === 'number' ? qty : String(qty ?? ''),
        unit: (o.unit as string) || undefined,
        description: (o.description as string) || undefined,
      },
    ];
  });
}

export function formatDeliveryItemsSummary(items: BtpDeliveryNoteItem[]): string {
  if (!items.length) return '—';
  return items
    .map((i) => {
      const qty = i.qty !== '' && i.qty != null ? ` × ${i.qty}${i.unit ? ` ${i.unit}` : ''}` : '';
      const cat = i.category ? ` (${BTP_ITEM_CATEGORY_LABELS[i.category as BtpItemCategory] ?? i.category})` : '';
      return `${i.item}${qty}${cat}`;
    })
    .join(' · ');
}
