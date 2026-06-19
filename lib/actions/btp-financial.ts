'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireOrgId } from '@/lib/actions/org';
import { canManageAssignments, getMyAssignedBtpSiteIds } from '@/lib/actions/assignments';
import {
  computeSiteFinancialTotals,
  compareBudgetByPoste,
  sumLaborEntryAmount,
  type ExpenseCategory,
  type SiteFinancialTotals,
  type PosteBudgetComparison,
  type BtpFinancialDashboardRow,
} from '@/lib/btp/site-financial';
import { parseBudgetBreakdown } from '@/lib/btp/site-baseline';
import type { BtpItemCategory } from '@/lib/btp/delivery-note-types';
import { parseDeliveryNoteItems } from '@/lib/btp/delivery-note-types';
import { sumPersonnelPayrollYtd } from '@/lib/btp/personnel-payroll';
import { addDeliveryItemsToStock } from '@/lib/actions/btp-stock';

export type BtpDeliveryNoteStatus = 'draft' | 'validated';

export interface BtpDeliveryNoteDetail {
  id: string;
  reference: string;
  siteId: string | null;
  siteName: string | null;
  supplier: string | null;
  totalAmount: number;
  deliveryDate: string | null;
  category: BtpItemCategory | null;
  description: string | null;
  status: BtpDeliveryNoteStatus;
  documentId: string | null;
  items: ReturnType<typeof parseDeliveryNoteItems>;
  stockMovements: Array<{
    id: string;
    quantity: number;
    movementDate: string;
    itemName: string;
  }>;
}

export interface BtpFinancialDashboardRowExtended extends BtpFinancialDashboardRow {
  posteComparison: PosteBudgetComparison[];
}

const FINANCE_PATHS = [
  '/btp/finances',
  '/btp/bons',
  '/btp/personnel',
  '/btp/carburant',
  '/btp/chantiers',
  '/btp/rapports',
  '/btp/materiels',
  '/btp',
];

function revalidateFinancialPaths() {
  for (const p of FINANCE_PATHS) revalidatePath(p);
}

async function assertSiteAccess(siteId: string): Promise<{ error: string } | { ok: true }> {
  const assigned = await getMyAssignedBtpSiteIds();
  if (assigned !== null && !assigned.includes(siteId)) {
    return { error: 'Vous n\'êtes pas assigné à ce chantier.' };
  }
  return { ok: true };
}

export async function fetchSiteFinancialData(
  orgId: string,
  siteId: string,
  asOfDate?: string
): Promise<{
  totals: SiteFinancialTotals;
  posteComparison: PosteBudgetComparison[];
  budget: number;
}> {
  const supabase = await createClient();
  const asOf = asOfDate ?? new Date().toISOString().slice(0, 10);

  const [siteRes, fuelRes, notesRes, laborRes, expensesRes, payrollRes] = await Promise.all([
    supabase
      .from('btp_sites')
      .select('budget, spent, opening_spent, budget_breakdown')
      .eq('id', siteId)
      .eq('organization_id', orgId)
      .single(),
    supabase
      .from('btp_fuel_logs')
      .select('cost, logged_at')
      .eq('site_id', siteId)
      .lte('logged_at', `${asOf}T23:59:59`),
    supabase
      .from('btp_delivery_notes')
      .select('total_amount, delivery_date, status')
      .eq('site_id', siteId),
    supabase
      .from('btp_labor_entries')
      .select('days, daily_rate, work_date')
      .eq('site_id', siteId)
      .lte('work_date', asOf),
    supabase
      .from('btp_site_expenses')
      .select('category, amount, expense_date')
      .eq('site_id', siteId)
      .lte('expense_date', asOf),
    supabase
      .from('btp_personnel')
      .select('monthly_salary, payroll_start_date')
      .eq('organization_id', orgId)
      .eq('site_id', siteId)
      .eq('is_active', true)
      .gt('monthly_salary', 0),
  ]);

  const site = siteRes.data;
  const budget = Number(site?.budget ?? 0);
  const openingSpent = Number(site?.opening_spent ?? 0);
  const breakdown = parseBudgetBreakdown(site?.budget_breakdown);

  const fuelCosts = (fuelRes.data ?? []).reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const deliveryAmounts = (notesRes.data ?? [])
    .filter((n) => {
      const status = (n.status as string) ?? 'validated';
      if (status !== 'validated') return false;
      const d = (n.delivery_date as string) || '';
      return !d || d.slice(0, 10) <= asOf;
    })
    .reduce((s, n) => s + Number(n.total_amount ?? 0), 0);

  const laborEntryAmounts = (laborRes.data ?? []).reduce(
    (s, r) => s + sumLaborEntryAmount(Number(r.days), Number(r.daily_rate)),
    0
  );

  const expensesByCategory: Partial<Record<ExpenseCategory, number>> = {};
  for (const e of expensesRes.data ?? []) {
    const cat = e.category as ExpenseCategory;
    expensesByCategory[cat] = (expensesByCategory[cat] ?? 0) + Number(e.amount ?? 0);
  }

  const laborPayrollAmounts = sumPersonnelPayrollYtd(
    (payrollRes.data ?? []).map((p) => ({
      monthlySalary: Number(p.monthly_salary ?? 0),
      payrollStartDate: (p.payroll_start_date as string) ?? null,
    })),
    asOf
  );

  const totals = computeSiteFinancialTotals({
    budget,
    openingSpent,
    fuelCosts,
    deliveryAmounts,
    laborEntryAmounts,
    laborPayrollAmounts,
    expensesByCategory,
  });

  return {
    totals,
    posteComparison: compareBudgetByPoste(budget, breakdown, totals.byPoste),
    budget,
  };
}

export async function syncBtpSiteSpent(orgId: string, siteId: string): Promise<void> {
  const { totals } = await fetchSiteFinancialData(orgId, siteId);
  const supabase = await createClient();
  await supabase
    .from('btp_sites')
    .update({
      spent: totals.total,
      financial_progress: totals.financialPct ?? 0,
    })
    .eq('id', siteId)
    .eq('organization_id', orgId);
}

export async function createBtpDeliveryNote(formData: FormData): Promise<{ success: true; id?: string } | { error: string }> {
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const siteId = (formData.get('site_id') as string)?.trim();
  const reference = (formData.get('reference') as string)?.trim();
  const amount = Number(formData.get('total_amount') || 0);
  const category = (formData.get('category') as string)?.trim() as BtpItemCategory;
  const description = (formData.get('description') as string)?.trim() || null;
  const addToStock = formData.get('add_to_stock') === 'true';
  const documentId = (formData.get('document_id') as string)?.trim() || null;
  const status = ((formData.get('status') as string)?.trim() || 'draft') as BtpDeliveryNoteStatus;

  let items: Array<{ item: string; category?: string; qty: number | string; unit?: string; description?: string }> = [];
  const itemsJson = (formData.get('items_json') as string)?.trim();
  if (itemsJson) {
    try {
      const parsed = JSON.parse(itemsJson) as unknown;
      if (Array.isArray(parsed)) {
        items = parsed
          .map((row) => {
            if (!row || typeof row !== 'object') return null;
            const o = row as Record<string, unknown>;
            const item = String(o.item ?? '').trim();
            if (!item) return null;
            return {
              item,
              category: (o.category as string) || category,
              qty: Number(o.qty) > 0 ? Number(o.qty) : o.qty ?? '',
              unit: (o.unit as string) || undefined,
              description: (o.description as string) || undefined,
            };
          })
          .filter((r): r is NonNullable<typeof r> => r !== null);
      }
    } catch {
      return { error: 'Lignes du bon invalides.' };
    }
  }

  return createBtpDeliveryNoteFromParams({
    orgId,
    userId: user?.id ?? null,
    siteId,
    reference,
    amount,
    category,
    description,
    items,
    addToStock,
    documentId,
    status,
    supplier: (formData.get('supplier') as string)?.trim() || null,
    deliveryDate: (formData.get('delivery_date') as string)?.trim() || new Date().toISOString().slice(0, 10),
  });
}

export async function createBtpDeliveryNoteFromParams(params: {
  orgId: string;
  userId?: string | null;
  siteId: string;
  reference: string;
  amount: number;
  category: BtpItemCategory;
  description?: string | null;
  items: Array<{ item: string; category?: string; qty: number | string; unit?: string; description?: string }>;
  addToStock?: boolean;
  documentId?: string | null;
  status?: BtpDeliveryNoteStatus;
  supplier?: string | null;
  deliveryDate?: string;
  skipAccessCheck?: boolean;
}): Promise<{ success: true; id: string } | { error: string }> {
  const supabase = await createClient();
  const status = params.status ?? 'draft';

  if (!params.siteId) return { error: 'Chantier requis.' };
  if (!params.reference) return { error: 'Référence du bon requise.' };
  if (params.amount <= 0) return { error: 'Montant invalide.' };
  if (!['materials', 'equipment', 'consumables', 'tools', 'other'].includes(params.category)) {
    return { error: 'Catégorie invalide.' };
  }
  if (params.addToStock) {
    const withQty = params.items.filter((i) => Number(i.qty) > 0);
    if (withQty.length === 0) {
      return { error: 'Ajoutez au moins une ligne avec quantité pour l\'entrée stock.' };
    }
  }

  if (!params.skipAccessCheck) {
    const access = await assertSiteAccess(params.siteId);
    if ('error' in access) return access;
  }

  const { data: dup } = await supabase
    .from('btp_delivery_notes')
    .select('id')
    .eq('organization_id', params.orgId)
    .eq('reference', params.reference)
    .maybeSingle();
  if (dup?.id) return { error: 'Cette référence de bon existe déjà.' };

  const deliveryDate = params.deliveryDate ?? new Date().toISOString().slice(0, 10);

  const { data: note, error } = await supabase
    .from('btp_delivery_notes')
    .insert({
      organization_id: params.orgId,
      site_id: params.siteId,
      reference: params.reference,
      supplier: params.supplier ?? null,
      total_amount: params.amount,
      delivery_date: deliveryDate,
      category: params.category,
      description: params.description ?? null,
      items: params.items,
      document_id: params.documentId ?? null,
      status,
    })
    .select('id')
    .single();
  if (error) return { error: error.message };

  const noteId = note.id as string;
  const shouldStock = params.addToStock && status === 'validated';

  if (shouldStock && params.items.length > 0) {
    try {
      await addDeliveryItemsToStock({
        orgId: params.orgId,
        siteId: params.siteId,
        deliveryNoteId: noteId,
        items: params.items
          .map((i) => ({
            item: i.item,
            qty: Number(i.qty),
            unit: i.unit,
            category: i.category ?? params.category,
          }))
          .filter((i) => i.qty > 0),
        createdBy: params.userId ?? null,
      });
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Bon enregistré mais entrée stock échouée.' };
    }
  }

  if (status === 'validated') {
    await syncBtpSiteSpent(params.orgId, params.siteId);
  }
  revalidateFinancialPaths();
  return { success: true, id: noteId };
}

export async function validateBtpDeliveryNote(
  noteId: string,
  options?: { addToStock?: boolean }
): Promise<{ success: true } | { error: string }> {
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: note } = await supabase
    .from('btp_delivery_notes')
    .select('id, site_id, status, items, category')
    .eq('id', noteId)
    .eq('organization_id', orgId)
    .single();
  if (!note) return { error: 'Bon introuvable.' };
  if ((note.status as string) === 'validated') return { error: 'Bon déjà validé.' };

  const siteId = note.site_id as string;
  const access = await assertSiteAccess(siteId);
  if ('error' in access) return access;

  const { error } = await supabase
    .from('btp_delivery_notes')
    .update({ status: 'validated' })
    .eq('id', noteId);
  if (error) return { error: error.message };

  const items = parseDeliveryNoteItems(note.items);
  if (options?.addToStock !== false && items.length > 0) {
    try {
      await addDeliveryItemsToStock({
        orgId,
        siteId,
        deliveryNoteId: noteId,
        items: items
          .map((i) => ({
            item: i.item,
            qty: Number(i.qty),
            unit: i.unit,
            category: (i.category as string) ?? (note.category as string) ?? 'materials',
          }))
          .filter((i) => i.qty > 0),
        createdBy: user?.id ?? null,
      });
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Validation OK mais entrée stock échouée.' };
    }
  }

  await syncBtpSiteSpent(orgId, siteId);
  revalidateFinancialPaths();
  return { success: true };
}

export async function getBtpDeliveryNoteDetail(noteId: string): Promise<BtpDeliveryNoteDetail | null> {
  const orgId = await requireOrgId();
  const supabase = await createClient();

  const { data: note } = await supabase
    .from('btp_delivery_notes')
    .select(
      'id, reference, site_id, supplier, total_amount, delivery_date, category, description, status, document_id, items, btp_sites(name)'
    )
    .eq('id', noteId)
    .eq('organization_id', orgId)
    .single();
  if (!note) return null;

  const assigned = await getMyAssignedBtpSiteIds();
  if (assigned !== null && note.site_id && !assigned.includes(note.site_id as string)) {
    return null;
  }

  const { data: movements } = await supabase
    .from('btp_stock_movements')
    .select('id, quantity, movement_date, btp_stock(item_name)')
    .eq('delivery_note_id', noteId)
    .order('movement_date', { ascending: false });

  const site = note.btp_sites as { name?: string } | null;

  return {
    id: note.id as string,
    reference: note.reference as string,
    siteId: (note.site_id as string) ?? null,
    siteName: site?.name ?? null,
    supplier: (note.supplier as string) ?? null,
    totalAmount: Number(note.total_amount ?? 0),
    deliveryDate: (note.delivery_date as string)?.slice(0, 10) ?? null,
    category: (note.category as BtpItemCategory) ?? null,
    description: (note.description as string) ?? null,
    status: ((note.status as string) ?? 'validated') as BtpDeliveryNoteStatus,
    documentId: (note.document_id as string) ?? null,
    items: parseDeliveryNoteItems(note.items),
    stockMovements: (movements ?? []).map((m) => {
      const stock = m.btp_stock as { item_name?: string } | null;
      return {
        id: m.id as string,
        quantity: Number(m.quantity),
        movementDate: (m.movement_date as string).slice(0, 10),
        itemName: stock?.item_name ?? '—',
      };
    }),
  };
}

export async function createBtpSiteExpense(formData: FormData): Promise<{ success: true } | { error: string }> {
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const siteId = (formData.get('site_id') as string)?.trim();
  const category = (formData.get('category') as string)?.trim() as ExpenseCategory;
  const amount = Number(formData.get('amount') || 0);
  if (!siteId) return { error: 'Chantier requis.' };
  if (!['labor', 'materials', 'equipment', 'subcontract', 'overhead', 'other'].includes(category)) {
    return { error: 'Catégorie invalide.' };
  }
  if (amount <= 0) return { error: 'Montant invalide.' };

  const access = await assertSiteAccess(siteId);
  if ('error' in access) return access;

  const { error } = await supabase.from('btp_site_expenses').insert({
    organization_id: orgId,
    site_id: siteId,
    category,
    amount,
    expense_date: (formData.get('expense_date') as string)?.trim() || new Date().toISOString().slice(0, 10),
    description: (formData.get('description') as string)?.trim() || null,
    reference: (formData.get('reference') as string)?.trim() || null,
    supplier: (formData.get('supplier') as string)?.trim() || null,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  await syncBtpSiteSpent(orgId, siteId);
  revalidateFinancialPaths();
  return { success: true };
}

export async function createBtpLaborEntry(formData: FormData): Promise<{ success: true } | { error: string }> {
  const orgId = await requireOrgId();
  const supabase = await createClient();

  const siteId = (formData.get('site_id') as string)?.trim();
  const personnelId = (formData.get('personnel_id') as string)?.trim();
  const days = Number(formData.get('days') || 1);
  if (!siteId || !personnelId) return { error: 'Chantier et collaborateur requis.' };
  if (days <= 0) return { error: 'Nombre de jours invalide.' };

  const access = await assertSiteAccess(siteId);
  if ('error' in access) return access;

  const { data: person } = await supabase
    .from('btp_personnel')
    .select('daily_rate')
    .eq('id', personnelId)
    .eq('organization_id', orgId)
    .single();

  const dailyRate = Number(formData.get('daily_rate') || person?.daily_rate || 0);
  const workDate = (formData.get('work_date') as string)?.trim() || new Date().toISOString().slice(0, 10);

  const { error } = await supabase.from('btp_labor_entries').upsert(
    {
      organization_id: orgId,
      site_id: siteId,
      personnel_id: personnelId,
      work_date: workDate,
      days,
      daily_rate: dailyRate,
      notes: (formData.get('notes') as string)?.trim() || null,
    },
    { onConflict: 'personnel_id,site_id,work_date' }
  );
  if (error) return { error: error.message };

  await syncBtpSiteSpent(orgId, siteId);
  revalidateFinancialPaths();
  return { success: true };
}

export async function createBtpSubcontractContract(
  formData: FormData
): Promise<{ success: true } | { error: string }> {
  const canManage = await canManageAssignments();
  if (!canManage) return { error: 'Réservé aux directeurs.' };

  const orgId = await requireOrgId();
  const supabase = await createClient();

  const siteId = (formData.get('site_id') as string)?.trim();
  const title = (formData.get('title') as string)?.trim();
  const amount = Number(formData.get('amount') || 0);
  if (!siteId || !title) return { error: 'Chantier et intitulé requis.' };

  const { data: contract, error } = await supabase
    .from('btp_contracts')
    .insert({
      organization_id: orgId,
      site_id: siteId,
      title,
      contractor: (formData.get('contractor') as string)?.trim() || null,
      amount: amount > 0 ? amount : null,
      signed_date: (formData.get('signed_date') as string)?.trim() || null,
      end_date: (formData.get('end_date') as string)?.trim() || null,
      contract_type: 'subcontract',
      status: 'active',
    })
    .select('id')
    .single();
  if (error) return { error: error.message };

  const payment = Number(formData.get('initial_payment') || 0);
  if (payment > 0 && contract?.id) {
    await supabase.from('btp_site_expenses').insert({
      organization_id: orgId,
      site_id: siteId,
      category: 'subcontract',
      amount: payment,
      expense_date: new Date().toISOString().slice(0, 10),
      description: `Acompte — ${title}`,
      contract_id: contract.id,
    });
    await supabase
      .from('btp_contracts')
      .update({ paid_amount: payment })
      .eq('id', contract.id);
  }

  await syncBtpSiteSpent(orgId, siteId);
  revalidateFinancialPaths();
  return { success: true };
}

export async function recordBtpSubcontractPayment(
  formData: FormData
): Promise<{ success: true } | { error: string }> {
  const canManage = await canManageAssignments();
  if (!canManage) return { error: 'Réservé aux directeurs.' };

  const orgId = await requireOrgId();
  const supabase = await createClient();

  const contractId = (formData.get('contract_id') as string)?.trim();
  const amount = Number(formData.get('amount') || 0);
  if (!contractId || amount <= 0) return { error: 'Contrat et montant requis.' };

  const { data: contract } = await supabase
    .from('btp_contracts')
    .select('id, site_id, title, paid_amount')
    .eq('id', contractId)
    .eq('organization_id', orgId)
    .single();
  if (!contract) return { error: 'Contrat introuvable.' };

  const { error } = await supabase.from('btp_site_expenses').insert({
    organization_id: orgId,
    site_id: contract.site_id,
    category: 'subcontract',
    amount,
    expense_date: (formData.get('payment_date') as string)?.trim() || new Date().toISOString().slice(0, 10),
    description: (formData.get('description') as string)?.trim() || `Paiement — ${contract.title}`,
    contract_id: contractId,
  });
  if (error) return { error: error.message };

  await supabase
    .from('btp_contracts')
    .update({ paid_amount: Number(contract.paid_amount ?? 0) + amount })
    .eq('id', contractId);

  await syncBtpSiteSpent(orgId, contract.site_id as string);
  revalidateFinancialPaths();
  return { success: true };
}

export async function getBtpFinancialDashboard(orgId: string): Promise<BtpFinancialDashboardRowExtended[]> {
  const supabase = await createClient();
  const { data: sites } = await supabase
    .from('btp_sites')
    .select('id, name, budget, spent, financial_progress')
    .eq('organization_id', orgId)
    .order('name');

  const assigned = await getMyAssignedBtpSiteIds();
  const filtered = (sites ?? []).filter((s) => assigned === null || assigned.includes(s.id as string));

  const rows: BtpFinancialDashboardRowExtended[] = [];
  for (const s of filtered) {
    const { totals, posteComparison } = await fetchSiteFinancialData(orgId, s.id as string);
    rows.push({
      siteId: s.id as string,
      siteName: s.name as string,
      budget: Number(s.budget ?? 0),
      spent: totals.total,
      financialPct: totals.financialPct ?? Number(s.financial_progress ?? 0),
      labor: totals.byPoste.labor,
      materials: totals.byPoste.materials,
      equipment: totals.byPoste.equipment,
      subcontract: totals.byPoste.subcontract,
      overhead: totals.byPoste.overhead,
      posteComparison,
    });
  }
  return rows;
}

export async function exportBtpExpensesCsv(): Promise<string> {
  const orgId = await requireOrgId();
  const expenses = await getBtpSiteExpenses(orgId, 500);
  const header = 'Date;Chantier;Catégorie;Montant;Fournisseur;Référence;Description';
  const lines = expenses.map((e) => {
    const site = (e.btp_sites as { name?: string } | null)?.name ?? '';
    const cat = EXPENSE_CATEGORY_LABELS[e.category as ExpenseCategory] ?? e.category;
    const desc = String(e.description ?? '').replace(/;/g, ',');
    return [
      e.expense_date,
      site,
      cat,
      Number(e.amount),
      e.supplier ?? '',
      e.reference ?? '',
      desc,
    ].join(';');
  });
  return [header, ...lines].join('\n');
}

export async function getBtpLaborEntries(orgId: string, limit = 30) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('btp_labor_entries')
    .select(
      'id, site_id, work_date, days, daily_rate, notes, btp_personnel(role, core_persons(full_name)), btp_sites(name)'
    )
    .eq('organization_id', orgId)
    .order('work_date', { ascending: false })
    .limit(limit);
  if (error) throw error;

  const assigned = await getMyAssignedBtpSiteIds();
  return (data ?? []).filter((r) => assigned === null || assigned.includes(r.site_id as string));
}

export async function getBtpSiteExpenses(orgId: string, limit = 40) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('btp_site_expenses')
    .select('id, site_id, category, amount, expense_date, description, reference, supplier, btp_sites(name)')
    .eq('organization_id', orgId)
    .order('expense_date', { ascending: false })
    .limit(limit);
  if (error) throw error;

  const assigned = await getMyAssignedBtpSiteIds();
  return (data ?? []).filter((r) => assigned === null || assigned.includes(r.site_id as string));
}

export async function getBtpSubcontracts(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('btp_contracts')
    .select('id, site_id, title, contractor, amount, paid_amount, signed_date, end_date, status, btp_sites(name)')
    .eq('organization_id', orgId)
    .eq('contract_type', 'subcontract')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const assigned = await getMyAssignedBtpSiteIds();
  return (data ?? []).filter((r) => assigned === null || assigned.includes(r.site_id as string));
}

export async function getBtpPersonnelForLabor(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('btp_personnel')
    .select('id, role, daily_rate, site_id, is_active, core_persons(full_name), btp_sites(name)')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
