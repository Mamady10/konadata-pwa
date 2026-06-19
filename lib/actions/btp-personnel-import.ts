'use server';

import 'server-only';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireOrgId } from '@/lib/actions/org';
import { canManageAssignments } from '@/lib/actions/assignments';
import {
  parseBtpPersonnelImportCsv,
  parseBtpPersonnelImportTable,
  type BtpPersonnelImportParseResult,
  type BtpPersonnelImportRow,
} from '@/lib/btp/personnel-import';
import { syncBtpSiteSpent } from '@/lib/actions/btp-financial';

const PERSONNEL_PATHS = ['/btp/personnel', '/btp/finances', '/btp', '/btp/rapports'];

function revalidatePersonnelPaths() {
  for (const p of PERSONNEL_PATHS) revalidatePath(p);
}

async function requireDirector(): Promise<{ error: string } | { ok: true }> {
  const canManage = await canManageAssignments();
  if (!canManage) return { error: 'Réservé aux directeurs.' };
  return { ok: true };
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function parseBtpPersonnelImportFile(
  formData: FormData
): Promise<BtpPersonnelImportParseResult | { error: string }> {
  const access = await requireDirector();
  if ('error' in access) return access;

  const file = formData.get('file') as File | null;
  if (!file?.size) return { error: 'Fichier requis.' };

  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();
  const mime = (file.type ?? '').toLowerCase();

  if (name.endsWith('.csv') || mime === 'text/csv') {
    return parseBtpPersonnelImportCsv(buffer.toString('utf8'));
  }

  if (/\.(xlsx|xls)$/.test(name) || mime.includes('spreadsheet') || mime.includes('excel')) {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return { rows: [], warnings: ['Classeur Excel vide.'], headers: [] };
    const sheet = workbook.Sheets[sheetName];
    const table = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      raw: false,
    }) as string[][];
    return parseBtpPersonnelImportTable(table);
  }

  return { error: 'Format non supporté. Utilisez .xlsx, .xls ou .csv.' };
}

export async function importBtpPersonnelFromList(params: {
  rows: BtpPersonnelImportRow[];
  defaultSiteId?: string | null;
  deactivateMissing?: boolean;
  fileName?: string;
}): Promise<
  | { success: true; imported: number; updated: number; deactivated: number }
  | { error: string }
> {
  const access = await requireDirector();
  if ('error' in access) return access;

  const orgId = await requireOrgId();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!params.rows.length) return { error: 'Liste vide.' };

  const defaultSiteId = params.defaultSiteId?.trim() || null;
  const payrollStart = new Date().toISOString().slice(0, 10);
  const importedNames = new Set(params.rows.map((r) => normalizeName(r.fullName)));

  const { data: existingRows } = await supabase
    .from('btp_personnel')
    .select('id, person_id, role, site_id, payroll_source, core_persons(full_name)')
    .eq('organization_id', orgId);

  const byName = new Map<string, { id: string; personId: string | null }>();
  for (const row of existingRows ?? []) {
    const person = row.core_persons as { full_name?: string } | null;
    const name = person?.full_name ?? row.role ?? '';
    if (name) byName.set(normalizeName(name), { id: row.id as string, personId: row.person_id as string | null });
  }

  let imported = 0;
  let updated = 0;
  const touchedIds = new Set<string>();

  for (const line of params.rows) {
    const key = normalizeName(line.fullName);
    const existing = byName.get(key);

    if (existing?.personId) {
      await supabase
        .from('core_persons')
        .update({ full_name: line.fullName })
        .eq('id', existing.personId);

      const { error } = await supabase
        .from('btp_personnel')
        .update({
          role: line.role ?? 'Employé direct',
          monthly_salary: line.monthlySalary,
          daily_rate: Math.round(line.monthlySalary / 22),
          payroll_source: 'import',
          payroll_start_date: payrollStart,
          site_id: defaultSiteId,
          is_active: true,
        })
        .eq('id', existing.id);
      if (error) return { error: error.message };
      touchedIds.add(existing.id);
      updated++;
      continue;
    }

    const { data: person, error: personErr } = await supabase
      .from('core_persons')
      .insert({
        organization_id: orgId,
        kind: 'worker',
        full_name: line.fullName,
      })
      .select('id')
      .single();
    if (personErr) return { error: personErr.message };

    const { data: personnel, error: persErr } = await supabase
      .from('btp_personnel')
      .insert({
        organization_id: orgId,
        person_id: person.id,
        site_id: defaultSiteId,
        role: line.role ?? 'Employé direct',
        monthly_salary: line.monthlySalary,
        daily_rate: Math.round(line.monthlySalary / 22),
        payroll_source: 'import',
        payroll_start_date: payrollStart,
        is_active: true,
      })
      .select('id')
      .single();
    if (persErr) return { error: persErr.message };
    if (personnel?.id) touchedIds.add(personnel.id as string);
    byName.set(key, { id: personnel!.id as string, personId: person.id as string });
    imported++;
  }

  let deactivated = 0;
  if (params.deactivateMissing) {
    const toDeactivate = (existingRows ?? []).filter((row) => {
      const person = row.core_persons as { full_name?: string } | null;
      const name = person?.full_name ?? row.role ?? '';
      if (!name) return false;
      const source = (row.payroll_source as string) ?? 'manual';
      return source === 'import' && !importedNames.has(normalizeName(name));
    });

    for (const row of toDeactivate) {
      const { error } = await supabase
        .from('btp_personnel')
        .update({ is_active: false })
        .eq('id', row.id);
      if (error) return { error: error.message };
      deactivated++;
    }
  }

  await supabase.from('btp_personnel_imports').insert({
    organization_id: orgId,
    file_name: params.fileName ?? null,
    rows_imported: imported + updated,
    rows_deactivated: deactivated,
    default_site_id: defaultSiteId,
    imported_by: user?.id ?? null,
  });

  const siteIds = new Set<string>();
  if (defaultSiteId) siteIds.add(defaultSiteId);
  for (const row of existingRows ?? []) {
    if (row.site_id) siteIds.add(row.site_id as string);
  }
  for (const siteId of siteIds) {
    await syncBtpSiteSpent(orgId, siteId);
  }

  revalidatePersonnelPaths();
  return { success: true, imported, updated, deactivated };
}

export async function deactivateBtpPersonnel(
  personnelId: string
): Promise<{ success: true } | { error: string }> {
  const access = await requireDirector();
  if ('error' in access) return access;

  const orgId = await requireOrgId();
  const supabase = await createClient();

  const { data: row } = await supabase
    .from('btp_personnel')
    .select('id, site_id')
    .eq('id', personnelId)
    .eq('organization_id', orgId)
    .single();
  if (!row) return { error: 'Collaborateur introuvable.' };

  const { error } = await supabase
    .from('btp_personnel')
    .update({ is_active: false })
    .eq('id', personnelId);
  if (error) return { error: error.message };

  if (row.site_id) await syncBtpSiteSpent(orgId, row.site_id as string);
  revalidatePersonnelPaths();
  return { success: true };
}

export async function reactivateBtpPersonnel(
  personnelId: string
): Promise<{ success: true } | { error: string }> {
  const access = await requireDirector();
  if ('error' in access) return access;

  const orgId = await requireOrgId();
  const supabase = await createClient();

  const { data: row } = await supabase
    .from('btp_personnel')
    .select('id, site_id')
    .eq('id', personnelId)
    .eq('organization_id', orgId)
    .single();
  if (!row) return { error: 'Collaborateur introuvable.' };

  const { error } = await supabase
    .from('btp_personnel')
    .update({ is_active: true })
    .eq('id', personnelId);
  if (error) return { error: error.message };

  if (row.site_id) await syncBtpSiteSpent(orgId, row.site_id as string);
  revalidatePersonnelPaths();
  return { success: true };
}
