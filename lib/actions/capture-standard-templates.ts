'use server';

import { getSession } from '@/lib/actions/auth';
import { requireOrgId } from '@/lib/actions/org';
import { canManageAssignments } from '@/lib/actions/assignments';
import {
  getCaptureStandardById,
  getCaptureStandardsForSector,
  type CaptureTemplateFormat,
} from '@/lib/documents/capture-standard-templates';
import { generateCaptureTemplateBytes } from '@/lib/documents/generate-capture-template';
import { orgTypeToTemplateSector, type TemplateSector } from '@/lib/ai/document-template-purposes';
import type { Organization } from '@/types/database';

export async function getCaptureStandardsForCurrentOrg(): Promise<{
  sector: TemplateSector | null;
  templates: ReturnType<typeof getCaptureStandardsForSector>;
}> {
  const session = await getSession();
  const org = session?.profile?.organizations as Organization | null;
  const sector = orgTypeToTemplateSector(org?.type);
  if (!sector) return { sector: null, templates: [] };
  return { sector, templates: getCaptureStandardsForSector(sector) };
}

export async function downloadCaptureStandardTemplate(
  templateId: string,
  format: CaptureTemplateFormat
): Promise<{ base64: string; fileName: string; mimeType: string } | { error: string }> {
  const canManage = await canManageAssignments();
  if (!canManage) return { error: 'Non autorisé' };

  const session = await getSession();
  const org = session?.profile?.organizations as Organization | null;
  const sector = orgTypeToTemplateSector(org?.type);
  if (!sector) return { error: 'Organisation non prise en charge' };

  const template = getCaptureStandardById(templateId);
  if (!template || template.sector !== sector) {
    return { error: 'Modèle introuvable pour votre secteur.' };
  }

  if (!template.formats.includes(format)) {
    return { error: `Format ${format} non disponible pour ce modèle.` };
  }

  await requireOrgId();

  const { bytes, fileName, mimeType } = generateCaptureTemplateBytes(template, {
    format,
    orgName: org?.name,
  });

  return {
    base64: Buffer.from(bytes).toString('base64'),
    fileName,
    mimeType,
  };
}
