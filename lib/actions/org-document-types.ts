'use server';

import { createClient } from '@/lib/supabase/server';
import { requireOrgId } from '@/lib/actions/org';
import { revalidatePath } from 'next/cache';
import { canManageAssignments } from '@/lib/actions/assignments';
import type { DocumentCategory } from '@/types/database';
import type { TemplateSector } from '@/lib/ai/document-template-purposes';
import {
  mergeSectorDocumentTypes,
  mergeTemplatePurposes,
  orgDocumentTypeToTemplatePurpose,
  resolveTemplatePurposeFromRows,
  rowToOrgDocumentType,
  slugifyOrgDocumentTypeCode,
  type OrgDocumentTypeRow,
} from '@/lib/documents/org-document-types';
import type { SectorDocumentTypeOption } from '@/lib/documents/sector-document-types';
import type { TemplatePurposeDef } from '@/lib/ai/document-template-purposes';

async function requireDirector(): Promise<{ error: string } | { ok: true }> {
  const canManage = await canManageAssignments();
  if (!canManage) {
    return { error: 'Seuls les directeurs peuvent gérer les types de documents.' };
  }
  return { ok: true };
}

export async function fetchOrgDocumentTypes(
  orgId: string,
  sector: TemplateSector,
  options?: { includeInactive?: boolean }
): Promise<OrgDocumentTypeRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from('organization_document_types')
    .select('*')
    .eq('organization_id', orgId)
    .eq('sector', sector)
    .order('label');

  if (!options?.includeInactive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => rowToOrgDocumentType(row as Record<string, unknown>));
}

export async function getMergedDocumentTypesForCurrentOrg(
  sector: 'ngo' | 'btp'
): Promise<SectorDocumentTypeOption[]> {
  const orgId = await requireOrgId();
  const custom = await fetchOrgDocumentTypes(orgId, sector);
  return mergeSectorDocumentTypes(sector, custom);
}

export async function getMergedTemplatePurposesForCurrentOrg(
  sector: TemplateSector
): Promise<TemplatePurposeDef[]> {
  const orgId = await requireOrgId();
  const custom = await fetchOrgDocumentTypes(orgId, sector);
  return mergeTemplatePurposes(sector, custom);
}

export async function resolveOrgDocumentType(
  orgId: string,
  sector: 'ngo' | 'btp',
  typeId: string
): Promise<SectorDocumentTypeOption | null> {
  const { resolveBuiltinSectorType, orgDocumentTypeToSectorOption } = await import(
    '@/lib/documents/org-document-types'
  );
  const builtin = resolveBuiltinSectorType(sector, typeId);
  if (builtin) return builtin;

  const { getCaptureStandardById, captureStandardToSectorOption } = await import(
    '@/lib/documents/capture-standard-templates'
  );
  const capture = getCaptureStandardById(typeId);
  if (capture && capture.sector === sector) return captureStandardToSectorOption(capture);

  if (!typeId.startsWith('custom_')) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('organization_document_types')
    .select('*')
    .eq('organization_id', orgId)
    .eq('sector', sector)
    .eq('code', typeId)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) return null;
  return orgDocumentTypeToSectorOption(rowToOrgDocumentType(data as Record<string, unknown>));
}

export async function resolveTemplatePurposeForOrg(
  orgId: string,
  sector: TemplateSector,
  purpose: string
): Promise<TemplatePurposeDef | undefined> {
  const custom = await fetchOrgDocumentTypes(orgId, sector, { includeInactive: true });
  return resolveTemplatePurposeFromRows(sector, purpose, custom);
}

export interface CreateOrgDocumentTypeInput {
  sector: TemplateSector;
  label: string;
  description?: string;
  category: DocumentCategory;
  hint?: string;
}

export async function createOrgDocumentType(input: CreateOrgDocumentTypeInput) {
  const auth = await requireDirector();
  if ('error' in auth) return auth;

  const orgId = await requireOrgId();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const label = input.label.trim();
  if (!label || label.length < 2) {
    return { error: 'Libellé du type requis (2 caractères minimum).' };
  }

  if (!['school', 'ngo', 'btp', 'pme'].includes(input.sector)) {
    return { error: 'Secteur invalide.' };
  }

  let code = slugifyOrgDocumentTypeCode(label);
  for (let attempt = 0; attempt < 20; attempt++) {
    const tryCode = attempt === 0 ? code : `${code}_${attempt + 1}`;
    const { data, error } = await supabase
      .from('organization_document_types')
      .insert({
        organization_id: orgId,
        sector: input.sector,
        code: tryCode,
        label,
        description: input.description?.trim() || null,
        category: input.category,
        hint: input.hint?.trim() || null,
        created_by: user?.id,
      })
      .select('*')
      .single();

    if (!error && data) {
      revalidateOrgDocumentTypePaths(input.sector);
      return {
        success: true as const,
        type: orgDocumentTypeToTemplatePurpose(rowToOrgDocumentType(data as Record<string, unknown>)),
      };
    }
    if (error?.code !== '23505') {
      return { error: error?.message ?? 'Création impossible' };
    }
    code = tryCode;
  }

  return { error: 'Impossible de générer un identifiant unique pour ce type.' };
}

export async function deactivateOrgDocumentType(typeId: string) {
  const auth = await requireDirector();
  if ('error' in auth) return auth;

  const orgId = await requireOrgId();
  const supabase = await createClient();

  const { data: row, error: fetchErr } = await supabase
    .from('organization_document_types')
    .select('id, sector, code')
    .eq('id', typeId)
    .eq('organization_id', orgId)
    .single();

  if (fetchErr || !row) return { error: 'Type introuvable.' };

  const { error } = await supabase
    .from('organization_document_types')
    .update({ is_active: false })
    .eq('id', typeId)
    .eq('organization_id', orgId);

  if (error) return { error: error.message };

  await supabase
    .from('organization_ai_document_templates')
    .update({ is_active: false })
    .eq('organization_id', orgId)
    .eq('sector', row.sector as string)
    .eq('purpose', row.code as string);

  revalidateOrgDocumentTypePaths(row.sector as TemplateSector);
  return { success: true as const };
}

function revalidateOrgDocumentTypePaths(sector: TemplateSector) {
  revalidatePath('/parametres/modeles');
  revalidatePath('/parametres');
  if (sector === 'school') {
    revalidatePath('/etablissement/bulletins');
    revalidatePath('/etablissement/rapports');
  }
  if (sector === 'ngo') {
    revalidatePath('/ong/documents');
    revalidatePath('/ong/rapports');
  }
  if (sector === 'btp') {
    revalidatePath('/btp/documents');
    revalidatePath('/btp/rapports');
  }
  if (sector === 'pme') {
    revalidatePath('/pme/rapports');
  }
}
