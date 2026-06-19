'use server';

import { createClient } from '@/lib/supabase/server';

export async function getOrganizationKonaScore(orgId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('konascore_snapshots')
    .select('*')
    .eq('organization_id', orgId)
    .order('calculated_at', { ascending: false })
    .limit(1)
    .single();
  return data;
}

export async function getSchoolDashboardKpis(orgId: string) {
  const supabase = await createClient();

  const [students, enrollments, payments, teachers] = await Promise.all([
    supabase.from('school_students').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
    supabase.from('school_enrollments').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'pending'),
    supabase.from('school_payments').select('amount, status').eq('organization_id', orgId),
    supabase.from('school_teachers').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('is_active', true),
  ]);

  const paymentRows = payments.data ?? [];
  const totalReceived = paymentRows.filter((p) => p.status === 'paid').reduce((s, p) => s + Number(p.amount), 0);
  const pendingCount = paymentRows.filter((p) => p.status === 'pending').length;

  return {
    totalStudents: students.count ?? 0,
    pendingEnrollments: enrollments.count ?? 0,
    totalReceived,
    pendingPayments: pendingCount,
    totalTeachers: teachers.count ?? 0,
  };
}

export async function getNgoDashboardKpis(orgId: string) {
  const supabase = await createClient();

  const [projects, beneficiaries, surveys] = await Promise.all([
    supabase.from('ngo_projects').select('budget, spent, progress_pct, status').eq('organization_id', orgId),
    supabase.from('ngo_beneficiaries').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
    supabase.from('ngo_survey_responses').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
  ]);

  const projectRows = projects.data ?? [];
  const totalBudget = projectRows.reduce((s, p) => s + Number(p.budget ?? 0), 0);
  const totalSpent = projectRows.reduce((s, p) => s + Number(p.spent ?? 0), 0);
  const activeProjects = projectRows.filter((p) => p.status === 'active').length;

  return {
    totalProjects: projectRows.length,
    activeProjects,
    totalBeneficiaries: beneficiaries.count ?? 0,
    totalBudget,
    totalSpent,
    budgetRemaining: totalBudget - totalSpent,
    surveyResponses: surveys.count ?? 0,
  };
}

export async function getBtpDashboardKpis(orgId: string) {
  const supabase = await createClient();
  const fuelSince = new Date();
  fuelSince.setMonth(fuelSince.getMonth() - 13);
  const fuelSinceIso = fuelSince.toISOString().slice(0, 10);

  const [sites, fuel, stockAlerts, personnel] = await Promise.all([
    supabase.from('btp_sites').select('physical_progress, financial_progress, delay_days, status').eq('organization_id', orgId),
    supabase
      .from('btp_fuel_logs')
      .select('liters, is_anomaly')
      .eq('organization_id', orgId)
      .gte('logged_at', `${fuelSinceIso}T00:00:00`),
    supabase
      .from('btp_stock')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('alert_level', 'critical'),
    supabase.from('btp_personnel').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('is_active', true),
  ]);

  const siteRows = sites.data ?? [];
  const fuelRows = fuel.data ?? [];

  return {
    totalSites: siteRows.length,
    avgPhysicalProgress: siteRows.length ? siteRows.reduce((s, x) => s + Number(x.physical_progress), 0) / siteRows.length : 0,
    avgFinancialProgress: siteRows.length ? siteRows.reduce((s, x) => s + Number(x.financial_progress), 0) / siteRows.length : 0,
    totalFuelLiters: fuelRows.reduce((s, f) => s + Number(f.liters), 0),
    fuelAnomalies: fuelRows.filter((f) => f.is_anomaly).length,
    criticalStock: stockAlerts.count ?? 0,
    totalPersonnel: personnel.count ?? 0,
    delayedSites: siteRows.filter((s) => (s.delay_days ?? 0) > 0).length,
  };
}

export async function getPmeDashboardKpis(orgId: string) {
  const supabase = await createClient();

  const [sales, expenses, products, customers] = await Promise.all([
    supabase.from('pme_sales').select('total, payment_status').eq('organization_id', orgId),
    supabase.from('pme_expenses').select('amount').eq('organization_id', orgId),
    supabase.from('pme_products').select('stock_quantity, min_stock').eq('organization_id', orgId),
    supabase.from('pme_customers').select('balance').eq('organization_id', orgId),
  ]);

  const salesRows = sales.data ?? [];
  const expenseRows = expenses.data ?? [];
  const productRows = products.data ?? [];
  const customerRows = customers.data ?? [];

  const revenue = salesRows.reduce((s, x) => s + Number(x.total), 0);
  const totalExpenses = expenseRows.reduce((s, x) => s + Number(x.amount), 0);
  const receivables = customerRows.reduce((s, c) => s + Number(c.balance), 0);
  const lowStock = productRows.filter((p) => Number(p.stock_quantity) <= Number(p.min_stock)).length;

  return {
    revenue,
    totalExpenses,
    profit: revenue - totalExpenses,
    receivables,
    totalProducts: productRows.length,
    lowStockItems: lowStock,
    totalSales: salesRows.length,
  };
}

export async function getAuditLogs(orgId: string, limit = 20) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('audit_logs')
    .select('*, profiles(full_name)')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}
