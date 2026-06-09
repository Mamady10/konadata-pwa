'use server';

import { createClient } from '@/lib/supabase/server';
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
