'use server';

import { createClient } from '@/lib/supabase/server';
import { requireOrgId } from '@/lib/actions/org';
import { revalidatePath } from 'next/cache';
import { canManageAssignments } from '@/lib/actions/assignments';
import {
  NGO_SURVEY_REPORT_PURPOSE,
  orgTypeToTemplateSector,
  type TemplateSector,
} from '@/lib/ai/document-template-purposes';
import {
  getMergedTemplatePurposesForCurrentOrg,
  resolveTemplatePurposeForOrg,
} from '@/lib/actions/org-document-types';
import { getOrgType } from '@/types/database';

export interface OrganizationAiTemplateRow {
  id: string;
  sector: TemplateSector;
  purpose: string;
  label: string;
  notes: string | null;
  fileName: string;
  filePath: string;
  mimeType: string | null;
  createdAt: string;
  hasAdaptationGuidance?: boolean;
}

async function requireDirector(): Promise<{ error: string } | { ok: true }> {
  const canManage = await canManageAssignments();
  if (!canManage) {
    return { error: 'Seuls les directeurs peuvent gérer les modèles IA.' };
  }
  return { ok: true };
}

export async function getOrganizationAiTemplates(
  orgId: string,
  sector: TemplateSector
): Promise<OrganizationAiTemplateRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('organization_ai_document_templates')
    .select(
      `id, sector, purpose, label, notes, created_at, documents(file_name, file_path, mime_type, extracted_data)`
    )
    .eq('organization_id', orgId)
    .eq('sector', sector)
    .eq('is_active', true)
    .order('label');

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const doc = row.documents as {
      file_name?: string;
      file_path?: string;
      mime_type?: string;
      extracted_data?: Record<string, unknown>;
    } | null;
    return {
      id: row.id as string,
      sector: row.sector as TemplateSector,
      purpose: row.purpose as string,
      label: row.label as string,
      notes: (row.notes as string) || null,
      fileName: doc?.file_name ?? '—',
      filePath: doc?.file_path ?? '',
      mimeType: doc?.mime_type ?? null,
      createdAt: row.created_at as string,
      hasAdaptationGuidance: false,
    };
  });
}

export async function getOrganizationAiTemplatesForCurrentOrg(
  sector: TemplateSector
): Promise<{
  purposes: ReturnType<typeof getTemplatePurposesForSector>;
  templates: OrganizationAiTemplateRow[];
}> {
  const orgId = await requireOrgId();
  const [purposes, templates] = await Promise.all([
    getMergedTemplatePurposesForCurrentOrg(sector),
    getOrganizationAiTemplates(orgId, sector),
  ]);
  return { purposes, templates };
}

export async function uploadOrganizationAiTemplate(formData: FormData) {
  const auth = await requireDirector();
  if ('error' in auth) return auth;

  const orgId = await requireOrgId();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const sector = formData.get('sector') as TemplateSector;
  const purpose = (formData.get('purpose') as string)?.trim();
  const notes = ((formData.get('notes') as string) || '').trim() || null;

  if (!sector || !['school', 'ngo', 'btp', 'pme'].includes(sector)) {
    return { error: 'Secteur invalide.' };
  }

  const purposeDef = await resolveTemplatePurposeForOrg(orgId, sector, purpose);
  if (!purposeDef) return { error: 'Type de modèle invalide.' };

  const file = formData.get('file') as File;
  if (!file) return { error: 'Fichier modèle requis.' };

  const allowedExt = /\.(pdf|doc|docx|xls|xlsx|png|jpe?g)$/i;
  if (!allowedExt.test(file.name)) {
    return { error: 'Formats acceptés : PDF, Word, Excel, image.' };
  }

  const filePath = `${orgId}/templates/${sector}/${purpose}/${Date.now()}_${file.name}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(filePath, buffer, { contentType: file.type, upsert: false });

  if (uploadError) return { error: uploadError.message };

  const { data: doc, error: docErr } = await supabase
    .from('documents')
    .insert({
      organization_id: orgId,
      uploaded_by: user?.id,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      mime_type: file.type,
      status: 'archived',
      category: purposeDef.category,
      ai_confidence: 100,
      tags: ['ai_template', `sector:${sector}`, `purpose:${purpose}`],
      metadata: {
        is_ai_reference_template: true,
        template_sector: sector,
        template_purpose: purpose,
      },
      extracted_data: {
        role: 'ai_reference_template',
        template_purpose: purpose,
        template_label: purposeDef.label,
      },
    })
    .select('id')
    .single();

  if (docErr || !doc) return { error: docErr?.message ?? 'Erreur document' };

  const { error: upsertErr } = await supabase.from('organization_ai_document_templates').upsert(
    {
      organization_id: orgId,
      sector,
      purpose,
      label: purposeDef.label,
      document_id: doc.id,
      notes,
      is_active: true,
      created_by: user?.id,
    },
    { onConflict: 'organization_id,sector,purpose' }
  );

  if (upsertErr) return { error: upsertErr.message };

  try {
    const { indexUploadedDocument } = await import('@/lib/documents/index-uploaded-document');
    await indexUploadedDocument(supabase, {
      organizationId: orgId,
      documentId: doc.id as string,
      filePath,
      fileName: file.name,
      mimeType: file.type,
      fileBuffer: buffer,
      previousExtracted: {
        role: 'ai_reference_template',
        template_purpose: purpose,
        template_label: purposeDef.label,
      },
    });
  } catch {
    /* indexation optionnelle */
  }

  revalidateTemplatePaths(sector, purpose);
  return { success: true };
}

export async function removeOrganizationAiTemplate(templateId: string) {
  const auth = await requireDirector();
  if ('error' in auth) return auth;

  const orgId = await requireOrgId();
  const supabase = await createClient();

  const { data: row, error: fetchErr } = await supabase
    .from('organization_ai_document_templates')
    .select('id, sector, purpose, document_id')
    .eq('id', templateId)
    .eq('organization_id', orgId)
    .single();

  if (fetchErr || !row) return { error: 'Modèle introuvable.' };

  await supabase
    .from('organization_ai_document_templates')
    .delete()
    .eq('id', templateId)
    .eq('organization_id', orgId);

  revalidateTemplatePaths(row.sector as TemplateSector, row.purpose as string);
  return { success: true };
}

function revalidateTemplatePaths(sector: TemplateSector, purpose?: string) {
  revalidatePath('/parametres/modeles');
  revalidatePath('/parametres');
  if (sector === 'school') {
    revalidatePath('/etablissement/bulletins');
    revalidatePath('/etablissement/rapports');
  }
  if (sector === 'ngo') {
    revalidatePath('/ong/documents');
    revalidatePath('/ong/rapports');
    if (purpose === NGO_SURVEY_REPORT_PURPOSE) {
      revalidatePath('/ong/sondages');
    }
  }
  if (sector === 'btp') {
    revalidatePath('/btp/documents');
    revalidatePath('/btp/rapports');
  }
  if (sector === 'pme') {
    revalidatePath('/pme/rapports');
  }
}

export async function getDirectorTemplateSector(): Promise<TemplateSector | null> {
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const { data: org } = await supabase
    .from('organizations')
    .select('type')
    .eq('id', orgId)
    .single();
  return orgTypeToTemplateSector(org?.type as string);
}
