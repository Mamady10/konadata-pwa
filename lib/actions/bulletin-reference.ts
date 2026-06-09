'use server';

import { createClient } from '@/lib/supabase/server';
import { requireOrgId } from '@/lib/actions/org';
import { getSession } from '@/lib/actions/auth';
import { getDocumentUrl } from '@/lib/actions/storage';
import { getEtablissementCapabilities } from '@/lib/school/etablissement-access';
import { revalidatePath } from 'next/cache';
import {
  inferBulletinStyleFromText,
  mergeReferenceIntoBulletinTemplate,
  mergeBulletinTemplatePatch,
  parseBulletinTemplate,
  type SchoolBulletinTemplate,
} from '@/lib/school/bulletin-template';
import { generateReportCardPdfBuffer } from '@/lib/school/report-card-pdf';

export interface BulletinReferenceInfo {
  hasReference: boolean;
  fileName: string | null;
  documentId: string | null;
  syncedAt: string | null;
  downloadUrl: string | null;
  notes: string | null;
}

async function requireDirector() {
  const session = await getSession();
  const caps = getEtablissementCapabilities(session?.profile?.role);
  if (!caps.isDirector) return { error: 'Seul le directeur peut gérer le modèle bulletin.' };
  return { ok: true as const };
}

async function loadReferenceDocument(orgId: string) {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from('organization_ai_document_templates')
    .select(
      `id, notes, documents(id, file_name, file_path, extracted_data)`
    )
    .eq('organization_id', orgId)
    .eq('sector', 'school')
    .eq('purpose', 'school_bulletin')
    .eq('is_active', true)
    .maybeSingle();

  if (!row) return null;

  const doc = row.documents as {
    id?: string;
    file_name?: string;
    file_path?: string;
    extracted_data?: Record<string, unknown>;
  } | null;

  if (!doc?.id || !doc.file_path) return null;

  return {
    templateNotes: (row.notes as string) || null,
    documentId: doc.id as string,
    fileName: doc.file_name as string,
    filePath: doc.file_path as string,
    extracted: doc.extracted_data ?? {},
  };
}

async function readDocumentFullText(documentId: string): Promise<string> {
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from('documents')
    .select('search_text, extracted_data')
    .eq('id', documentId)
    .maybeSingle();

  if (typeof doc?.search_text === 'string' && doc.search_text.trim()) {
    return doc.search_text;
  }

  const { data: row } = await supabase
    .from('document_extractions')
    .select('field_value')
    .eq('document_id', documentId)
    .eq('field_name', 'full_text')
    .maybeSingle();

  if (typeof row?.field_value === 'string' && row.field_value.trim()) {
    return row.field_value;
  }

  const preview = (doc?.extracted_data as Record<string, unknown> | undefined)?.full_text_preview;
  return typeof preview === 'string' ? preview : '';
}

export async function getBulletinReferenceInfo(): Promise<BulletinReferenceInfo> {
  const orgId = await requireOrgId();
  const ref = await loadReferenceDocument(orgId);
  if (!ref) {
    return {
      hasReference: false,
      fileName: null,
      documentId: null,
      syncedAt: null,
      downloadUrl: null,
      notes: null,
    };
  }

  const downloadUrl = await getDocumentUrl(ref.filePath);
  const supabase = await createClient();
  const { data: org } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', orgId)
    .maybeSingle();

  const tpl = parseBulletinTemplate((org?.settings as Record<string, unknown>) ?? null);

  return {
    hasReference: true,
    fileName: ref.fileName,
    documentId: ref.documentId,
    syncedAt: tpl.reference?.synced_at ?? null,
    downloadUrl,
    notes: ref.templateNotes,
  };
}

export async function syncBulletinStyleFromReference(): Promise<
  { success: true; template: SchoolBulletinTemplate } | { error: string }
> {
  const auth = await requireDirector();
  if ('error' in auth) return auth;

  const orgId = await requireOrgId();
  const ref = await loadReferenceDocument(orgId);
  if (!ref) {
    return {
      error:
        'Aucun fichier modèle joint. Déposez un PDF ou Word de bulletin type ci-dessous.',
    };
  }

  const supabase = await createClient();
  const { data: org, error: loadErr } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', orgId)
    .single();

  if (loadErr) return { error: loadErr.message };

  const current = parseBulletinTemplate((org?.settings as Record<string, unknown>) ?? null);
  const text = await readDocumentFullText(ref.documentId);
  const stylePatch = text.trim() ? inferBulletinStyleFromText(text) : {};

  const merged = mergeReferenceIntoBulletinTemplate(current, {
    document_id: ref.documentId,
    file_name: ref.fileName,
    synced_at: new Date().toISOString(),
  }, stylePatch);

  const nextSettings = mergeBulletinTemplatePatch(
    (org?.settings as Record<string, unknown>) ?? null,
    merged
  );

  const { error } = await supabase
    .from('organizations')
    .update({ settings: nextSettings })
    .eq('id', orgId);

  if (error) return { error: error.message };

  revalidatePath('/parametres/bulletin');
  revalidatePath('/etablissement/bulletins');
  return { success: true, template: merged };
}

export async function uploadBulletinReferenceTemplate(formData: FormData) {
  const auth = await requireDirector();
  if ('error' in auth) return auth;

  formData.set('sector', 'school');
  formData.set('purpose', 'school_bulletin');

  const { uploadOrganizationAiTemplate } = await import('@/lib/actions/document-templates');
  const upload = await uploadOrganizationAiTemplate(formData);
  if ('error' in upload && upload.error) return upload;

  const sync = await syncBulletinStyleFromReference();
  if ('error' in sync) {
    return {
      success: true,
      warning:
        'Fichier enregistré mais le style n\'a pas pu être lu automatiquement — ajustez les champs manuellement.',
    };
  }

  return { success: true, template: sync.template };
}

export async function getBulletinBlankPreviewPdf(): Promise<
  { base64: string; fileName: string } | { error: string }
> {
  const orgId = await requireOrgId();
  const supabase = await createClient();

  const { data: org } = await supabase
    .from('organizations')
    .select('name, settings, logo_url, address')
    .eq('id', orgId)
    .maybeSingle();

  const { parseSchoolOrgSettings } = await import('@/lib/school/school-org-settings');
  const schoolSettings = parseSchoolOrgSettings(
    (org?.settings as Record<string, unknown>) ?? null
  );

  const { parseSchoolBranding } = await import('@/lib/school/bulletin-template');
  const {
    fetchOrgLogoForBulletin,
    fetchOrgStampForBulletin,
  } = await import('@/lib/school/fetch-org-branding');
  const branding = parseSchoolBranding((org?.settings as Record<string, unknown>) ?? null);
  const tpl = schoolSettings.bulletin_template;
  const logo = await fetchOrgLogoForBulletin(
    supabase,
    (org?.logo_url as string) ?? null,
    branding.logo_storage_path,
    branding.logo_pdf_cache
  );
  const stamp = await fetchOrgStampForBulletin(supabase, tpl.stamp);

  const { parseMepsSettings } = await import('@/lib/school/meps-settings');
  const meps = parseMepsSettings(
    (org?.settings as Record<string, unknown>) ?? null,
    (org?.address as string) ?? null
  );
  const establishmentMeta = [meps.commune, meps.prefecture].filter(Boolean).join(' · ');

  const { data: subjects } = await supabase
    .from('school_subjects')
    .select('id, name, coefficient')
    .eq('organization_id', orgId)
    .order('name');

  const sampleGrades =
    (subjects ?? []).length > 0
      ? (subjects ?? []).map((s, i) => ({
          subjectName: s.name as string,
          score: i % 3 === 0 ? null : 10 + (i % 8),
          maxScore: 20,
          coefficient: Number(s.coefficient ?? 1),
          missing: i % 3 === 0,
        }))
      : [
          { subjectName: 'Chimie', score: 14, maxScore: 20, coefficient: 2 },
          { subjectName: 'Physique', score: 13, maxScore: 20, coefficient: 2 },
          { subjectName: 'Mathématiques', score: null, maxScore: 20, coefficient: 3, missing: true },
        ];

  const buffer = generateReportCardPdfBuffer({
    organizationName: (org?.name as string) ?? 'Établissement',
    organizationLogo: logo,
    organizationStamp: stamp,
    orgAddress: (org?.address as string) ?? null,
    establishmentMeta: establishmentMeta || null,
    template: tpl,
    studentName: 'Élève Exemple',
    matricule: 'MAT-0000',
    className: 'Classe Exemple',
    semester: 'S1',
    academicYear: schoolSettings.default_academic_year,
    averageScore: 12.5,
    rank: 5,
    classSize: 28,
    appreciation: 'Bon travail — bulletin généré selon votre modèle.',
    grades: sampleGrades,
    publicationStatus: 'draft',
  });

  return {
    base64: Buffer.from(buffer).toString('base64'),
    fileName: 'apercu-modele-bulletin.pdf',
  };
}
