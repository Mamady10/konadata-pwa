'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireOrgId } from '@/lib/actions/org';
import { getMyAssignedBtpSiteIds } from '@/lib/actions/assignments';
import type { BtpItemCategory } from '@/lib/btp/delivery-note-types';

const STOCK_PATHS = ['/btp/materiels', '/btp/bons', '/btp'];

function revalidateStockPaths() {
  for (const p of STOCK_PATHS) revalidatePath(p);
}

async function assertSiteAccess(siteId: string | null): Promise<{ error: string } | { ok: true }> {
  if (!siteId) return { ok: true };
  const assigned = await getMyAssignedBtpSiteIds();
  if (assigned !== null && !assigned.includes(siteId)) {
    return { error: 'Vous n\'êtes pas assigné à ce chantier.' };
  }
  return { ok: true };
}

export interface BtpStockMovementRow {
  id: string;
  stockId: string;
  itemName: string;
  movementType: 'in' | 'out';
  quantity: number;
  unit: string | null;
  siteName: string | null;
  requesterLabel: string | null;
  notes: string | null;
  movementDate: string;
}

async function findOrCreateStock(params: {
  orgId: string;
  itemName: string;
  unit: string | null;
  category: BtpItemCategory | null;
  siteId: string | null;
}): Promise<{ id: string; quantity: number }> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('btp_stock')
    .select('id, quantity')
    .eq('organization_id', params.orgId)
    .eq('item_name', params.itemName)
    .maybeSingle();

  if (existing?.id) {
    return { id: existing.id as string, quantity: Number(existing.quantity ?? 0) };
  }

  const { data: created, error } = await supabase
    .from('btp_stock')
    .insert({
      organization_id: params.orgId,
      site_id: params.siteId,
      item_name: params.itemName,
      unit: params.unit,
      category: params.category,
      quantity: 0,
      min_threshold: 0,
    })
    .select('id, quantity')
    .single();
  if (error) throw new Error(error.message);
  return { id: created.id as string, quantity: Number(created.quantity ?? 0) };
}

async function applyStockMovement(params: {
  orgId: string;
  stockId: string;
  movementType: 'in' | 'out';
  quantity: number;
  siteId?: string | null;
  personnelId?: string | null;
  requesterName?: string | null;
  deliveryNoteId?: string | null;
  notes?: string | null;
  movementDate?: string;
  createdBy?: string | null;
}): Promise<void> {
  const supabase = await createClient();
  const { data: stock, error: stockErr } = await supabase
    .from('btp_stock')
    .select('id, quantity')
    .eq('id', params.stockId)
    .eq('organization_id', params.orgId)
    .single();
  if (stockErr || !stock) throw new Error('Article de stock introuvable.');

  const current = Number(stock.quantity ?? 0);
  const next = params.movementType === 'in' ? current + params.quantity : current - params.quantity;
  if (next < 0) throw new Error('Stock insuffisant pour cette sortie.');

  const { error: movErr } = await supabase.from('btp_stock_movements').insert({
    organization_id: params.orgId,
    stock_id: params.stockId,
    movement_type: params.movementType,
    quantity: params.quantity,
    site_id: params.siteId ?? null,
    personnel_id: params.personnelId ?? null,
    requester_name: params.requesterName ?? null,
    delivery_note_id: params.deliveryNoteId ?? null,
    notes: params.notes ?? null,
    movement_date: params.movementDate ?? new Date().toISOString().slice(0, 10),
    created_by: params.createdBy ?? null,
  });
  if (movErr) throw new Error(movErr.message);

  const { error: updErr } = await supabase
    .from('btp_stock')
    .update({ quantity: next, last_updated: new Date().toISOString() })
    .eq('id', params.stockId);
  if (updErr) throw new Error(updErr.message);
}

export async function recordBtpStockEntry(formData: FormData): Promise<{ success: true } | { error: string }> {
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const itemName = (formData.get('item_name') as string)?.trim();
  const quantity = Number(formData.get('quantity') || 0);
  const unit = (formData.get('unit') as string)?.trim() || null;
  const category = ((formData.get('category') as string)?.trim() || 'materials') as BtpItemCategory;
  const siteId = (formData.get('site_id') as string)?.trim() || null;
  const notes = (formData.get('notes') as string)?.trim() || null;
  const movementDate = (formData.get('movement_date') as string)?.trim() || new Date().toISOString().slice(0, 10);

  if (!itemName) return { error: 'Nom de l\'article requis.' };
  if (quantity <= 0) return { error: 'Quantité invalide.' };

  const access = await assertSiteAccess(siteId);
  if ('error' in access) return access;

  try {
    const stock = await findOrCreateStock({ orgId, itemName, unit, category, siteId });
    await applyStockMovement({
      orgId,
      stockId: stock.id,
      movementType: 'in',
      quantity,
      siteId,
      notes,
      movementDate,
      createdBy: user?.id ?? null,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Entrée stock impossible.' };
  }

  revalidateStockPaths();
  return { success: true };
}

export async function recordBtpStockExit(formData: FormData): Promise<{ success: true } | { error: string }> {
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const stockId = (formData.get('stock_id') as string)?.trim();
  const siteId = (formData.get('site_id') as string)?.trim();
  const personnelId = (formData.get('personnel_id') as string)?.trim() || null;
  const requesterName = (formData.get('requester_name') as string)?.trim() || null;
  const quantity = Number(formData.get('quantity') || 0);
  const notes = (formData.get('notes') as string)?.trim() || null;
  const movementDate = (formData.get('movement_date') as string)?.trim() || new Date().toISOString().slice(0, 10);

  if (!stockId) return { error: 'Article requis.' };
  if (!siteId) return { error: 'Chantier requis pour une sortie.' };
  if (!personnelId && !requesterName) return { error: 'Indiquez qui demande la sortie.' };
  if (quantity <= 0) return { error: 'Quantité invalide.' };

  const access = await assertSiteAccess(siteId);
  if ('error' in access) return access;

  try {
    await applyStockMovement({
      orgId,
      stockId,
      movementType: 'out',
      quantity,
      siteId,
      personnelId,
      requesterName,
      notes,
      movementDate,
      createdBy: user?.id ?? null,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Sortie stock impossible.' };
  }

  revalidateStockPaths();
  return { success: true };
}

export async function addDeliveryItemsToStock(params: {
  orgId: string;
  siteId: string;
  deliveryNoteId: string;
  items: Array<{ item: string; qty: number; unit?: string; category?: string }>;
  createdBy?: string | null;
}): Promise<void> {
  for (const line of params.items) {
    if (!line.item || line.qty <= 0) continue;
    const stock = await findOrCreateStock({
      orgId: params.orgId,
      itemName: line.item,
      unit: line.unit ?? null,
      category: (line.category as BtpItemCategory) || 'materials',
      siteId: params.siteId,
    });
    await applyStockMovement({
      orgId: params.orgId,
      stockId: stock.id,
      movementType: 'in',
      quantity: line.qty,
      siteId: params.siteId,
      deliveryNoteId: params.deliveryNoteId,
      notes: `Réception BL`,
      createdBy: params.createdBy ?? null,
    });
  }
}

export async function getBtpStockMovements(orgId: string, limit = 40): Promise<BtpStockMovementRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('btp_stock_movements')
    .select(
      'id, stock_id, movement_type, quantity, notes, movement_date, requester_name, btp_stock(item_name, unit), btp_sites(name), btp_personnel(role, core_persons(full_name))'
    )
    .eq('organization_id', orgId)
    .order('movement_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data ?? []).map((r) => {
    const stock = r.btp_stock as { item_name?: string; unit?: string } | null;
    const site = r.btp_sites as { name?: string } | null;
    const person = r.btp_personnel as { role?: string; core_persons?: { full_name?: string } | null } | null;
    const personName = person?.core_persons?.full_name ?? person?.role ?? null;
    return {
      id: r.id as string,
      stockId: r.stock_id as string,
      itemName: stock?.item_name ?? '—',
      movementType: r.movement_type as 'in' | 'out',
      quantity: Number(r.quantity),
      unit: stock?.unit ?? null,
      siteName: site?.name ?? null,
      requesterLabel: personName ?? (r.requester_name as string) ?? null,
      notes: (r.notes as string) ?? null,
      movementDate: (r.movement_date as string).slice(0, 10),
    };
  });
}

export async function getBtpStockOptions(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('btp_stock')
    .select('id, item_name, unit, quantity, category, alert_level')
    .eq('organization_id', orgId)
    .order('item_name');
  if (error) throw error;
  return (data ?? []).map((s) => ({
    id: s.id as string,
    name: s.item_name as string,
    unit: (s.unit as string) ?? '',
    quantity: Number(s.quantity ?? 0),
    category: (s.category as string) ?? null,
    alertLevel: (s.alert_level as string) ?? 'normal',
  }));
}

export async function getBtpPersonnelForStock(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('btp_personnel')
    .select('id, role, core_persons(full_name)')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id as string,
    name: (p.core_persons as { full_name?: string } | null)?.full_name ?? (p.role as string) ?? 'Personnel',
    role: p.role as string,
  }));
}
