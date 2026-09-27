'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireOrgId } from '@/lib/actions/org';
import { canManageAssignments } from '@/lib/actions/assignments';
import { loadOrgLogoForReport } from '@/lib/btp/weekly-report-media';
import type { WeeklyReportImage } from '@/lib/btp/weekly-report-export-types';
import {
  computeQuoteTotals,
  defaultQuoteLots,
  duplicateLot,
  parseQuoteLots,
  QUOTE_SECTIONS,
  type BtpQuote,
  type BtpQuoteListItem,
  type PriceCatalogItem,
  type QuoteHeader,
  type QuoteLot,
  type QuoteSection,
  type QuoteStatus,
} from '@/lib/btp/quotes/quote-types';

type ActionResult<T = { success: true }> = T | { error: string };

const QUOTE_STATUSES: QuoteStatus[] = ['draft', 'sent', 'accepted', 'refused', 'cancelled'];
const EDITABLE_STATUSES: QuoteStatus[] = ['draft', 'sent'];
const MIGRATION_HINT =
  'Base de données à mettre à jour (migration 121 — devis BTP). Contactez le support KonaData.';

function isMissingTable(message: string | undefined): boolean {
  return Boolean(message && /btp_quote|btp_price_catalog|can_manage_btp_quotes|does not exist|schema cache/i.test(message));
}

export interface BtpQuoteAccessInfo {
  allowed: boolean;
  isDirector: boolean;
  migrationMissing: boolean;
}

export async function getBtpQuoteAccess(): Promise<BtpQuoteAccessInfo> {
  const supabase = await createClient();
  const [{ data, error }, isDirector] = await Promise.all([
    supabase.rpc('can_manage_btp_quotes'),
    canManageAssignments(),
  ]);
  if (error) {
    return { allowed: false, isDirector, migrationMissing: isMissingTable(error.message) };
  }
  return { allowed: Boolean(data), isDirector, migrationMissing: false };
}

async function requireQuoteAccess(): Promise<{ orgId: string; userId: string | null } | { error: string }> {
  const access = await getBtpQuoteAccess();
  if (access.migrationMissing) return { error: MIGRATION_HINT };
  if (!access.allowed) return { error: "Accès aux devis non autorisé. Demandez l'accès au directeur." };
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { orgId, userId: user?.id ?? null };
}

function mapQuoteRow(row: Record<string, unknown>): BtpQuote {
  return {
    id: row.id as string,
    number: row.number as string,
    version: Number(row.version ?? 1),
    rootQuoteId: (row.root_quote_id as string) ?? null,
    status: (row.status as QuoteStatus) ?? 'draft',
    title: (row.title as string) ?? '',
    subtitle: (row.subtitle as string) ?? '',
    clientName: (row.client_name as string) ?? '',
    clientContact: (row.client_contact as string) ?? '',
    clientAddress: (row.client_address as string) ?? '',
    location: (row.location as string) ?? '',
    quoteDate: String(row.quote_date ?? '').slice(0, 10),
    validityDays: Number(row.validity_days ?? 30),
    notes: (row.notes as string) ?? '',
    vatEnabled: Boolean(row.vat_enabled),
    vatRate: Number(row.vat_rate ?? 18),
    lots: parseQuoteLots(row.lots),
    totalHt: Number(row.total_ht ?? 0),
    totalTtc: Number(row.total_ttc ?? 0),
    siteId: (row.site_id as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function revalidateQuotes(quoteId?: string) {
  revalidatePath('/btp/devis');
  if (quoteId) revalidatePath(`/btp/devis/${quoteId}`);
}

async function nextQuoteNumber(orgId: string): Promise<string> {
  const supabase = await createClient();
  const year = new Date().getFullYear();
  const prefix = `DEV-${year}-`;
  const { data } = await supabase
    .from('btp_quotes')
    .select('number')
    .eq('organization_id', orgId)
    .like('number', `${prefix}%`);
  const max = (data ?? []).reduce((m, r) => {
    const seq = Number(String(r.number).slice(prefix.length));
    return Number.isFinite(seq) && seq > m ? seq : m;
  }, 0);
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

export async function listBtpQuotes(): Promise<ActionResult<{ quotes: BtpQuoteListItem[] }>> {
  const ctx = await requireQuoteAccess();
  if ('error' in ctx) return ctx;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('btp_quotes')
    .select('id, number, version, title, client_name, status, quote_date, total_ht, total_ttc, vat_enabled, lots, updated_at')
    .eq('organization_id', ctx.orgId)
    .order('updated_at', { ascending: false })
    .limit(300);
  if (error) return { error: isMissingTable(error.message) ? MIGRATION_HINT : error.message };
  return {
    quotes: (data ?? []).map((r) => ({
      id: r.id as string,
      number: r.number as string,
      version: Number(r.version ?? 1),
      title: r.title as string,
      clientName: (r.client_name as string) ?? null,
      status: r.status as QuoteStatus,
      quoteDate: String(r.quote_date ?? '').slice(0, 10),
      totalHt: Number(r.total_ht ?? 0),
      totalTtc: Number(r.total_ttc ?? 0),
      vatEnabled: Boolean(r.vat_enabled),
      lotCount: Array.isArray(r.lots) ? r.lots.length : 0,
      updatedAt: r.updated_at as string,
    })),
  };
}

export async function getBtpQuote(quoteId: string): Promise<ActionResult<{ quote: BtpQuote }>> {
  const ctx = await requireQuoteAccess();
  if ('error' in ctx) return ctx;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('btp_quotes')
    .select('*')
    .eq('id', quoteId)
    .eq('organization_id', ctx.orgId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: 'Devis introuvable.' };
  return { quote: mapQuoteRow(data) };
}

export async function createBtpQuote(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireQuoteAccess();
  if ('error' in ctx) return ctx;
  const title = (formData.get('title') as string)?.trim();
  if (!title) return { error: 'Intitulé du projet requis.' };
  const lots = formData.get('structure') === 'empty' ? [] : defaultQuoteLots();

  const supabase = await createClient();
  const number = await nextQuoteNumber(ctx.orgId);
  const { data, error } = await supabase
    .from('btp_quotes')
    .insert({
      organization_id: ctx.orgId,
      number,
      title,
      subtitle: (formData.get('subtitle') as string)?.trim() || null,
      client_name: (formData.get('client_name') as string)?.trim() || null,
      location: (formData.get('location') as string)?.trim() || null,
      lots,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .select('id')
    .single();
  if (error) return { error: isMissingTable(error.message) ? MIGRATION_HINT : error.message };
  revalidateQuotes();
  return { id: data.id as string };
}

export interface SaveBtpQuoteInput {
  id: string;
  header: QuoteHeader;
  lots: QuoteLot[];
}

export async function saveBtpQuote(
  input: SaveBtpQuoteInput
): Promise<ActionResult<{ quote: BtpQuote }>> {
  const ctx = await requireQuoteAccess();
  if ('error' in ctx) return ctx;
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('btp_quotes')
    .select('status')
    .eq('id', input.id)
    .eq('organization_id', ctx.orgId)
    .maybeSingle();
  if (!existing) return { error: 'Devis introuvable.' };
  if (!EDITABLE_STATUSES.includes(existing.status as QuoteStatus)) {
    return { error: 'Ce devis est clôturé : créez une nouvelle version pour le modifier.' };
  }

  const h = input.header;
  const title = h.title?.trim();
  if (!title) return { error: 'Intitulé du projet requis.' };
  const lots = parseQuoteLots(input.lots);
  const vatRate = Math.min(100, Math.max(0, Number(h.vatRate) || 0));
  const totals = computeQuoteTotals(lots, { vatEnabled: Boolean(h.vatEnabled), vatRate });
  const quoteDate = /^\d{4}-\d{2}-\d{2}$/.test(h.quoteDate) ? h.quoteDate : new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('btp_quotes')
    .update({
      title,
      subtitle: h.subtitle?.trim() || null,
      client_name: h.clientName?.trim() || null,
      client_contact: h.clientContact?.trim() || null,
      client_address: h.clientAddress?.trim() || null,
      location: h.location?.trim() || null,
      quote_date: quoteDate,
      validity_days: Math.max(0, Math.round(Number(h.validityDays) || 0)),
      notes: h.notes?.trim() || null,
      vat_enabled: Boolean(h.vatEnabled),
      vat_rate: vatRate,
      lots,
      total_ht: totals.totalHt,
      total_ttc: totals.totalTtc,
      updated_by: ctx.userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.id)
    .eq('organization_id', ctx.orgId)
    .select('*')
    .single();
  if (error) return { error: error.message };
  revalidateQuotes(input.id);
  return { quote: mapQuoteRow(data) };
}

export async function setBtpQuoteStatus(
  quoteId: string,
  status: QuoteStatus
): Promise<ActionResult> {
  const ctx = await requireQuoteAccess();
  if ('error' in ctx) return ctx;
  if (!QUOTE_STATUSES.includes(status)) return { error: 'Statut invalide.' };
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('btp_quotes')
    .update({
      status,
      updated_by: ctx.userId,
      updated_at: now,
      ...(status === 'sent' ? { sent_at: now } : {}),
      ...(status === 'accepted' ? { accepted_at: now } : {}),
    })
    .eq('id', quoteId)
    .eq('organization_id', ctx.orgId);
  if (error) return { error: error.message };
  revalidateQuotes(quoteId);
  return { success: true };
}

/** Copie d'un devis : nouveau numéro, ou nouvelle version (même numéro, V+1). */
export async function duplicateBtpQuote(
  quoteId: string,
  mode: 'copy' | 'version'
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireQuoteAccess();
  if ('error' in ctx) return ctx;
  const supabase = await createClient();
  const { data: src, error: srcErr } = await supabase
    .from('btp_quotes')
    .select('*')
    .eq('id', quoteId)
    .eq('organization_id', ctx.orgId)
    .maybeSingle();
  if (srcErr || !src) return { error: srcErr?.message ?? 'Devis introuvable.' };

  const rootId = (src.root_quote_id as string) ?? (src.id as string);
  let number: string;
  let version = 1;
  if (mode === 'version') {
    number = src.number as string;
    const { data: versions } = await supabase
      .from('btp_quotes')
      .select('version')
      .eq('organization_id', ctx.orgId)
      .eq('number', number);
    version = (versions ?? []).reduce((m, r) => Math.max(m, Number(r.version ?? 1)), 1) + 1;
  } else {
    number = await nextQuoteNumber(ctx.orgId);
  }

  const lots = parseQuoteLots(src.lots).map((lot) => duplicateLot(lot, lot.title));
  const { data, error } = await supabase
    .from('btp_quotes')
    .insert({
      organization_id: ctx.orgId,
      number,
      version,
      root_quote_id: mode === 'version' ? rootId : null,
      title: mode === 'copy' ? `${src.title} (copie)` : src.title,
      subtitle: src.subtitle,
      client_name: src.client_name,
      client_contact: src.client_contact,
      client_address: src.client_address,
      location: src.location,
      validity_days: src.validity_days,
      vat_enabled: src.vat_enabled,
      vat_rate: src.vat_rate,
      notes: src.notes,
      lots,
      total_ht: src.total_ht,
      total_ttc: src.total_ttc,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .select('id')
    .single();
  if (error) return { error: error.message };
  revalidateQuotes();
  return { id: data.id as string };
}

export async function deleteBtpQuote(quoteId: string): Promise<ActionResult> {
  const isDirector = await canManageAssignments();
  if (!isDirector) return { error: 'Seul le directeur peut supprimer un devis.' };
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const { error } = await supabase
    .from('btp_quotes')
    .delete()
    .eq('id', quoteId)
    .eq('organization_id', orgId);
  if (error) return { error: error.message };
  revalidateQuotes();
  return { success: true };
}

// ─── Catalogue de prix ─────────────────────────────────────────────

function mapCatalogRow(r: Record<string, unknown>): PriceCatalogItem {
  return {
    id: r.id as string,
    designation: r.designation as string,
    unit: (r.unit as string) ?? '',
    unitPrice: Number(r.unit_price ?? 0),
    section: (QUOTE_SECTIONS.includes(r.section as QuoteSection) ? r.section : 'materials') as QuoteSection,
    updatedAt: r.updated_at as string,
  };
}

export async function listBtpPriceCatalog(): Promise<ActionResult<{ items: PriceCatalogItem[] }>> {
  const ctx = await requireQuoteAccess();
  if ('error' in ctx) return ctx;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('btp_price_catalog')
    .select('id, designation, unit, unit_price, section, updated_at')
    .eq('organization_id', ctx.orgId)
    .order('designation')
    .limit(2000);
  if (error) return { error: isMissingTable(error.message) ? MIGRATION_HINT : error.message };
  return { items: (data ?? []).map(mapCatalogRow) };
}

export interface CatalogItemInput {
  id?: string;
  designation: string;
  unit: string;
  unitPrice: number;
  section: QuoteSection;
}

export async function saveBtpPriceCatalogItem(
  input: CatalogItemInput
): Promise<ActionResult<{ item: PriceCatalogItem }>> {
  const ctx = await requireQuoteAccess();
  if ('error' in ctx) return ctx;
  const designation = input.designation?.trim().slice(0, 300);
  if (!designation) return { error: 'Désignation requise.' };
  const row = {
    designation,
    unit: (input.unit ?? '').trim().slice(0, 20),
    unit_price: Math.max(0, Number(input.unitPrice) || 0),
    section: QUOTE_SECTIONS.includes(input.section) ? input.section : 'materials',
    updated_by: ctx.userId,
    updated_at: new Date().toISOString(),
  };
  const supabase = await createClient();
  const query = input.id
    ? supabase
        .from('btp_price_catalog')
        .update(row)
        .eq('id', input.id)
        .eq('organization_id', ctx.orgId)
    : supabase.from('btp_price_catalog').insert({ ...row, organization_id: ctx.orgId });
  const { data, error } = await query.select('id, designation, unit, unit_price, section, updated_at').single();
  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      return { error: 'Cet article existe déjà dans le catalogue (même désignation et unité).' };
    }
    return { error: error.message };
  }
  revalidatePath('/btp/devis');
  return { item: mapCatalogRow(data) };
}

export async function deleteBtpPriceCatalogItem(itemId: string): Promise<ActionResult> {
  const ctx = await requireQuoteAccess();
  if ('error' in ctx) return ctx;
  const supabase = await createClient();
  const { error } = await supabase
    .from('btp_price_catalog')
    .delete()
    .eq('id', itemId)
    .eq('organization_id', ctx.orgId);
  if (error) return { error: error.message };
  revalidatePath('/btp/devis');
  return { success: true };
}

/** Ajoute ou met à jour dans le catalogue les prix des lignes d'un devis. */
export async function syncQuotePricesToCatalog(
  quoteId: string
): Promise<ActionResult<{ added: number; updated: number }>> {
  const ctx = await requireQuoteAccess();
  if ('error' in ctx) return ctx;
  const supabase = await createClient();
  const [{ data: quote }, { data: catalog, error: catErr }] = await Promise.all([
    supabase.from('btp_quotes').select('lots').eq('id', quoteId).eq('organization_id', ctx.orgId).maybeSingle(),
    supabase.from('btp_price_catalog').select('id, designation, unit, unit_price').eq('organization_id', ctx.orgId),
  ]);
  if (catErr) return { error: catErr.message };
  if (!quote) return { error: 'Devis introuvable.' };

  const key = (designation: string, unit: string) =>
    `${designation.trim().toLowerCase()}|${unit.trim().toLowerCase()}`;
  const existing = new Map((catalog ?? []).map((c) => [key(c.designation as string, (c.unit as string) ?? ''), c]));
  const latest = new Map<string, { designation: string; unit: string; unitPrice: number; section: QuoteSection }>();
  for (const lot of parseQuoteLots(quote.lots)) {
    for (const line of lot.lines) {
      if (!line.designation || line.unitPrice <= 0) continue;
      latest.set(key(line.designation, line.unit), {
        designation: line.designation,
        unit: line.unit,
        unitPrice: line.unitPrice,
        section: line.section,
      });
    }
  }

  let added = 0;
  let updated = 0;
  const now = new Date().toISOString();
  const inserts: Record<string, unknown>[] = [];
  for (const [k, item] of latest) {
    const found = existing.get(k);
    if (found) {
      if (Number(found.unit_price) === item.unitPrice) continue;
      const { error } = await supabase
        .from('btp_price_catalog')
        .update({ unit_price: item.unitPrice, updated_by: ctx.userId, updated_at: now })
        .eq('id', found.id as string);
      if (!error) updated += 1;
    } else {
      inserts.push({
        organization_id: ctx.orgId,
        designation: item.designation,
        unit: item.unit,
        unit_price: item.unitPrice,
        section: item.section,
        updated_by: ctx.userId,
      });
    }
  }
  if (inserts.length > 0) {
    const { error } = await supabase.from('btp_price_catalog').insert(inserts);
    if (error) return { error: error.message };
    added = inserts.length;
  }
  revalidatePath('/btp/devis');
  return { added, updated };
}

// ─── Accès délégués ────────────────────────────────────────────────

export interface QuoteAccessMember {
  profileId: string;
  fullName: string;
  email: string;
  role: string;
  granted: boolean;
}

const DIRECTOR_ROLE_LIST = ['platform_admin', 'org_admin', 'deputy_director'];

export async function listBtpQuoteAccessMembers(): Promise<ActionResult<{ members: QuoteAccessMember[] }>> {
  const isDirector = await canManageAssignments();
  if (!isDirector) return { error: 'Réservé au directeur.' };
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const [{ data: profiles, error }, { data: grants, error: grantErr }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .order('full_name'),
    supabase.from('btp_quote_access').select('profile_id').eq('organization_id', orgId),
  ]);
  if (error) return { error: error.message };
  if (grantErr) return { error: isMissingTable(grantErr.message) ? MIGRATION_HINT : grantErr.message };
  const granted = new Set((grants ?? []).map((g) => g.profile_id as string));
  return {
    members: (profiles ?? [])
      .filter((p) => !DIRECTOR_ROLE_LIST.includes(p.role as string))
      .map((p) => ({
        profileId: p.id as string,
        fullName: (p.full_name as string) || (p.email as string),
        email: p.email as string,
        role: p.role as string,
        granted: granted.has(p.id as string),
      })),
  };
}

export async function setBtpQuoteAccess(profileId: string, grant: boolean): Promise<ActionResult> {
  const isDirector = await canManageAssignments();
  if (!isDirector) return { error: 'Réservé au directeur.' };
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: target } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', profileId)
    .eq('organization_id', orgId)
    .maybeSingle();
  if (!target) return { error: 'Membre introuvable dans votre organisation.' };

  const { error } = grant
    ? await supabase
        .from('btp_quote_access')
        .upsert(
          { organization_id: orgId, profile_id: profileId, granted_by: user?.id ?? null },
          { onConflict: 'organization_id,profile_id' }
        )
    : await supabase
        .from('btp_quote_access')
        .delete()
        .eq('organization_id', orgId)
        .eq('profile_id', profileId);
  if (error) return { error: isMissingTable(error.message) ? MIGRATION_HINT : error.message };
  revalidatePath('/btp/devis');
  return { success: true };
}

// ─── Export ────────────────────────────────────────────────────────

export async function getBtpQuoteExportAssets(): Promise<
  ActionResult<{ orgName: string; logo: WeeklyReportImage | null }>
> {
  const ctx = await requireQuoteAccess();
  if ('error' in ctx) return ctx;
  const supabase = await createClient();
  const [{ data: org }, logo] = await Promise.all([
    supabase.from('organizations').select('name').eq('id', ctx.orgId).maybeSingle(),
    loadOrgLogoForReport(supabase, ctx.orgId),
  ]);
  return { orgName: (org?.name as string) ?? 'Entreprise', logo };
}
