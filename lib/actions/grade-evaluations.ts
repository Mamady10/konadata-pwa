'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireOrgId } from '@/lib/actions/org';
import { getMyTeachingAssignments } from '@/lib/actions/assignments';
import { getSession } from '@/lib/actions/auth';
import { buildSafeDocumentStoragePath } from '@/lib/school/storage-path';
import { resolveUploadContentType } from '@/lib/school/enrollment-upload';
import { GRADE_EVALUATION_MAX_BYTES } from '@/lib/school/grade-evaluation-upload';
import { indexUploadedDocument } from '@/lib/documents/index-uploaded-document';
import type { GradeImportRow } from '@/lib/school/grade-import';
import { MAX_GRADE_IMPORT_ROWS } from '@/lib/school/grade-import';
import type { ReportCardsSuggestion } from '@/lib/school/grades-to-bulletins';

export interface EvaluationKey {
  classId: string;
  subjectId: string;
  examType: string;
  semester: string;
  academicYear: string;
}

export interface EvaluationSettings {
  maxScore: number;
  coefficient: number;
}

export interface GradeGridEntry {
  studentId: string;
  score: number | null;
  maxScore?: number;
  gradeId?: string;
}

export interface GradeEvaluationDocument {
  id: string;
  documentId: string;
  fileName: string;
  mimeType: string | null;
  createdAt: string;
  label: string | null;
  extractionStatus: 'ok' | 'pending' | 'failed' | 'needs_vision';
  charCount: number;
  studentName: string | null;
}

function isMissingCoefficientColumn(message: string | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return m.includes('coefficient') && (m.includes('schema cache') || m.includes('does not exist'));
}

async function assertCanGradeEvaluation(
  orgId: string,
  key: EvaluationKey
): Promise<{ error: string } | null> {
  const supabase = await createClient();
  const { data: cls } = await supabase
    .from('school_classes')
    .select('id')
    .eq('id', key.classId)
    .eq('organization_id', orgId)
    .maybeSingle();
  if (!cls) return { error: 'Classe introuvable.' };

  const { data: sub } = await supabase
    .from('school_subjects')
    .select('id')
    .eq('id', key.subjectId)
    .eq('organization_id', orgId)
    .maybeSingle();
  if (!sub) return { error: 'Matière introuvable.' };

  const teachingSlots = await getMyTeachingAssignments();
  if (
    teachingSlots !== null &&
    !teachingSlots.some(
      (s) => s.classId === key.classId && s.subjectId === key.subjectId
    )
  ) {
    return { error: 'Vous n\'êtes pas autorisé pour cette classe et cette matière.' };
  }

  return null;
}

export async function getGradeEvaluationSettings(
  key: EvaluationKey,
  defaults?: Partial<EvaluationSettings>
): Promise<EvaluationSettings | { error: string }> {
  const orgId = await requireOrgId();
  const guard = await assertCanGradeEvaluation(orgId, key);
  if (guard) return guard;

  const supabase = await createClient();
  let data: { max_score: number | null; coefficient?: number | null } | null = null;
  const full = await supabase
    .from('school_grade_evaluations')
    .select('max_score, coefficient')
    .eq('organization_id', orgId)
    .eq('class_id', key.classId)
    .eq('subject_id', key.subjectId)
    .eq('exam_type', key.examType.trim())
    .eq('semester', key.semester.trim())
    .eq('academic_year', key.academicYear.trim())
    .maybeSingle();

  if (full.error && isMissingCoefficientColumn(full.error.message)) {
    const minimal = await supabase
      .from('school_grade_evaluations')
      .select('max_score')
      .eq('organization_id', orgId)
      .eq('class_id', key.classId)
      .eq('subject_id', key.subjectId)
      .eq('exam_type', key.examType.trim())
      .eq('semester', key.semester.trim())
      .eq('academic_year', key.academicYear.trim())
      .maybeSingle();
    if (!minimal.error) data = minimal.data;
  } else if (!full.error) {
    data = full.data;
  }

  const { normalizeEvaluationCoefficient, normalizeEvaluationMaxScore } = await import(
    '@/lib/school/evaluation-defaults'
  );

  if (data) {
    return {
      maxScore: normalizeEvaluationMaxScore(
        data.max_score,
        defaults?.maxScore ?? 20
      ),
      coefficient: normalizeEvaluationCoefficient(
        data.coefficient ?? defaults?.coefficient ?? 1
      ),
    };
  }

  return {
    maxScore: normalizeEvaluationMaxScore(defaults?.maxScore, 20),
    coefficient: normalizeEvaluationCoefficient(defaults?.coefficient ?? 1),
  };
}

async function upsertEvaluationSettings(
  orgId: string,
  key: EvaluationKey,
  settings: EvaluationSettings,
  evaluationId: string
): Promise<void> {
  const { normalizeEvaluationCoefficient, normalizeEvaluationMaxScore } = await import(
    '@/lib/school/evaluation-defaults'
  );
  const supabase = await createClient();
  const maxScore = normalizeEvaluationMaxScore(settings.maxScore);
  const coefficient = normalizeEvaluationCoefficient(settings.coefficient);

  const patch: Record<string, number> = { max_score: maxScore };
  const withCoef = await supabase
    .from('school_grade_evaluations')
    .update({ max_score: maxScore, coefficient })
    .eq('id', evaluationId)
    .eq('organization_id', orgId);
  if (withCoef.error && isMissingCoefficientColumn(withCoef.error.message)) {
    await supabase
      .from('school_grade_evaluations')
      .update(patch)
      .eq('id', evaluationId)
      .eq('organization_id', orgId);
  }
}

export async function getOrCreateGradeEvaluation(
  key: EvaluationKey,
  settings?: Partial<EvaluationSettings>
): Promise<{ evaluationId: string } | { error: string }> {
  const orgId = await requireOrgId();
  const guard = await assertCanGradeEvaluation(orgId, key);
  if (guard) return guard;

  const supabase = await createClient();
  const session = await getSession();

  const { data: existing } = await supabase
    .from('school_grade_evaluations')
    .select('id')
    .eq('organization_id', orgId)
    .eq('class_id', key.classId)
    .eq('subject_id', key.subjectId)
    .eq('exam_type', key.examType.trim())
    .eq('semester', key.semester.trim())
    .eq('academic_year', key.academicYear.trim())
    .maybeSingle();

  if (existing?.id) return { evaluationId: existing.id as string };

  const { normalizeEvaluationCoefficient, normalizeEvaluationMaxScore } = await import(
    '@/lib/school/evaluation-defaults'
  );
  const maxScore = normalizeEvaluationMaxScore(settings?.maxScore, 20);
  const coefficient = normalizeEvaluationCoefficient(settings?.coefficient ?? 1);

  const insertPayload: Record<string, unknown> = {
    organization_id: orgId,
    class_id: key.classId,
    subject_id: key.subjectId,
    exam_type: key.examType.trim(),
    semester: key.semester.trim(),
    academic_year: key.academicYear.trim(),
    max_score: maxScore,
    coefficient,
    created_by: session?.user?.id ?? null,
  };

  let { data: created, error } = await supabase
    .from('school_grade_evaluations')
    .insert(insertPayload)
    .select('id')
    .single();

  if (error && isMissingCoefficientColumn(error.message)) {
    const { coefficient: _c, ...withoutCoef } = insertPayload;
    const retry = await supabase
      .from('school_grade_evaluations')
      .insert(withoutCoef)
      .select('id')
      .single();
    created = retry.data;
    error = retry.error;
  }

  if (error) {
    if (error.code === '23505') {
      const { data: again } = await supabase
        .from('school_grade_evaluations')
        .select('id')
        .eq('organization_id', orgId)
        .eq('class_id', key.classId)
        .eq('subject_id', key.subjectId)
        .eq('exam_type', key.examType.trim())
        .eq('semester', key.semester.trim())
        .eq('academic_year', key.academicYear.trim())
        .maybeSingle();
      if (again?.id) return { evaluationId: again.id as string };
    }
    return { error: error.message };
  }

  return { evaluationId: created.id as string };
}

export async function getGradesForEvaluation(
  orgId: string,
  key: EvaluationKey
): Promise<Record<string, { id: string; score: number | null; maxScore: number }>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('school_grades')
    .select('id, student_id, score, max_score')
    .eq('organization_id', orgId)
    .eq('class_id', key.classId)
    .eq('subject_id', key.subjectId)
    .eq('exam_type', key.examType.trim())
    .eq('semester', key.semester.trim())
    .eq('academic_year', key.academicYear.trim());

  const map: Record<string, { id: string; score: number | null; maxScore: number }> = {};
  for (const g of data ?? []) {
    map[g.student_id as string] = {
      id: g.id as string,
      score: g.score != null ? Number(g.score) : null,
      maxScore: Number(g.max_score) || 20,
    };
  }
  return map;
}

export interface SaveGradesBatchResult {
  saved: number;
  skipped: number;
  errors: string[];
  reportCards?: ReportCardsSuggestion;
}

export async function saveGradesBatch(
  key: EvaluationKey,
  settings: EvaluationSettings,
  rows: GradeGridEntry[]
): Promise<SaveGradesBatchResult | { error: string }> {
  const orgId = await requireOrgId();
  const guard = await assertCanGradeEvaluation(orgId, key);
  if (guard) return guard;

  if (!rows.length) return { error: 'Aucune note à enregistrer.' };

  const evalResult = await getOrCreateGradeEvaluation(key, settings);
  if ('error' in evalResult) return evalResult;

  await upsertEvaluationSettings(orgId, key, settings, evalResult.evaluationId);

  const supabase = await createClient();
  const existing = await getGradesForEvaluation(orgId, key);
  const { normalizeEvaluationMaxScore } = await import('@/lib/school/evaluation-defaults');
  const defaultMaxScore = normalizeEvaluationMaxScore(settings.maxScore);

  const result: SaveGradesBatchResult = { saved: 0, skipped: 0, errors: [] };

  for (const row of rows) {
    if (row.score === null || row.score === undefined || Number.isNaN(row.score)) {
      result.skipped++;
      continue;
    }

    const maxScore = row.maxScore ?? defaultMaxScore;
    const payload = {
      organization_id: orgId,
      student_id: row.studentId,
      subject_id: key.subjectId,
      class_id: key.classId,
      exam_type: key.examType.trim(),
      semester: key.semester.trim(),
      academic_year: key.academicYear.trim(),
      score: row.score,
      max_score: maxScore,
    };

    const prev = existing[row.studentId];
    if (prev?.id) {
      const { error } = await supabase
        .from('school_grades')
        .update({ score: row.score, max_score: maxScore })
        .eq('id', prev.id)
        .eq('organization_id', orgId);
      if (error) result.errors.push(error.message);
      else result.saved++;
    } else {
      const { error } = await supabase.from('school_grades').insert(payload);
      if (error) result.errors.push(error.message);
      else result.saved++;
    }
  }

  revalidatePath('/etablissement/resultats');
  revalidatePath('/etablissement/bulletins');

  const { autoGenerateReportCardsAfterGrades } = await import(
    '@/lib/school/grades-to-bulletins'
  );
  result.reportCards = await autoGenerateReportCardsAfterGrades(
    orgId,
    key.classId,
    key.semester.trim(),
    key.academicYear.trim(),
    { auto: true }
  );

  return result;
}

export async function importGradesFromFile(
  key: EvaluationKey,
  settings: EvaluationSettings,
  importRows: GradeImportRow[],
  students: Array<{ id: string; matricule?: string; full_name: string }>
): Promise<SaveGradesBatchResult | { error: string }> {
  if (!importRows.length) return { error: 'Fichier vide.' };
  if (importRows.length > MAX_GRADE_IMPORT_ROWS) {
    return { error: `Maximum ${MAX_GRADE_IMPORT_ROWS} lignes par fichier.` };
  }

  const byMatricule = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const s of students) {
    if (s.matricule) byMatricule.set(s.matricule.trim().toUpperCase(), s.id);
    byName.set(s.full_name.trim().toLowerCase(), s.id);
  }

  const grid: GradeGridEntry[] = [];
  const unmatched: string[] = [];

  for (const row of importRows) {
    let studentId: string | undefined;
    if (row.matricule) {
      studentId = byMatricule.get(row.matricule.trim().toUpperCase());
    }
    if (!studentId && row.full_name) {
      studentId = byName.get(row.full_name.trim().toLowerCase());
    }
    if (!studentId) {
      unmatched.push(`Ligne ${row.sourceLine}`);
      continue;
    }
    grid.push({
      studentId,
      score: row.score,
      maxScore: row.max_score ?? settings.maxScore,
    });
  }

  const batch = await saveGradesBatch(key, settings, grid);
  if ('error' in batch) return batch;
  if (unmatched.length) {
    batch.errors.push(
      `${unmatched.length} ligne(s) sans élève correspondant (vérifiez matricule/nom).`
    );
  }
  return batch;
}

export async function listGradeEvaluationDocuments(
  key: EvaluationKey
): Promise<GradeEvaluationDocument[] | { error: string }> {
  const orgId = await requireOrgId();
  const guard = await assertCanGradeEvaluation(orgId, key);
  if (guard) return guard;

  const supabase = await createClient();
  const { data: ev } = await supabase
    .from('school_grade_evaluations')
    .select('id')
    .eq('organization_id', orgId)
    .eq('class_id', key.classId)
    .eq('subject_id', key.subjectId)
    .eq('exam_type', key.examType.trim())
    .eq('semester', key.semester.trim())
    .eq('academic_year', key.academicYear.trim())
    .maybeSingle();

  if (!ev?.id) return [];

  const { data, error } = await supabase
    .from('school_grade_evaluation_documents')
    .select('id, document_id, label, created_at, documents(file_name, mime_type, search_text, extracted_data)')
    .eq('evaluation_id', ev.id)
    .order('created_at', { ascending: false });

  if (error) return { error: error.message };

  return (data ?? []).map((row) => {
    const doc = row.documents as {
      file_name?: string;
      mime_type?: string | null;
      search_text?: string | null;
      extracted_data?: Record<string, unknown>;
    } | null;
    const charCount = (doc?.search_text as string)?.length ?? 0;
    const status = doc?.extracted_data?.extraction_status as string | undefined;
    const mime = (doc?.mime_type ?? '').toLowerCase();
    const isImage = mime.startsWith('image/');
    let extractionStatus: GradeEvaluationDocument['extractionStatus'] = 'pending';
    if (charCount > 20) extractionStatus = 'ok';
    else if (status === 'failed' || status === 'partial') {
      extractionStatus = isImage ? 'needs_vision' : 'failed';
    }
    const hb = doc?.extracted_data?.handwritten_bulletin as { studentName?: string } | undefined;
    return {
      id: row.id as string,
      documentId: row.document_id as string,
      fileName: doc?.file_name ?? 'Fichier',
      mimeType: doc?.mime_type ?? null,
      createdAt: row.created_at as string,
      label: (row.label as string) ?? null,
      extractionStatus,
      charCount,
      studentName: hb?.studentName ?? null,
    };
  });
}

export async function uploadGradeEvaluationDocument(
  key: EvaluationKey,
  formData: FormData
): Promise<{ success: true } | { error: string }> {
  const orgId = await requireOrgId();
  const guard = await assertCanGradeEvaluation(orgId, key);
  if (guard) return guard;

  const file = formData.get('file') as File | null;
  if (!file?.size) return { error: 'Fichier requis.' };
  if (file.size > GRADE_EVALUATION_MAX_BYTES) {
    return { error: 'Fichier trop volumineux (max 50 Mo).' };
  }

  const evalResult = await getOrCreateGradeEvaluation(key);
  if ('error' in evalResult) return evalResult;

  const supabase = await createClient();
  const session = await getSession();
  const label = ((formData.get('label') as string) || file.name).trim();

  const { storagePath: filePath, displayName } = buildSafeDocumentStoragePath(orgId, file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  const contentType = resolveUploadContentType(file);

  const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, buffer, {
    contentType,
    upsert: false,
  });
  if (uploadError) return { error: uploadError.message };

  const { data: doc, error: docErr } = await supabase
    .from('documents')
    .insert({
      organization_id: orgId,
      uploaded_by: session?.user?.id ?? null,
      file_name: displayName,
      file_path: filePath,
      file_size: file.size,
      mime_type: contentType,
      status: 'classified',
      category: 'school_report',
      metadata: {
        grade_evaluation: {
          class_id: key.classId,
          subject_id: key.subjectId,
          exam_type: key.examType,
          semester: key.semester,
          academic_year: key.academicYear,
        },
      },
    })
    .select('id')
    .single();

  if (docErr || !doc?.id) {
    return { error: docErr?.message ?? 'Erreur enregistrement document.' };
  }

  const { error: linkErr } = await supabase.from('school_grade_evaluation_documents').insert({
    evaluation_id: evalResult.evaluationId,
    organization_id: orgId,
    document_id: doc.id,
    label: label || null,
  });

  if (linkErr) return { error: linkErr.message };

  await indexUploadedDocument(supabase, {
    organizationId: orgId,
    documentId: doc.id,
    filePath,
    fileName: displayName,
    mimeType: contentType,
    fileBuffer: buffer,
    previousExtracted: {
      grade_evaluation: {
        class_id: key.classId,
        subject_id: key.subjectId,
        exam_type: key.examType,
        semester: key.semester,
        academic_year: key.academicYear,
      },
    },
  });

  revalidatePath('/etablissement/resultats');
  return { success: true };
}

export async function deleteGradeEvaluationDocument(
  linkId: string
): Promise<{ success: true } | { error: string }> {
  const orgId = await requireOrgId();
  const supabase = await createClient();

  const { data: link } = await supabase
    .from('school_grade_evaluation_documents')
    .select('id, document_id, evaluation_id')
    .eq('id', linkId)
    .eq('organization_id', orgId)
    .maybeSingle();

  if (!link) return { error: 'Pièce jointe introuvable.' };

  const { error } = await supabase
    .from('school_grade_evaluation_documents')
    .delete()
    .eq('id', linkId)
    .eq('organization_id', orgId);

  if (error) return { error: error.message };
  revalidatePath('/etablissement/resultats');
  return { success: true };
}
