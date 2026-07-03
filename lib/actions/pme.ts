'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireOrgId } from '@/lib/actions/org';
import { getPmeDashboardKpis } from '@/lib/actions/data';
import { paymentStatusLabel } from '@/lib/sector/status-labels';
import { getMyAssignedBoutiqueIds } from '@/lib/actions/assignments';
import { getSession } from '@/lib/actions/auth';
import { isPmeDirector } from '@/lib/pme/pme-access';

export interface PmeBoutiqueRow {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  manager: string | null;
  is_active: boolean;
}

export async function getPmeBoutiques(orgId: string): Promise<PmeBoutiqueRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pme_boutiques')
    .select('id, name, address, phone, manager, is_active')
    .eq('organization_id', orgId)
    .order('name');
  if (error) throw error;
  const rows = (data ?? []) as PmeBoutiqueRow[];

  // Un directeur (dont comptable) voit toutes les boutiques.
  // Un gérant (pme_staff) ne voit que les boutiques qui lui sont assignées.
  const session = await getSession().catch(() => null);
  if (isPmeDirector(session?.profile?.role)) return rows;

  const assigned = await getMyAssignedBoutiqueIds().catch(() => null);
  if (assigned === null) return rows;
  const allowed = new Set(assigned);
  return rows.filter((b) => allowed.has(b.id));
}

export async function createPmeBoutique(formData: FormData) {
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const name = (formData.get('name') as string)?.trim();
  if (!name) return { error: 'Nom de la boutique requis.' };

  const { error } = await supabase.from('pme_boutiques').insert({
    organization_id: orgId,
    name,
    address: (formData.get('address') as string)?.trim() || null,
    phone: (formData.get('phone') as string)?.trim() || null,
    manager: (formData.get('manager') as string)?.trim() || null,
  });
  if (error) return { error: error.message };
  revalidatePath('/pme/boutiques');
  revalidatePath('/pme/rapports');
  return { success: true };
}

export async function updatePmeBoutique(formData: FormData) {
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const id = (formData.get('id') as string)?.trim();
  const name = (formData.get('name') as string)?.trim();
  if (!id) return { error: 'Boutique introuvable.' };
  if (!name) return { error: 'Nom de la boutique requis.' };

  const isActiveRaw = formData.get('is_active');
  const patch: Record<string, unknown> = {
    name,
    address: (formData.get('address') as string)?.trim() || null,
    phone: (formData.get('phone') as string)?.trim() || null,
    manager: (formData.get('manager') as string)?.trim() || null,
  };
  if (isActiveRaw !== null) {
    patch.is_active = isActiveRaw === 'true' || isActiveRaw === 'on' || isActiveRaw === '1';
  }

  const { error } = await supabase
    .from('pme_boutiques')
    .update(patch)
    .eq('id', id)
    .eq('organization_id', orgId);
  if (error) return { error: error.message };
  revalidatePath('/pme/boutiques');
  revalidatePath('/pme/rapports');
  return { success: true };
}

export async function setPmeBoutiqueActive(id: string, isActive: boolean) {
  const orgId = await requireOrgId();
  const supabase = await createClient();
  if (!id) return { error: 'Boutique introuvable.' };
  const { error } = await supabase
    .from('pme_boutiques')
    .update({ is_active: isActive })
    .eq('id', id)
    .eq('organization_id', orgId);
  if (error) return { error: error.message };
  revalidatePath('/pme/boutiques');
  revalidatePath('/pme/rapports');
  return { success: true };
}

export async function getPmeCustomers(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pme_customers')
    .select('id, name, phone, email, balance, is_active, created_at')
    .eq('organization_id', orgId)
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function getPmeSuppliers(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pme_suppliers')
    .select('id, name, phone, email, balance, is_active, created_at')
    .eq('organization_id', orgId)
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function getPmeProducts(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pme_products')
    .select('id, name, sku, unit, unit_price, stock_quantity, min_stock, is_active')
    .eq('organization_id', orgId)
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function getPmeSales(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pme_sales')
    .select('id, reference, total, payment_status, sold_at, pme_customers(name)')
    .eq('organization_id', orgId)
    .order('sold_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getPmePurchases(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pme_purchases')
    .select('id, reference, total, payment_status, purchased_at, pme_suppliers(name)')
    .eq('organization_id', orgId)
    .order('purchased_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getPmeExpenses(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pme_expenses')
    .select('id, category, description, amount, expense_date')
    .eq('organization_id', orgId)
    .order('expense_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getPmeDashboard(orgId: string) {
  const supabase = await createClient();
  const kpis = await getPmeDashboardKpis(orgId);

  const [salesRes, expensesRes, productsRes, customersRes] = await Promise.all([
    supabase
      .from('pme_sales')
      .select('id, reference, total, payment_status, sold_at, pme_customers(name)')
      .eq('organization_id', orgId)
      .order('sold_at', { ascending: false })
      .limit(5),
    supabase
      .from('pme_expenses')
      .select('id, category, description, amount, expense_date')
      .eq('organization_id', orgId)
      .order('expense_date', { ascending: false })
      .limit(5),
    supabase
      .from('pme_products')
      .select('id, name, stock_quantity, min_stock')
      .eq('organization_id', orgId)
      .order('stock_quantity'),
    supabase
      .from('pme_customers')
      .select('id, name, balance')
      .eq('organization_id', orgId)
      .gt('balance', 0)
      .order('balance', { ascending: false })
      .limit(5),
  ]);

  const sales = salesRes.data ?? [];
  const expenses = expensesRes.data ?? [];
  const products = productsRes.data ?? [];
  const debtors = customersRes.data ?? [];

  const lowStock = products.filter(
    (p) => Number(p.stock_quantity) <= Number(p.min_stock)
  );
  const pendingSales = sales.filter((s) => s.payment_status === 'pending').length;

  return {
    kpis,
    pendingSales,
    recentSales: sales.map((s) => {
      const customer = s.pme_customers as { name?: string } | null;
      return {
        id: s.id,
        reference: s.reference,
        client: customer?.name ?? '—',
        total: Number(s.total),
        status: paymentStatusLabel(s.payment_status),
        date: new Date(s.sold_at as string).toLocaleDateString('fr-FR'),
      };
    }),
    recentExpenses: expenses.map((e) => ({
      id: e.id,
      category: e.category,
      description: e.description ?? e.category,
      amount: Number(e.amount),
      date: e.expense_date
        ? new Date(e.expense_date).toLocaleDateString('fr-FR')
        : '—',
    })),
    lowStock: lowStock.map((p) => ({
      id: p.id,
      name: p.name,
      stock: Number(p.stock_quantity),
      min: Number(p.min_stock),
    })),
    receivables: debtors.map((c) => ({
      id: c.id,
      name: c.name,
      balance: Number(c.balance),
    })),
  };
}

function nextPmeReference(prefix: string): string {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `${prefix}-${stamp}-${rand}`;
}

export async function createPmeSale(formData: FormData) {
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const reference = (formData.get('reference') as string)?.trim() || nextPmeReference('VTE');
  const total = Number(formData.get('total') || 0);
  if (total <= 0) return { error: 'Montant invalide.' };

  const { error } = await supabase.from('pme_sales').insert({
    organization_id: orgId,
    customer_id: (formData.get('customer_id') as string) || null,
    boutique_id: (formData.get('boutique_id') as string) || null,
    reference,
    total,
    subtotal: total,
    payment_status: (formData.get('payment_status') as string) || 'pending',
    notes: (formData.get('notes') as string)?.trim() || null,
  });
  if (error) return { error: error.message };
  revalidatePath('/pme/ventes');
  revalidatePath('/pme');
  return { success: true };
}

export async function createPmePurchase(formData: FormData) {
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const reference = (formData.get('reference') as string)?.trim() || nextPmeReference('ACH');
  const total = Number(formData.get('total') || 0);
  if (total <= 0) return { error: 'Montant invalide.' };

  const { error } = await supabase.from('pme_purchases').insert({
    organization_id: orgId,
    supplier_id: (formData.get('supplier_id') as string) || null,
    boutique_id: (formData.get('boutique_id') as string) || null,
    reference,
    total,
    payment_status: (formData.get('payment_status') as string) || 'pending',
    notes: (formData.get('notes') as string)?.trim() || null,
  });
  if (error) return { error: error.message };
  revalidatePath('/pme/achats');
  revalidatePath('/pme');
  return { success: true };
}

export async function createPmeExpense(formData: FormData) {
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const amount = Number(formData.get('amount') || 0);
  const category = (formData.get('category') as string)?.trim() || 'general';
  if (amount <= 0) return { error: 'Montant invalide.' };

  const { error } = await supabase.from('pme_expenses').insert({
    organization_id: orgId,
    category,
    boutique_id: (formData.get('boutique_id') as string) || null,
    description: (formData.get('description') as string)?.trim() || null,
    amount,
    expense_date: (formData.get('expense_date') as string)?.trim() || new Date().toISOString().slice(0, 10),
  });
  if (error) return { error: error.message };
  revalidatePath('/pme/depenses');
  revalidatePath('/pme');
  return { success: true };
}

export async function createPmeProduct(formData: FormData) {
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const name = (formData.get('name') as string)?.trim();
  if (!name) return { error: 'Nom requis.' };

  const { error } = await supabase.from('pme_products').insert({
    organization_id: orgId,
    name,
    boutique_id: (formData.get('boutique_id') as string) || null,
    sku: (formData.get('sku') as string)?.trim() || null,
    unit: (formData.get('unit') as string)?.trim() || 'unité',
    unit_price: Number(formData.get('unit_price') || 0),
    stock_quantity: Number(formData.get('stock_quantity') || 0),
    min_stock: Number(formData.get('min_stock') || 0),
  });
  if (error) return { error: error.message };
  revalidatePath('/pme/stocks');
  revalidatePath('/pme');
  return { success: true };
}

export async function createPmeCustomer(formData: FormData) {
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const name = (formData.get('name') as string)?.trim();
  if (!name) return { error: 'Nom requis.' };

  const { error } = await supabase.from('pme_customers').insert({
    organization_id: orgId,
    name,
    phone: (formData.get('phone') as string)?.trim() || null,
    email: (formData.get('email') as string)?.trim() || null,
  });
  if (error) return { error: error.message };
  revalidatePath('/pme/clients');
  return { success: true };
}

export async function createPmeSupplier(formData: FormData) {
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const name = (formData.get('name') as string)?.trim();
  if (!name) return { error: 'Nom requis.' };

  const { error } = await supabase.from('pme_suppliers').insert({
    organization_id: orgId,
    name,
    phone: (formData.get('phone') as string)?.trim() || null,
    email: (formData.get('email') as string)?.trim() || null,
  });
  if (error) return { error: error.message };
  revalidatePath('/pme/fournisseurs');
  return { success: true };
}

// ─── Crédits / Dettes clients ────────────────────────────────

export interface PmeDebtRow {
  id: string;
  debtor_name: string;
  description: string | null;
  original_amount: number;
  amount_paid: number;
  remaining: number;
  status: 'open' | 'partial' | 'paid';
  due_date: string | null;
}

export async function getPmeDebts(orgId: string): Promise<PmeDebtRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pme_debts')
    .select(
      'id, debtor_name, description, original_amount, amount_paid, status, due_date, created_at, pme_customers(name)'
    )
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  const statusRank: Record<string, number> = { open: 0, partial: 1, paid: 2 };
  return (data ?? [])
    .map((d) => {
      const original = Number(d.original_amount ?? 0);
      const paid = Number(d.amount_paid ?? 0);
      const customer = d.pme_customers as { name?: string } | null;
      return {
        id: d.id as string,
        debtor_name: (d.debtor_name as string) || customer?.name || 'Client',
        description: (d.description as string) ?? null,
        original_amount: original,
        amount_paid: paid,
        remaining: Math.max(0, original - paid),
        status: (d.status as PmeDebtRow['status']) ?? 'open',
        due_date: (d.due_date as string) ?? null,
      };
    })
    .sort(
      (a, b) => (statusRank[a.status] ?? 3) - (statusRank[b.status] ?? 3) || b.remaining - a.remaining
    );
}

export async function createPmeDebt(formData: FormData) {
  const orgId = await requireOrgId();
  const supabase = await createClient();

  const originalAmount = Number(formData.get('original_amount') || 0);
  if (originalAmount <= 0) return { error: 'Montant total dû invalide.' };

  const customerId = (formData.get('customer_id') as string)?.trim() || null;
  let debtorName = (formData.get('debtor_name') as string)?.trim() || '';

  if (!debtorName && customerId) {
    const { data: cust } = await supabase
      .from('pme_customers')
      .select('name')
      .eq('id', customerId)
      .eq('organization_id', orgId)
      .maybeSingle();
    debtorName = (cust?.name as string) || '';
  }
  if (!debtorName) return { error: 'Indiquez un client ou un nom de débiteur.' };

  const incurredAt =
    (formData.get('incurred_at') as string)?.trim() || new Date().toISOString().slice(0, 10);
  const initialPayment = Math.max(0, Number(formData.get('initial_payment') || 0));

  const { data: debt, error } = await supabase
    .from('pme_debts')
    .insert({
      organization_id: orgId,
      customer_id: customerId,
      debtor_name: debtorName,
      description: (formData.get('description') as string)?.trim() || null,
      original_amount: originalAmount,
      due_date: (formData.get('due_date') as string)?.trim() || null,
      incurred_at: incurredAt,
    })
    .select('id')
    .single();

  if (error) return { error: error.message };

  if (initialPayment > 0 && debt?.id) {
    const capped = Math.min(initialPayment, originalAmount);
    const { error: payErr } = await supabase.from('pme_debt_payments').insert({
      organization_id: orgId,
      debt_id: debt.id as string,
      amount: capped,
      paid_at: incurredAt,
      note: 'Acompte initial',
    });
    if (payErr) return { error: payErr.message };
  }

  revalidatePath('/pme/dettes');
  revalidatePath('/pme');
  return { success: true };
}

export async function addPmeDebtPayment(formData: FormData) {
  const orgId = await requireOrgId();
  const supabase = await createClient();

  const debtId = (formData.get('debt_id') as string)?.trim();
  if (!debtId) return { error: 'Dette introuvable.' };
  const amount = Number(formData.get('amount') || 0);
  if (amount <= 0) return { error: 'Montant reçu invalide.' };

  const { data: debt } = await supabase
    .from('pme_debts')
    .select('original_amount, amount_paid')
    .eq('id', debtId)
    .eq('organization_id', orgId)
    .maybeSingle();
  if (!debt) return { error: 'Dette introuvable.' };

  const remaining = Math.max(0, Number(debt.original_amount ?? 0) - Number(debt.amount_paid ?? 0));
  if (amount > remaining) {
    return { error: `Le montant dépasse le reste dû (${remaining}).` };
  }

  const { error } = await supabase.from('pme_debt_payments').insert({
    organization_id: orgId,
    debt_id: debtId,
    amount,
    paid_at: (formData.get('paid_at') as string)?.trim() || new Date().toISOString().slice(0, 10),
    note: (formData.get('note') as string)?.trim() || null,
  });
  if (error) return { error: error.message };

  revalidatePath('/pme/dettes');
  revalidatePath('/pme');
  return { success: true };
}
