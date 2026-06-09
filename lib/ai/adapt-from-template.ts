import { createClient } from '@/lib/supabase/server';
import { hasActiveLlmApi, queryKonaAI } from '@/lib/integrations/openai';
import { buildOfflineTemplateGuidance } from '@/lib/ai/offline-template-guidance';
import type { TemplateSector } from '@/lib/ai/document-template-purposes';
import { resolveTemplatePurposeForOrg } from '@/lib/actions/org-document-types';

export interface AiTemplateContext {
  templateId: string;
  purpose: string;
  label: string;
  fileName: string;
  notes: string | null;
  purposeHint: string;
}

export async function getAiTemplateContext(
  orgId: string,
  sector: TemplateSector,
  purpose: string
): Promise<AiTemplateContext | null> {
  const supabase = await createClient();
  const purposeDef = await resolveTemplatePurposeForOrg(orgId, sector, purpose);

  const { data: row, error } = await supabase
    .from('organization_ai_document_templates')
    .select(
      `id, purpose, label, notes, documents(id, file_name, file_path, mime_type, extracted_data)`
    )
    .eq('organization_id', orgId)
    .eq('sector', sector)
    .eq('purpose', purpose)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !row) return null;

  const doc = row.documents as {
    file_name?: string;
    file_path?: string;
    mime_type?: string;
    extracted_data?: Record<string, unknown>;
  } | null;

  if (!doc?.file_name) return null;

  return {
    templateId: row.id as string,
    purpose: row.purpose as string,
    label: row.label as string,
    fileName: doc.file_name,
    notes: (row.notes as string) || null,
    purposeHint: purposeDef?.description ?? '',
  };
}

export function buildAdaptationPrompt(params: {
  sector: TemplateSector;
  template: AiTemplateContext;
  producedFileName: string;
  producedDocType?: string | null;
  extraContext?: string;
}): { systemContext: string; userPrompt: string } {
  const { sector, template, producedFileName, producedDocType, extraContext } = params;

  const systemContext = [
    `Secteur: ${sector}`,
    `Modèle de référence (${template.label}): fichier « ${template.fileName} »`,
    template.purposeHint ? `Objectif du modèle: ${template.purposeHint}` : '',
    template.notes ? `Consignes direction: ${template.notes}` : '',
    'Respectez la structure, le ton, les rubriques et le niveau de détail du modèle.',
    'Adaptez au contexte guinéen (GNF, noms locaux) sans inventer de données non fournies.',
  ]
    .filter(Boolean)
    .join('\n');

  const userPrompt = [
    `Document produit à aligner: « ${producedFileName} »`,
    producedDocType ? `Type déclaré: ${producedDocType}` : '',
    extraContext ?? '',
    'Produisez des consignes d\'adaptation concrètes (sections à reprendre, formulations type, éléments obligatoires, mise en page) pour que le document final suive le modèle.',
  ]
    .filter(Boolean)
    .join('\n');

  return { systemContext, userPrompt };
}

/** Enregistre les consignes IA sur le document produit (metadata + extracted_data). */
export async function applyTemplateAdaptationToDocument(
  orgId: string,
  documentId: string,
  sector: TemplateSector,
  purpose: string,
  options?: { producedDocType?: string; extraContext?: string }
): Promise<{ ok: true; guidance: string } | { error: string }> {
  const template = await getAiTemplateContext(orgId, sector, purpose);
  if (!template) {
    return { error: 'Aucun modèle actif pour ce type de document. Le directeur peut en déposer un dans Paramètres → Modèles IA.' };
  }

  const supabase = await createClient();
  const { data: doc, error: docErr } = await supabase
    .from('documents')
    .select('id, file_name, extracted_data, metadata')
    .eq('id', documentId)
    .eq('organization_id', orgId)
    .single();

  if (docErr || !doc) return { error: 'Document introuvable.' };

  const { systemContext, userPrompt } = buildAdaptationPrompt({
    sector,
    template,
    producedFileName: doc.file_name as string,
    producedDocType: options?.producedDocType,
    extraContext: options?.extraContext,
  });

  const guidance = hasActiveLlmApi()
    ? await queryKonaAI(userPrompt, systemContext, {
        organizationId: orgId,
        operation: 'template_adapt',
      })
    : buildOfflineTemplateGuidance({
        sector,
        template,
        producedFileName: doc.file_name as string,
        producedDocType: options?.producedDocType,
      });

  const prevExtracted = (doc.extracted_data as Record<string, unknown>) ?? {};
  const prevMeta = (doc.metadata as Record<string, unknown>) ?? {};

  const { error: updateErr } = await supabase
    .from('documents')
    .update({
      extracted_data: {
        ...prevExtracted,
        ai_template_adaptation: {
          template_id: template.templateId,
          template_purpose: purpose,
          template_file_name: template.fileName,
          guidance,
          applied_at: new Date().toISOString(),
        },
      },
      metadata: {
        ...prevMeta,
        ai_reference_purpose: purpose,
      },
    })
    .eq('id', documentId)
    .eq('organization_id', orgId);

  if (updateErr) return { error: updateErr.message };

  return { ok: true, guidance };
}
