'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { canManageAssignments } from '@/lib/actions/assignments';
import { saveAiGeneratedReport } from '@/lib/actions/ai-report-archive';
import { requireOrgId } from '@/lib/actions/org';
import { getSession } from '@/lib/actions/auth';
import {
  ensureScanDocumentExtracted,
  generateBulletinFromScannedDocument,
} from '@/lib/ai/production/generate-from-scan';
import { getMyTeachingAssignments } from '@/lib/actions/assignments';
import { getStudents } from '@/lib/actions/school';
import { personName } from '@/lib/school/person-utils';
import type { ParsedHandwrittenBulletin } from '@/lib/ai/school/handwritten-bulletin';

export type GradeScanDocumentRow = {
  linkId: string;
  documentId: string;
  fileName: string;
  label: string | null;
  createdAt: string;
  className: string;
  subjectName: string;
  examType: string;
  extractionStatus: 'ok' | 'pending' | 'failed' | 'needs_vision';
  charCount: number;
  studentName: string | null;
};

async function requireDirector(): Promise<{ error: string } | { ok: true }> {
  if (!(await canManageAssignments())) {
    return { error: 'Réservé au directeur / fondateur / admin organisation.' };
  }
  return { ok: true };
}

export async function listGradeScanDocumentsForDirector(): Promise<
  GradeScanDocumentRow[] | { error: string }
> {
  const guard = await requireDirector();
  if ('error' in guard) return guard;

  const orgId = await requireOrgId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('school_grade_evaluation_documents')
    .select(
      `id, label, created_at, document_id, evaluation_id,
       documents(file_name, search_text, extracted_data, mime_type)`
    )
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(40);

  if (error) return { error: error.message };

  const evalIds = [...new Set((data ?? []).map((r) => r.evaluation_id as string))];
  const evalMap = new Map<
    string,
    { exam_type?: string; class_id?: string; subject_id?: string }
  >();
  if (evalIds.length) {
    const { data: evals } = await supabase
      .from('school_grade_evaluations')
      .select('id, exam_type, class_id, subject_id')
      .in('id', evalIds);
    for (const e of evals ?? []) evalMap.set(e.id as string, e);
  }

  const classIds = [...new Set([...evalMap.values()].map((e) => e.class_id).filter(Boolean))];
  const subjectIds = [...new Set([...evalMap.values()].map((e) => e.subject_id).filter(Boolean))];
  const classNames = new Map<string, string>();
  const subjectNames = new Map<string, string>();
  if (classIds.length) {
    const { data: classes } = await supabase.from('school_classes').select('id, name').in('id', classIds);
    for (const c of classes ?? []) classNames.set(c.id as string, c.name as string);
  }
  if (subjectIds.length) {
    const { data: subs } = await supabase.from('school_subjects').select('id, name').in('id', subjectIds);
    for (const s of subs ?? []) subjectNames.set(s.id as string, s.name as string);
  }

  return (data ?? []).map((row) => {
    const doc = row.documents as {
      file_name?: string;
      search_text?: string | null;
      extracted_data?: Record<string, unknown>;
      mime_type?: string | null;
    } | null;
    const ev = evalMap.get(row.evaluation_id as string);

    const charCount = (doc?.search_text as string)?.length ?? 0;
    const method = doc?.extracted_data?.extraction_method as string | undefined;
    const status = doc?.extracted_data?.extraction_status as string | undefined;
    const mime = (doc?.mime_type ?? '').toLowerCase();
    const isImage = mime.startsWith('image/');

    let extractionStatus: GradeScanDocumentRow['extractionStatus'] = 'pending';
    if (charCount > 20) extractionStatus = 'ok';
    else if (status === 'failed' || status === 'partial') {
      extractionStatus = isImage ? 'needs_vision' : 'failed';
    } else if (method === 'vision' && charCount < 20) extractionStatus = 'needs_vision';

    const hb = doc?.extracted_data?.handwritten_bulletin as ParsedHandwrittenBulletin | undefined;

    return {
      linkId: row.id as string,
      documentId: row.document_id as string,
      fileName: doc?.file_name ?? 'Fichier',
      label: (row.label as string) ?? null,
      createdAt: row.created_at as string,
      className: ev?.class_id ? classNames.get(ev.class_id) ?? '—' : '—',
      subjectName: ev?.subject_id ? subjectNames.get(ev.subject_id) ?? '—' : '—',
      examType: ev?.exam_type ?? '—',
      extractionStatus,
      charCount,
      studentName: hb?.studentName ?? null,
    };
  });
}

export type GenerateFromScanResult =
  | { error: string }
  | {
      content: string;
      usedLlm: boolean;
      title: string;
      archiveId: string;
      reportPath: string;
      parsedStudent: string | null;
      subjectsCount: number;
    };

export async function generateAndArchiveBulletinFromScan(
  documentId: string
): Promise<GenerateFromScanResult> {
  const guard = await requireDirector();
  if ('error' in guard) return guard;

  const session = await getSession();
  const org = session?.profile?.organizations as { name?: string } | null;
  const orgId = await requireOrgId();

  const generated = await generateBulletinFromScannedDocument({
    orgId,
    orgName: org?.name?.trim() || 'Établissement',
    documentId,
  });

  if ('error' in generated) return generated;

  const saved = await saveAiGeneratedReport({
    sector: 'school',
    scopeId: generated.scopeId,
    scopeLabel: generated.scopeLabel,
    reportType: generated.templatePurpose,
    reportTypeLabel: generated.reportTypeLabel,
    title: generated.title,
    subtitle: generated.subtitle,
    content: generated.content,
    usedLlm: generated.usedLlm,
  });

  if ('error' in saved) return saved;

  revalidatePath('/etablissement/rapports');
  revalidatePath('/etablissement/bulletins');
  revalidatePath('/etablissement/resultats');

  return {
    content: generated.content,
    usedLlm: generated.usedLlm,
    title: generated.title,
    archiveId: saved.id,
    reportPath: '/etablissement/rapports',
    parsedStudent: generated.parsed.studentName,
    subjectsCount: generated.parsed.subjects.length,
  };
}

export async function reindexGradeScanDocument(
  documentId: string
): Promise<{ ok: true; charCount: number; message?: string } | { error: string }> {
  const orgId = await requireOrgId();
  const isDirector = await canManageAssignments();
  const teaching = await getMyTeachingAssignments();

  if (!isDirector && teaching === null) {
    return { error: 'Non autorisé.' };
  }

  const result = await ensureScanDocumentExtracted(orgId, documentId);
  if ('error' in result) return result;

  revalidatePath('/etablissement/resultats');
  return { ok: true, charCount: result.text.length, message: result.message };
}

/** Écrit les notes extraites du scan dans school_grades (validation direction). */
export async function applyScanGradesToDatabase(
  documentId: string
): Promise<
  | { saved: number; skipped: number; reportCards?: import('@/lib/school/grades-to-bulletins').ReportCardsSuggestion }
  | { error: string }
> {
  const guard = await requireDirector();
  if ('error' in guard) return guard;

  const orgId = await requireOrgId();
  const supabase = await createClient();

  const { data: link } = await supabase
    .from('school_grade_evaluation_documents')
    .select('evaluation_id, documents(extracted_data)')
    .eq('organization_id', orgId)
    .eq('document_id', documentId)
    .maybeSingle();

  if (!link) return { error: 'Document d\'évaluation introuvable.' };

  const { data: ev } = await supabase
    .from('school_grade_evaluations')
    .select('class_id, subject_id, exam_type, semester, academic_year')
    .eq('id', link.evaluation_id as string)
    .maybeSingle();

  const doc = link.documents as { extracted_data?: Record<string, unknown> } | null;
  const parsed = doc?.extracted_data?.handwritten_bulletin as ParsedHandwrittenBulletin | undefined;

  if (!parsed?.subjects?.length) {
    return {
      error:
        'Aucune note structurée sur ce scan. Produisez d\'abord le bulletin IA ou relancez l\'extraction.',
    };
  }

  if (!ev?.class_id) return { error: 'Classe manquante sur l\'évaluation.' };

  const studentName = parsed.studentName?.trim();
  const matriculeHint = (parsed as { matricule?: string }).matricule?.trim();

  const allStudents = await getStudents(orgId);
  let studentId: string | null = null;

  if (matriculeHint) {
    const hit = allStudents.find(
      (s) =>
        (s.class_id as string) === ev.class_id &&
        String(s.matricule ?? '')
          .trim()
          .toUpperCase() === matriculeHint.toUpperCase()
    );
    if (hit) studentId = hit.id as string;
  }

  if (!studentId && studentName) {
    const normalized = studentName.toLowerCase();
    const firstToken = normalized.split(/\s+/)[0] ?? normalized;
    for (const s of allStudents) {
      if ((s.class_id as string) !== ev.class_id) continue;
      const name = personName(s).toLowerCase();
      if (name.includes(normalized) || name.includes(firstToken)) {
        studentId = s.id as string;
        break;
      }
    }
  }

  if (!studentName && !studentId) {
    return { error: 'Nom ou matricule d\'élève introuvable sur le scan.' };
  }

  if (!studentId) {
    return {
      error: `Élève « ${studentName ?? matriculeHint ?? '?'} » introuvable dans la classe. Inscrivez-le d'abord.`,
    };
  }

  const { data: subjects } = await supabase
    .from('school_subjects')
    .select('id, name')
    .eq('organization_id', orgId);

  const subjectByName = new Map(
    (subjects ?? []).map((s) => [(s.name as string).toLowerCase(), s.id as string])
  );

  let saved = 0;
  let skipped = 0;

  for (const row of parsed.subjects) {
    const subjectId =
      subjectByName.get(row.name.toLowerCase()) ?? (ev.subject_id as string | undefined);
    if (!subjectId) {
      skipped++;
      continue;
    }

    const payload = {
      organization_id: orgId,
      student_id: studentId,
      subject_id: subjectId,
      class_id: ev.class_id,
      exam_type: ev.exam_type ?? parsed.period ?? 'Scan',
      semester: ev.semester ?? 'S1',
      academic_year: ev.academic_year ?? parsed.academicYear ?? '2025-2026',
      score: row.score,
      max_score: row.maxScore ?? 20,
    };

    const { data: existing } = await supabase
      .from('school_grades')
      .select('id')
      .eq('organization_id', orgId)
      .eq('student_id', studentId)
      .eq('subject_id', subjectId)
      .eq('class_id', ev.class_id)
      .eq('exam_type', payload.exam_type)
      .eq('semester', payload.semester)
      .eq('academic_year', payload.academic_year)
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from('school_grades')
        .update({ score: row.score, max_score: row.maxScore ?? 20 })
        .eq('id', existing.id);
    } else {
      await supabase.from('school_grades').insert(payload);
    }
    saved++;
  }

  revalidatePath('/etablissement/resultats');
  revalidatePath('/etablissement/bulletins');

  const semester = (ev.semester as string) ?? 'S1';
  const academicYear = (ev.academic_year as string) ?? '2025-2026';
  const { autoGenerateReportCardsAfterGrades } = await import(
    '@/lib/school/grades-to-bulletins'
  );
  const reportCards = await autoGenerateReportCardsAfterGrades(
    orgId,
    ev.class_id as string,
    semester,
    academicYear,
    { auto: true }
  );

  return { saved, skipped, reportCards };
}
