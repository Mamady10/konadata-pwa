'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireOrgId } from '@/lib/actions/org';
import { getPmeDashboardKpis } from '@/lib/actions/data';
import { paymentStatusLabel } from '@/lib/sector/status-labels';

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
