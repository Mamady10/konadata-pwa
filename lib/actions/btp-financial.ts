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

const FINANCE_PATHS = [
  '/btp/finances',
  '/btp/bons',
  '/btp/personnel',
  '/btp/carburant',
  '/btp/chantiers',
  '/btp/rapports',
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

  const [siteRes, fuelRes, notesRes, laborRes, expensesRes] = await Promise.all([
    supabase
      .from('btp_sites')
      .select('budget, spent, budget_breakdown')
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
      .select('total_amount, delivery_date')
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
  ]);

  const site = siteRes.data;
  const budget = Number(site?.budget ?? 0);
  const openingSpent = Number(site?.spent ?? 0);
  const breakdown = parseBudgetBreakdown(site?.budget_breakdown);

  const fuelCosts = (fuelRes.data ?? []).reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const deliveryAmounts = (notesRes.data ?? [])
    .filter((n) => {
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

  const totals = computeSiteFinancialTotals({
    budget,
    openingSpent,
    fuelCosts,
    deliveryAmounts,
    laborEntryAmounts,
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

export async function createBtpDeliveryNote(formData: FormData): Promise<{ success: true } | { error: string }> {
  const orgId = await requireOrgId();
  const supabase = await createClient();

  const siteId = (formData.get('site_id') as string)?.trim();
  const reference = (formData.get('reference') as string)?.trim();
  const amount = Number(formData.get('total_amount') || 0);
  if (!siteId) return { error: 'Chantier requis.' };
  if (!reference) return { error: 'Référence du bon requise.' };
  if (amount <= 0) return { error: 'Montant invalide.' };

  const access = await assertSiteAccess(siteId);
  if ('error' in access) return access;

  const deliveryDate = (formData.get('delivery_date') as string)?.trim() || new Date().toISOString().slice(0, 10);

  const { error } = await supabase.from('btp_delivery_notes').insert({
    organization_id: orgId,
    site_id: siteId,
    reference,
    supplier: (formData.get('supplier') as string)?.trim() || null,
    total_amount: amount,
    delivery_date: deliveryDate,
    items: [],
  });
  if (error) return { error: error.message };

  await syncBtpSiteSpent(orgId, siteId);
  revalidateFinancialPaths();
  return { success: true };
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

export async function getBtpFinancialDashboard(orgId: string): Promise<BtpFinancialDashboardRow[]> {
  const supabase = await createClient();
  const { data: sites } = await supabase
    .from('btp_sites')
    .select('id, name, budget, spent, financial_progress')
    .eq('organization_id', orgId)
    .order('name');

  const assigned = await getMyAssignedBtpSiteIds();
  const filtered = (sites ?? []).filter((s) => assigned === null || assigned.includes(s.id as string));

  const rows: BtpFinancialDashboardRow[] = [];
  for (const s of filtered) {
    const { totals } = await fetchSiteFinancialData(orgId, s.id as string);
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
    });
  }
  return rows;
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
