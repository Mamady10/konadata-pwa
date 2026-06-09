'use server';

import { createClient } from '@/lib/supabase/server';
import { resolveUploadContentType } from '@/lib/school/enrollment-upload';
import { buildSafeDocumentStoragePath } from '@/lib/school/storage-path';
import { isSelfServiceLearner } from '@/lib/school/etablissement-access';
import { getSession } from '@/lib/actions/auth';
import { requireOrgId } from '@/lib/actions/org';
import { revalidatePath } from 'next/cache';
import { getMyAssignedBtpSiteIds, getMyAssignedNgoProjectIds } from '@/lib/actions/assignments';
import { getDocumentTypeLabel } from '@/lib/documents/sector-document-types';
import { resolveOrgDocumentType } from '@/lib/actions/org-document-types';
import type { DocumentCategory } from '@/types/database';
import {
  parseDocumentAiAdaptation,
  type DocumentAiAdaptation,
} from '@/lib/ai/template-adaptation-types';
import { parseCaptureExtraction } from '@/lib/ai/extraction/capture-extraction-parse';
import type { CaptureExtractionResult } from '@/lib/ai/extraction/capture-extract-types';
import { getCaptureStandardById } from '@/lib/documents/capture-standard-templates';
import { indexUploadedDocument } from '@/lib/documents/index-uploaded-document';
import {
  isDocumentLikelyIndexed,
  slimExtractedDataForList,
} from '@/lib/documents/slim-extracted-data';

const DOCUMENT_LIST_SELECT =
  'id, file_name, file_size, mime_type, category, status, created_at, extracted_data';
const DEFAULT_DOCUMENT_LIST_LIMIT = 80;

export type { DocumentAiAdaptation, CaptureExtractionResult };

async function runDocumentTextIndex(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    organizationId: string;
    documentId: string;
    filePath: string;
    fileName: string;
    mimeType: string | null;
    fileBuffer: Buffer;
    previousExtracted?: Record<string, unknown>;
  }
) {
  return indexUploadedDocument(supabase, params);
}

function detectCategory(fileName: string): DocumentCategory {
  const lower = fileName.toLowerCase();
  if (/bulletin|note|resultat/.test(lower)) return 'school_report';
  if (/rapport|report|activit|projet|questionnaire|sondage/.test(lower)) return 'ngo_report';
  if (/cv|curriculum|resume/.test(lower)) return 'cv';
  if (/facture|invoice/.test(lower)) return 'invoice';
  if (/bon.*livraison/.test(lower)) return 'delivery_note';
  if (/carburant|fuel/.test(lower)) return 'fuel_report';
  return 'other';
}

export async function uploadDocument(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non authentifié' };

  const enrollmentId = (formData.get('enrollment_id') as string)?.trim() || null;
  let orgId: string | null = null;

  if (enrollmentId) {
    const session = await getSession();
    if (!isSelfServiceLearner(session?.profile?.role)) {
      return {
        error:
          'Seuls les candidats ou élèves peuvent déposer des pièces sur leur dossier d’inscription.',
      };
    }

    const { getLinkedSchoolStudentIds } = await import('@/lib/actions/school');
    const studentIds = await getLinkedSchoolStudentIds();
    const { data: enr } = await supabase
      .from('school_enrollments')
      .select('organization_id, student_id')
      .eq('id', enrollmentId)
      .maybeSingle();
    if (!enr?.organization_id) {
      return { error: 'Dossier d’inscription introuvable.' };
    }
    if (studentIds.length && enr.student_id && !studentIds.includes(enr.student_id as string)) {
      return { error: 'Ce dossier ne vous appartient pas.' };
    }
    orgId = enr.organization_id as string;
  }

  if (!orgId) {
    try {
      orgId = await requireOrgId();
    } catch {
      return { error: 'Choisissez un dossier ou rattachez-vous à un établissement.' };
    }
  }

  const file = formData.get('file') as File;
  if (!file) return { error: 'Fichier requis' };

  const category = detectCategory(file.name);
  const { storagePath: filePath, displayName } = buildSafeDocumentStoragePath(orgId, file.name);

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const contentType = resolveUploadContentType(file);
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(filePath, buffer, {
      contentType,
      upsert: false,
    });

  if (uploadError) return { error: uploadError.message };

  const { data: doc, error: dbError } = await supabase
    .from('documents')
    .insert({
      organization_id: orgId,
      uploaded_by: user?.id,
      file_name: displayName,
      file_path: filePath,
      file_size: file.size,
      mime_type: contentType,
      status: 'classified',
      category,
      ai_confidence: 92.0,
      extracted_data: {
        detected_by: 'konadata-ai',
        original_name: file.name,
        storage_name: filePath.split('/').pop(),
      },
    })
    .select()
    .single();

  if (dbError) return { error: dbError.message };

  let studentId = formData.get('student_id') as string | null;

  if (enrollmentId && !studentId) {
    const { data: enr } = await supabase
      .from('school_enrollments')
      .select('student_id')
      .eq('id', enrollmentId)
      .eq('organization_id', orgId)
      .maybeSingle();
    studentId = (enr?.student_id as string) ?? null;
  }

  if (studentId || enrollmentId) {
    const docType = (formData.get('doc_type') as string)?.trim();
    if (!docType) {
      return { error: 'Choisissez le type de document avant de téléverser.' };
    }
    const { ENROLLMENT_DOCUMENT_TYPES, getEnrollmentDocumentLabel } = await import(
      '@/lib/school/enrollment-document-types'
    );
    if (!ENROLLMENT_DOCUMENT_TYPES.some((t) => t.id === docType)) {
      return { error: 'Type de document invalide.' };
    }
    const { error: linkErr } = await supabase.from('school_student_documents').insert({
      organization_id: orgId,
      student_id: studentId,
      enrollment_id: enrollmentId,
      document_id: doc.id,
      doc_type: docType,
    });
    if (linkErr) return { error: linkErr.message };
    await supabase
      .from('documents')
      .update({
        extracted_data: {
          classified_by: 'user',
          document_type: docType,
          document_type_label: getEnrollmentDocumentLabel(docType),
          enrollment_id: enrollmentId,
          student_id: studentId,
        },
      })
      .eq('id', doc.id);

    try {
      const { applyTemplateAdaptationToDocument } = await import('@/lib/ai/adapt-from-template');
      const schoolPurpose =
        docType === 'report_card_prev' ? 'school_bulletin' : 'school_enrollment_pack';
      await applyTemplateAdaptationToDocument(orgId, doc.id as string, 'school', schoolPurpose, {
        producedDocType: getEnrollmentDocumentLabel(docType),
      });
    } catch {
      /* adaptation IA optionnelle */
    }
  }

  const { data: docRow } = await supabase
    .from('documents')
    .select('extracted_data')
    .eq('id', doc.id)
    .single();

  const indexResult = await runDocumentTextIndex(supabase, {
    organizationId: orgId,
    documentId: doc.id as string,
    filePath: doc.file_path as string,
    fileName: doc.file_name as string,
    mimeType: contentType,
    fileBuffer: buffer,
    previousExtracted: (docRow?.extracted_data as Record<string, unknown>) ?? {},
  });

  revalidatePath('/data-factory');
  revalidatePath('/etablissement/candidatures');
  revalidatePath('/etablissement/rapports');
  revalidatePath('/ong/documents');
  return { data: doc, indexing: indexResult };
}

export async function uploadNgoProjectDocument(formData: FormData) {
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const projectId = (formData.get('project_id') as string)?.trim();
  if (!projectId) return { error: 'Projet requis' };

  const documentTypeId = (formData.get('document_type') as string)?.trim();
  if (!documentTypeId) return { error: 'Choisissez le type de document avant de téléverser.' };

  const typeDef = await resolveOrgDocumentType(orgId, 'ngo', documentTypeId);
  if (!typeDef) return { error: 'Type de document invalide.' };

  const assigned = await getMyAssignedNgoProjectIds();
  if (assigned !== null && !assigned.includes(projectId)) {
    return { error: 'Vous n\'êtes pas assigné à ce projet.' };
  }

  const { data: project, error: projectErr } = await supabase
    .from('ngo_projects')
    .select('id')
    .eq('id', projectId)
    .eq('organization_id', orgId)
    .single();

  if (projectErr || !project) return { error: 'Projet introuvable.' };

  const file = formData.get('file') as File;
  if (!file) return { error: 'Fichier requis' };

  const filePath = `${orgId}/${Date.now()}_${file.name}`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const contentType = resolveUploadContentType(file);
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(filePath, buffer, {
      contentType,
      upsert: false,
    });

  if (uploadError) return { error: uploadError.message };

  const { data: doc, error: dbError } = await supabase
    .from('documents')
    .insert({
      organization_id: orgId,
      uploaded_by: user?.id,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      mime_type: contentType,
      status: 'classified',
      category: typeDef.category,
      ai_confidence: 98.0,
      extracted_data: {
        classified_by: 'user',
        document_type: typeDef.id,
        document_type_label: typeDef.label,
        project_id: projectId,
        original_name: file.name,
      },
    })
    .select()
    .single();

  if (dbError) return { error: dbError.message };

  const { error: linkErr } = await supabase.from('ngo_project_documents').insert({
    organization_id: orgId,
    project_id: projectId,
    document_id: doc.id,
    doc_type: typeDef.id,
  });

  if (linkErr) return { error: linkErr.message };

  try {
    const { applyTemplateAdaptationToDocument } = await import('@/lib/ai/adapt-from-template');
    await applyTemplateAdaptationToDocument(orgId, doc.id as string, 'ngo', typeDef.id, {
      producedDocType: typeDef.label,
    });
  } catch {
    /* adaptation IA optionnelle */
  }

  const indexResult = await runDocumentTextIndex(supabase, {
    organizationId: orgId,
    documentId: doc.id as string,
    filePath: doc.file_path as string,
    fileName: doc.file_name as string,
    mimeType: contentType,
    fileBuffer: buffer,
    previousExtracted: (doc.extracted_data as Record<string, unknown>) ?? {},
  });

  revalidatePath('/ong/documents');
  revalidatePath('/ong/rapports');
  revalidatePath('/data-factory');
  return { data: doc, indexing: indexResult };
}

export async function uploadBtpSiteDocument(formData: FormData) {
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const siteId = (formData.get('site_id') as string)?.trim();
  if (!siteId) return { error: 'Chantier requis' };

  const documentTypeId = (formData.get('document_type') as string)?.trim();
  if (!documentTypeId) return { error: 'Choisissez le type de document avant de téléverser.' };

  const typeDef = await resolveOrgDocumentType(orgId, 'btp', documentTypeId);
  if (!typeDef) return { error: 'Type de document invalide.' };

  const assigned = await getMyAssignedBtpSiteIds();
  if (assigned !== null && !assigned.includes(siteId)) {
    return { error: 'Vous n\'êtes pas assigné à ce chantier.' };
  }

  const { data: site, error: siteErr } = await supabase
    .from('btp_sites')
    .select('id')
    .eq('id', siteId)
    .eq('organization_id', orgId)
    .single();

  if (siteErr || !site) return { error: 'Chantier introuvable.' };

  const file = formData.get('file') as File;
  if (!file) return { error: 'Fichier requis' };

  const filePath = `${orgId}/${Date.now()}_${file.name}`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const contentType = resolveUploadContentType(file);
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(filePath, buffer, {
      contentType,
      upsert: false,
    });

  if (uploadError) return { error: uploadError.message };

  const { data: doc, error: dbError } = await supabase
    .from('documents')
    .insert({
      organization_id: orgId,
      uploaded_by: user?.id,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      mime_type: contentType,
      status: 'classified',
      category: typeDef.category,
      ai_confidence: 98.0,
      extracted_data: {
        classified_by: 'user',
        document_type: typeDef.id,
        document_type_label: typeDef.label,
        site_id: siteId,
        original_name: file.name,
      },
    })
    .select()
    .single();

  if (dbError) return { error: dbError.message };

  const { error: linkErr } = await supabase.from('btp_site_documents').insert({
    organization_id: orgId,
    site_id: siteId,
    document_id: doc.id,
    doc_type: typeDef.id,
  });

  if (linkErr) return { error: linkErr.message };

  try {
    const { applyTemplateAdaptationToDocument } = await import('@/lib/ai/adapt-from-template');
    await applyTemplateAdaptationToDocument(orgId, doc.id as string, 'btp', typeDef.id, {
      producedDocType: typeDef.label,
    });
  } catch {
    /* adaptation IA optionnelle */
  }

  const indexResult = await runDocumentTextIndex(supabase, {
    organizationId: orgId,
    documentId: doc.id as string,
    filePath: doc.file_path as string,
    fileName: doc.file_name as string,
    mimeType: contentType,
    fileBuffer: buffer,
    previousExtracted: (doc.extracted_data as Record<string, unknown>) ?? {},
  });

  revalidatePath('/btp/documents');
  revalidatePath('/btp/rapports');
  revalidatePath('/data-factory');
  return { data: doc, indexing: indexResult };
}

export async function uploadSchoolCaptureDocument(formData: FormData) {
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const documentTypeId = (formData.get('document_type') as string)?.trim();
  if (!documentTypeId) return { error: 'Choisissez le type de modèle KonaData.' };

  const typeDef = getCaptureStandardById(documentTypeId);
  if (!typeDef || typeDef.sector !== 'school') {
    return { error: 'Type de modèle invalide pour l\'établissement.' };
  }

  const file = formData.get('file') as File;
  if (!file) return { error: 'Fichier requis' };

  const classId = (formData.get('class_id') as string)?.trim() || null;
  const filePath = `${orgId}/${Date.now()}_${file.name}`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = resolveUploadContentType(file);

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(filePath, buffer, { contentType, upsert: false });

  if (uploadError) return { error: uploadError.message };

  const { data: doc, error: dbError } = await supabase
    .from('documents')
    .insert({
      organization_id: orgId,
      uploaded_by: user?.id,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      mime_type: contentType,
      status: 'classified',
      category: typeDef.category,
      ai_confidence: 98.0,
      extracted_data: {
        classified_by: 'user',
        document_type: typeDef.id,
        document_type_label: typeDef.label,
        class_id: classId,
        original_name: file.name,
      },
    })
    .select()
    .single();

  if (dbError) return { error: dbError.message };

  const indexResult = await runDocumentTextIndex(supabase, {
    organizationId: orgId,
    documentId: doc.id as string,
    filePath: doc.file_path as string,
    fileName: doc.file_name as string,
    mimeType: contentType,
    fileBuffer: buffer,
    previousExtracted: (doc.extracted_data as Record<string, unknown>) ?? {},
  });

  revalidatePath('/etablissement/rapports');
  revalidatePath('/data-factory');
  return { data: doc, indexing: indexResult };
}

export async function uploadPmeDocument(formData: FormData) {
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const documentTypeId = (formData.get('document_type') as string)?.trim();
  if (!documentTypeId) return { error: 'Choisissez le type de document avant de téléverser.' };

  let resolved: { id: string; label: string; category: DocumentCategory };
  const capture = getCaptureStandardById(documentTypeId);
  if (capture && capture.sector === 'pme') {
    resolved = { id: capture.id, label: capture.label, category: capture.category };
  } else if (documentTypeId.startsWith('custom_')) {
    const { data: customRow } = await supabase
      .from('organization_document_types')
      .select('code, label, category')
      .eq('organization_id', orgId)
      .eq('sector', 'pme')
      .eq('code', documentTypeId)
      .eq('is_active', true)
      .maybeSingle();
    if (!customRow) return { error: 'Type de document invalide.' };
    resolved = {
      id: customRow.code as string,
      label: customRow.label as string,
      category: (customRow.category as DocumentCategory) || 'other',
    };
  } else {
    return { error: 'Type de document invalide.' };
  }

  const file = formData.get('file') as File;
  if (!file) return { error: 'Fichier requis' };

  const filePath = `${orgId}/${Date.now()}_${file.name}`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = resolveUploadContentType(file);

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(filePath, buffer, { contentType, upsert: false });

  if (uploadError) return { error: uploadError.message };

  const { data: doc, error: dbError } = await supabase
    .from('documents')
    .insert({
      organization_id: orgId,
      uploaded_by: user?.id,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      mime_type: contentType,
      status: 'classified',
      category: resolved.category,
      ai_confidence: 98.0,
      extracted_data: {
        classified_by: 'user',
        document_type: resolved.id,
        document_type_label: resolved.label,
        sector: 'pme',
        original_name: file.name,
      },
    })
    .select()
    .single();

  if (dbError) return { error: dbError.message };

  if (documentTypeId.startsWith('konadata_')) {
    try {
      const { applyTemplateAdaptationToDocument } = await import('@/lib/ai/adapt-from-template');
      await applyTemplateAdaptationToDocument(orgId, doc.id as string, 'pme', documentTypeId, {
        producedDocType: resolved.label,
      });
    } catch {
      /* adaptation IA optionnelle */
    }
  }

  const indexResult = await runDocumentTextIndex(supabase, {
    organizationId: orgId,
    documentId: doc.id as string,
    filePath: doc.file_path as string,
    fileName: doc.file_name as string,
    mimeType: contentType,
    fileBuffer: buffer,
    previousExtracted: (doc.extracted_data as Record<string, unknown>) ?? {},
  });

  revalidatePath('/pme/documents');
  revalidatePath('/pme/rapports');
  revalidatePath('/data-factory');
  return { data: doc, indexing: indexResult };
}

export interface NgoDocumentRow {
  id: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  category: string | null;
  doc_type: string | null;
  doc_type_label: string;
  status: string;
  created_at: string;
  project_id: string | null;
  project_name: string | null;
  aiAdaptation: DocumentAiAdaptation | null;
  captureExtraction: CaptureExtractionResult | null;
}

export interface BtpDocumentRow {
  id: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  category: string | null;
  doc_type: string | null;
  doc_type_label: string;
  status: string;
  created_at: string;
  site_id: string | null;
  site_name: string | null;
  aiAdaptation: DocumentAiAdaptation | null;
  captureExtraction: CaptureExtractionResult | null;
}

export interface PmeDocumentRow {
  id: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  category: string | null;
  doc_type: string | null;
  doc_type_label: string;
  status: string;
  created_at: string;
  captureExtraction: CaptureExtractionResult | null;
}

export async function getNgoDocuments(orgId: string): Promise<NgoDocumentRow[]> {
  const supabase = await createClient();
  const assigned = await getMyAssignedNgoProjectIds();

  const { data: links, error: linkErr } = await supabase
    .from('ngo_project_documents')
    .select('document_id, project_id, doc_type, ngo_projects(name)')
    .eq('organization_id', orgId);

  if (linkErr) throw new Error(linkErr.message);

  const linkByDoc = new Map<
    string,
    { project_id: string; project_name: string; doc_type: string | null }
  >();
  for (const row of links ?? []) {
    const projectName = (row.ngo_projects as { name?: string } | null)?.name ?? '—';
    linkByDoc.set(row.document_id as string, {
      project_id: row.project_id as string,
      project_name: projectName,
      doc_type: (row.doc_type as string) || null,
    });
  }

  const docIds = [...linkByDoc.keys()];
  if (docIds.length === 0) return [];

  const { data: docs, error: docErr } = await supabase
    .from('documents')
    .select(DOCUMENT_LIST_SELECT)
    .eq('organization_id', orgId)
    .in('id', docIds)
    .order('created_at', { ascending: false })
    .limit(DEFAULT_DOCUMENT_LIST_LIMIT);

  if (docErr) throw new Error(docErr.message);

  let rows = (docs ?? []).map((d) => {
    const link = linkByDoc.get(d.id as string);
    const docType = link?.doc_type ?? null;
    const extracted = slimExtractedDataForList(d.extracted_data as Record<string, unknown> | null);
    const typeId = docType ?? (extracted?.document_type as string | undefined) ?? null;
    return {
      id: d.id as string,
      file_name: d.file_name as string,
      file_size: d.file_size as number | null,
      mime_type: d.mime_type as string | null,
      category: d.category as string | null,
      doc_type: typeId,
      doc_type_label:
        String(extracted?.document_type_label ?? '').trim() ||
        getDocumentTypeLabel('ngo', typeId),
      status: d.status as string,
      created_at: d.created_at as string,
      project_id: link?.project_id ?? null,
      project_name: link?.project_name ?? null,
      aiAdaptation: parseDocumentAiAdaptation(extracted),
      captureExtraction: parseCaptureExtraction(extracted),
    };
  });

  if (assigned !== null) {
    const allowed = new Set(assigned);
    rows = rows.filter((r) => r.project_id && allowed.has(r.project_id));
  }

  return rows;
}

export async function getBtpDocuments(orgId: string): Promise<BtpDocumentRow[]> {
  const supabase = await createClient();
  const assigned = await getMyAssignedBtpSiteIds();

  const { data: links, error: linkErr } = await supabase
    .from('btp_site_documents')
    .select('document_id, site_id, doc_type, btp_sites(name)')
    .eq('organization_id', orgId);

  if (linkErr) throw new Error(linkErr.message);

  const linkByDoc = new Map<
    string,
    { site_id: string; site_name: string; doc_type: string | null }
  >();
  for (const row of links ?? []) {
    const siteName = (row.btp_sites as { name?: string } | null)?.name ?? '—';
    linkByDoc.set(row.document_id as string, {
      site_id: row.site_id as string,
      site_name: siteName,
      doc_type: (row.doc_type as string) || null,
    });
  }

  const docIds = [...linkByDoc.keys()];
  if (docIds.length === 0) return [];

  const { data: docs, error: docErr } = await supabase
    .from('documents')
    .select(DOCUMENT_LIST_SELECT)
    .eq('organization_id', orgId)
    .in('id', docIds)
    .order('created_at', { ascending: false })
    .limit(DEFAULT_DOCUMENT_LIST_LIMIT);

  if (docErr) throw new Error(docErr.message);

  let rows = (docs ?? []).map((d) => {
    const link = linkByDoc.get(d.id as string);
    const docType = link?.doc_type ?? null;
    const extracted = slimExtractedDataForList(d.extracted_data as Record<string, unknown> | null);
    const typeId = docType ?? (extracted?.document_type as string | undefined) ?? null;
    return {
      id: d.id as string,
      file_name: d.file_name as string,
      file_size: d.file_size as number | null,
      mime_type: d.mime_type as string | null,
      category: d.category as string | null,
      doc_type: typeId,
      doc_type_label:
        String(extracted?.document_type_label ?? '').trim() ||
        getDocumentTypeLabel('btp', typeId),
      status: d.status as string,
      created_at: d.created_at as string,
      site_id: link?.site_id ?? null,
      site_name: link?.site_name ?? null,
      aiAdaptation: parseDocumentAiAdaptation(extracted),
      captureExtraction: parseCaptureExtraction(extracted),
    };
  });

  if (assigned !== null) {
    const allowed = new Set(assigned);
    rows = rows.filter((r) => r.site_id && allowed.has(r.site_id));
  }

  return rows;
}

export async function getPmeDocuments(orgId: string): Promise<PmeDocumentRow[]> {
  const supabase = await createClient();

  const { data: docs, error } = await supabase
    .from('documents')
    .select(DOCUMENT_LIST_SELECT)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(DEFAULT_DOCUMENT_LIST_LIMIT);

  if (error) throw new Error(error.message);

  return (docs ?? [])
    .filter((d) => {
      const extracted = slimExtractedDataForList(d.extracted_data as Record<string, unknown> | null);
      const sector = extracted?.sector;
      const docType = String(extracted?.document_type ?? '');
      return sector === 'pme' || docType.startsWith('konadata_pme_');
    })
    .map((d) => {
      const extracted = slimExtractedDataForList(d.extracted_data as Record<string, unknown> | null);
      const typeId = (extracted?.document_type as string) ?? null;
      const cap = typeId ? getCaptureStandardById(typeId) : undefined;
      return {
        id: d.id as string,
        file_name: d.file_name as string,
        file_size: d.file_size as number | null,
        mime_type: d.mime_type as string | null,
        category: d.category as string | null,
        doc_type: typeId,
        doc_type_label:
          String(extracted?.document_type_label ?? '').trim() ||
          (cap ? `${cap.label} (KonaData)` : 'Document PME'),
        status: d.status as string,
        created_at: d.created_at as string,
        captureExtraction: parseCaptureExtraction(extracted),
      };
    });
}

export interface DocumentListItem {
  id: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  category: string | null;
  status: string;
  created_at: string;
  extracted_data: Record<string, unknown> | null;
  indexed: boolean;
}

export async function getDocuments(
  orgId: string,
  options?: { limit?: number }
): Promise<DocumentListItem[]> {
  const supabase = await createClient();
  const limit = options?.limit ?? DEFAULT_DOCUMENT_LIST_LIMIT;

  const { data, error } = await supabase
    .from('documents')
    .select(DOCUMENT_LIST_SELECT)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? []).map((d) => {
    const extracted = slimExtractedDataForList(d.extracted_data as Record<string, unknown> | null);
    return {
      id: d.id as string,
      file_name: d.file_name as string,
      file_size: d.file_size as number | null,
      mime_type: d.mime_type as string | null,
      category: d.category as string | null,
      status: d.status as string,
      created_at: d.created_at as string,
      extracted_data: extracted,
      indexed: isDocumentLikelyIndexed(extracted),
    };
  });
}

export async function getDocumentUrl(filePath: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(filePath, 3600);
  if (error) {
    console.error('createSignedUrl', error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}

export async function getOrganizationDocumentUrl(
  documentId: string
): Promise<
  { url: string; fileName: string; mimeType: string | null } | { error: string }
> {
  const id = documentId?.trim();
  if (!id) return { error: 'Document invalide.' };

  let orgId: string;
  try {
    orgId = await requireOrgId();
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Organisation requise.' };
  }

  const supabase = await createClient();
  const { data: doc, error } = await supabase
    .from('documents')
    .select('file_path, file_name, mime_type')
    .eq('id', id)
    .eq('organization_id', orgId)
    .maybeSingle();

  if (error || !doc?.file_path) return { error: 'Document introuvable.' };

  const url = await getDocumentUrl(doc.file_path as string);
  if (!url) {
    return { error: 'Impossible de générer le lien (fichier absent ou accès refusé).' };
  }

  return {
    url,
    fileName: doc.file_name as string,
    mimeType: (doc.mime_type as string) ?? null,
  };
}
