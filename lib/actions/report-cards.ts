'use server';

import JSZip from 'jszip';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { canManageAssignments } from '@/lib/school/permissions';
import { requireOrgId } from '@/lib/actions/org';
import {
  generateReportCardPdfBuffer,
  reportCardPdfFileName,
  type ReportCardGradeLine,
  type ReportCardPdfInput,
} from '@/lib/school/report-card-pdf';
import { buildReportCardGradeLines } from '@/lib/school/build-report-card-grades';
import {
  fetchOrgLogoForBulletin,
  fetchOrgStampForBulletin,
} from '@/lib/school/fetch-org-branding';
import { parseBulletinTemplate, parseSchoolBranding } from '@/lib/school/bulletin-template';
import { personName } from '@/lib/school/person-utils';
import { notifyBulletinPublished } from '@/lib/school/enrollment-notifications';
import { suggestCouncilAppreciation } from '@/lib/school/council-appreciation';
import { buildSafeDocumentStoragePath } from '@/lib/school/storage-path';
import { evaluateReportCardReadiness } from '@/lib/school/grades-to-bulletins';
import { parseSchoolOrgSettings } from '@/lib/school/school-org-settings';
import { loadGradeGapReportForClass } from '@/lib/school/load-grade-gap-report';
import { summarizeGradeGaps } from '@/lib/school/grade-gaps';
import {
  BULLETIN_EXAM_TYPE_PRESETS,
  formatIncludedExamTypesLabel,
  mergeDistinctExamTypes,
  parseIncludedExamTypes,
} from '@/lib/school/bulletin-exam-types';
import {
  parseEducationLevelBand,
  subjectMatchesClassBand,
} from '@/lib/school/education-level-catalog';
import {
  gradingPeriodLabel,
  resolveGradingPolicyForClass,
} from '@/lib/school/grading-period-settings';
import { revalidatePath } from 'next/cache';

const STUDENT_NESTED = 'matricule, enrollment_status, person_id, core_persons(full_name, phone)';

export type ReportCardPdfDownload =
  | { error: string }
  | { base64: string; fileName: string };

function brandingConfigured(
  tpl: ReturnType<typeof parseBulletinTemplate>,
  branding: ReturnType<typeof parseSchoolBranding>
): { hasLogoConfig: boolean; hasStampConfig: boolean } {
  return {
    hasLogoConfig: Boolean(
      branding.logo_pdf_cache?.base64?.trim() ||
        branding.logo_storage_path?.trim()
    ),
    hasStampConfig: Boolean(
      tpl.stamp?.pdf_cache?.base64?.trim() || tpl.stamp?.document_id?.trim()
    ),
  };
}

function validateBulletinBranding(
  tpl: ReturnType<typeof parseBulletinTemplate>,
  branding: ReturnType<typeof parseSchoolBranding>,
  hasLogo: boolean,
  hasStamp: boolean
): string | null {
  const { hasLogoConfig, hasStampConfig } = brandingConfigured(tpl, branding);

  if (tpl.require_logo && !hasLogoConfig) {
    return 'Bulletin incomplet : joignez le logo dans Paramètres → Modèle bulletin.';
  }
  if (tpl.require_stamp && !hasStampConfig) {
    return 'Bulletin incomplet : joignez le cachet dans Paramètres → Modèle bulletin.';
  }
  if (tpl.require_logo && hasLogoConfig && !hasLogo) {
    return 'Logo enregistré mais illisible — rechargez le fichier (PNG/JPEG) dans Paramètres → Modèle bulletin.';
  }
  if (tpl.require_stamp && hasStampConfig && !hasStamp) {
    return 'Cachet enregistré mais illisible — rechargez le fichier dans Paramètres → Modèle bulletin.';
  }
  return null;
}

async function enrichPdfInputWithBranding(
  input: ReportCardPdfInput,
  orgId: string,
  settings: Record<string, unknown> | null | undefined
): Promise<ReportCardPdfInput | { error: string }> {
  const supabase = await createClient();
  const tpl = input.template ?? parseBulletinTemplate(settings);
  const branding = parseSchoolBranding(settings);

  const logo = await fetchOrgLogoForBulletin(
    supabase,
    input.organizationLogoUrl,
    branding.logo_storage_path,
    branding.logo_pdf_cache
  );
  const stamp = await fetchOrgStampForBulletin(supabase, tpl.stamp);

  const brandingErr = validateBulletinBranding(
    tpl,
    branding,
    Boolean(logo),
    Boolean(stamp)
  );
  if (brandingErr) return { error: brandingErr };

  return {
    ...input,
    organizationLogo: logo,
    organizationStamp: stamp,
    template: tpl,
  };
}

async function loadReportCardContext(
  cardId: string,
  orgId: string,
  useServiceClient = false
) {
  const supabase = useServiceClient ? await createServiceClient() : await createClient();

  const { data: card, error } = await supabase
    .from('school_report_cards')
    .select(`*, school_students(${STUDENT_NESTED}), school_classes(name, level, education_level_band)`)
    .eq('id', cardId)
    .eq('organization_id', orgId)
    .single();

  if (error || !card) return { error: error?.message ?? 'Bulletin introuvable' };

  const { data: org } = await supabase
    .from('organizations')
    .select('name, logo_url, settings, address')
    .eq('id', orgId)
    .maybeSingle();

  const { parseSchoolOrgSettings } = await import('@/lib/school/school-org-settings');
  const { parseMepsSettings } = await import('@/lib/school/meps-settings');
  const schoolSettings = parseSchoolOrgSettings(
    (org?.settings as Record<string, unknown>) ?? null
  );
  const meps = parseMepsSettings(
    (org?.settings as Record<string, unknown>) ?? null,
    (org?.address as string) ?? null
  );
  const establishmentMeta = [meps.commune, meps.prefecture, meps.circonscription]
    .filter(Boolean)
    .join(' · ');

  const tpl = schoolSettings.bulletin_template;

  const classRow = card.school_classes as {
    name?: string;
    level?: string;
    education_level_band?: string;
  } | null;
  const classBand = parseEducationLevelBand(classRow?.education_level_band);

  const [{ data: subjects }, { data: grades }] = await Promise.all([
    supabase
      .from('school_subjects')
      .select('id, name, coefficient, education_level_band')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('school_grades')
      .select('subject_id, exam_type, score, max_score, school_subjects(name, coefficient)')
      .eq('organization_id', orgId)
      .eq('student_id', card.student_id)
      .eq('class_id', card.class_id)
      .eq('semester', card.semester)
      .eq('academic_year', card.academic_year),
  ]);

  const includedExamTypes = parseIncludedExamTypes(card.included_exam_types);
  const includedExamTypesLabel = formatIncludedExamTypesLabel(includedExamTypes);

  const scopedSubjects = (subjects ?? []).filter((s) =>
    subjectMatchesClassBand(
      parseEducationLevelBand(s.education_level_band),
      classBand,
      classRow?.level ?? null
    )
  );

  const gradeLines: ReportCardGradeLine[] = buildReportCardGradeLines(
    scopedSubjects.map((s) => ({
      id: s.id as string,
      name: s.name as string,
      coefficient: Number(s.coefficient ?? 1),
    })),
    (grades ?? []).map((g) => ({
      subject_id: g.subject_id as string,
      exam_type: g.exam_type as string | undefined,
      score: Number(g.score),
      max_score: Number(g.max_score),
      school_subjects: g.school_subjects as { name?: string; coefficient?: number } | null,
    })),
    tpl.show_all_subjects,
    includedExamTypes,
    tpl.show_evaluation_details
  );

  const { count: classSize } = await supabase
    .from('school_report_cards')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('class_id', card.class_id)
    .eq('semester', card.semester)
    .eq('academic_year', card.academic_year);

  const student = card.school_students as Record<string, unknown>;

  return {
    card,
    orgSettings: (org?.settings as Record<string, unknown>) ?? null,
    pdfInput: {
      organizationName: org?.name ?? 'Établissement',
      organizationLogoUrl: (org?.logo_url as string) ?? null,
      orgAddress: (org?.address as string) ?? null,
      establishmentMeta: establishmentMeta || null,
      template: schoolSettings.bulletin_template,
      studentName: personName(student),
      matricule: (student.matricule as string) ?? null,
      className: classRow?.name ?? '—',
      semester: card.semester as string,
      academicYear: card.academic_year as string,
      averageScore: card.average_score != null ? Number(card.average_score) : null,
      rank: card.rank != null ? Number(card.rank) : null,
      classSize: classSize ?? 0,
      appreciation: (card.appreciation as string) ?? null,
      grades: gradeLines,
      publicationStatus: (card.publication_status as 'draft' | 'final') ?? 'draft',
      periodLabel: gradingPeriodLabel(
        resolveGradingPolicyForClass(
          schoolSettings.grading_period_by_level,
          classRow?.level ?? null,
          classBand
        ),
        card.semester as string
      ),
      includedExamTypesLabel,
    },
  };
}

async function readArchivedReportCardPdf(
  filePath: string,
  useServiceClient: boolean
): Promise<{ base64: string } | { error: string }> {
  const supabase = useServiceClient ? await createServiceClient() : await createClient();
  const { data, error } = await supabase.storage.from('documents').download(filePath);
  if (error || !data) return { error: error?.message ?? 'PDF archivé introuvable' };
  const buffer = Buffer.from(await data.arrayBuffer());
  return { base64: buffer.toString('base64') };
}

async function archiveReportCardPdf(
  cardId: string,
  orgId: string,
  useServiceClient = false
): Promise<{ filePath: string } | { error: string }> {
  const pdf = await generateReportCardPdfForCard(cardId, orgId, useServiceClient, {
    skipArchive: true,
  });
  if ('error' in pdf) return pdf;

  const buffer = Buffer.from(pdf.base64, 'base64');
  const supabase = useServiceClient ? await createServiceClient() : await createClient();
  const { storagePath } = buildSafeDocumentStoragePath(orgId, pdf.fileName);

  const { error: uploadError } = await supabase.storage.from('documents').upload(storagePath, buffer, {
    contentType: 'application/pdf',
    upsert: true,
  });
  if (uploadError) return { error: uploadError.message };

  const { error: updateError } = await supabase
    .from('school_report_cards')
    .update({
      file_path: storagePath,
      archived_pdf_at: new Date().toISOString(),
    })
    .eq('id', cardId)
    .eq('organization_id', orgId);

  if (updateError) return { error: updateError.message };
  return { filePath: storagePath };
}

export async function generateReportCardPdfForCard(
  cardId: string,
  orgId: string,
  useServiceClient = false,
  options?: { skipArchive?: boolean }
) {
  const supabase = useServiceClient ? await createServiceClient() : await createClient();

  if (!options?.skipArchive) {
    const { data: meta } = await supabase
      .from('school_report_cards')
      .select('publication_status, file_path')
      .eq('id', cardId)
      .eq('organization_id', orgId)
      .maybeSingle();

    if (
      meta?.publication_status === 'final' &&
      typeof meta.file_path === 'string' &&
      meta.file_path.trim()
    ) {
      const archived = await readArchivedReportCardPdf(meta.file_path, useServiceClient);
      if (!('error' in archived)) {
        const ctx = await loadReportCardContext(cardId, orgId, useServiceClient);
        if ('error' in ctx) return ctx;
        return {
          base64: archived.base64,
          fileName: reportCardPdfFileName(
            ctx.pdfInput.studentName,
            ctx.pdfInput.semester,
            'final'
          ),
          archived: true,
        };
      }
    }
  }

  const ctx = await loadReportCardContext(cardId, orgId, useServiceClient);
  if ('error' in ctx) return ctx;

  const enriched = await enrichPdfInputWithBranding(ctx.pdfInput, orgId, ctx.orgSettings);
  if ('error' in enriched) return enriched;
  const pdfInput = enriched;
  const buffer = generateReportCardPdfBuffer(pdfInput);
  return {
    base64: Buffer.from(buffer).toString('base64'),
    fileName: reportCardPdfFileName(
      pdfInput.studentName,
      pdfInput.semester,
      pdfInput.publicationStatus
    ),
    archived: false,
  };
}

export async function getReportCardPdfBase64(cardId: string): Promise<ReportCardPdfDownload> {
  const orgId = await requireOrgId();
  return generateReportCardPdfForCard(cardId, orgId);
}

async function assertGradeGapsOrForce(params: {
  orgId: string;
  classId: string;
  semester: string;
  academicYear: string;
  force?: boolean;
  includedExamTypes?: string[] | null;
}) {
  const supabase = await createClient();
  const { data: org } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', params.orgId)
    .maybeSingle();
  const schoolSettings = parseSchoolOrgSettings(
    (org?.settings as Record<string, unknown>) ?? null
  );
  const gapReport = await loadGradeGapReportForClass(
    params.orgId,
    params.classId,
    params.semester,
    params.academicYear,
    schoolSettings.grading_period_by_level,
    params.includedExamTypes
  );
  if (gapReport.hasGaps && !params.force) {
    const typeNote = params.includedExamTypes?.length
      ? ` (types retenus : ${params.includedExamTypes.join(', ')})`
      : '';
    return {
      needsConfirmation: true as const,
      gapReport,
      gapSummary: summarizeGradeGaps(gapReport),
      message: `${gapReport.studentsWithGaps} élève(s) ont des notes manquantes${typeNote}. Vous pouvez continuer l'export si vous le souhaitez.`,
    };
  }
  return null;
}

export async function listClassBulletinExamTypes(params: {
  classId: string;
  semester: string;
  academicYear: string;
}) {
  const orgId = await requireOrgId();
  const canManage = await canManageAssignments();
  if (!canManage) return { error: 'Non autorisé' as const };

  const supabase = await createClient();
  const [{ data: evaluations }, { data: grades }] = await Promise.all([
    supabase
      .from('school_grade_evaluations')
      .select('exam_type')
      .eq('organization_id', orgId)
      .eq('class_id', params.classId)
      .eq('semester', params.semester)
      .eq('academic_year', params.academicYear),
    supabase
      .from('school_grades')
      .select('exam_type')
      .eq('organization_id', orgId)
      .eq('class_id', params.classId)
      .eq('semester', params.semester)
      .eq('academic_year', params.academicYear),
  ]);

  const examTypes = mergeDistinctExamTypes(
    [...BULLETIN_EXAM_TYPE_PRESETS],
    (evaluations ?? []).map((e) => e.exam_type as string),
    (grades ?? []).map((g) => g.exam_type as string)
  );

  return { examTypes };
}

export async function getReportCardGradeGaps(params: {
  classId: string;
  semester: string;
  academicYear: string;
}) {
  const orgId = await requireOrgId();
  const canManage = await canManageAssignments();
  if (!canManage) return { error: 'Non autorisé' };

  const supabase = await createClient();
  const { data: org } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', orgId)
    .maybeSingle();
  const schoolSettings = parseSchoolOrgSettings(
    (org?.settings as Record<string, unknown>) ?? null
  );

  const gapReport = await loadGradeGapReportForClass(
    orgId,
    params.classId,
    params.semester,
    params.academicYear,
    schoolSettings.grading_period_by_level
  );

  return {
    gapReport,
    gapSummary: summarizeGradeGaps(gapReport, 20),
    policyByLevel: schoolSettings.grading_period_by_level,
  };
}

export async function exportClassReportCardsZip(params: {
  classId: string;
  semester: string;
  academicYear: string;
  force?: boolean;
  includedExamTypes?: string[] | null;
}) {
  const orgId = await requireOrgId();
  const canManage = await canManageAssignments();
  if (!canManage) return { error: 'Seuls les directeurs peuvent exporter les bulletins.' };

  const includedExamTypes = parseIncludedExamTypes(params.includedExamTypes);
  const gapBlock = await assertGradeGapsOrForce({
    orgId,
    classId: params.classId,
    semester: params.semester,
    academicYear: params.academicYear,
    force: params.force,
    includedExamTypes,
  });
  if (gapBlock) return gapBlock;

  const supabase = await createClient();
  const { data: cards } = await supabase
    .from('school_report_cards')
    .select(`id, school_students(core_persons(full_name))`)
    .eq('organization_id', orgId)
    .eq('class_id', params.classId)
    .eq('semester', params.semester)
    .eq('academic_year', params.academicYear);

  if (!cards?.length) return { error: 'Aucun bulletin pour cette classe et période' };

  const zip = new JSZip();
  for (const row of cards) {
    const ctx = await loadReportCardContext(row.id as string, orgId);
    if ('error' in ctx) continue;
    const enriched = await enrichPdfInputWithBranding(ctx.pdfInput, orgId, ctx.orgSettings);
    if ('error' in enriched) return enriched;
    const pdfInput = enriched;
    const buffer = generateReportCardPdfBuffer(pdfInput);
    const name = reportCardPdfFileName(
      ctx.pdfInput.studentName,
      ctx.pdfInput.semester,
      ctx.pdfInput.publicationStatus
    );
    zip.file(name, buffer);
  }

  const zipBuffer = await zip.generateAsync({ type: 'uint8array' });
  const { data: cls } = await supabase
    .from('school_classes')
    .select('name')
    .eq('id', params.classId)
    .maybeSingle();

  const safeClass = String(cls?.name ?? 'classe')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .slice(0, 30);

  return {
    base64: Buffer.from(zipBuffer).toString('base64'),
    fileName: `bulletins_${safeClass}_${params.semester}_${params.academicYear}.zip`,
    count: cards.length,
  };
}

export async function publishReportCards(params: {
  classId: string;
  semester: string;
  academicYear: string;
  mode: 'draft' | 'final';
  sendSms?: boolean;
  force?: boolean;
  includedExamTypes?: string[] | null;
}) {
  const orgId = await requireOrgId();
  const canManage = await canManageAssignments();
  if (!canManage) return { error: 'Seuls les directeurs peuvent publier les bulletins.' };

  const includedExamTypes = parseIncludedExamTypes(params.includedExamTypes);

  if (params.mode === 'final') {
    const gapBlock = await assertGradeGapsOrForce({
      orgId,
      classId: params.classId,
      semester: params.semester,
      academicYear: params.academicYear,
      force: params.force,
      includedExamTypes,
    });
    if (gapBlock) return gapBlock;
  }

  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from('school_report_cards')
    .select('id, publication_status')
    .eq('organization_id', orgId)
    .eq('class_id', params.classId)
    .eq('semester', params.semester)
    .eq('academic_year', params.academicYear);

  if (!existing?.length) {
    return { error: 'Générez d’abord les bulletins pour cette classe.' };
  }

  if (params.mode === 'final') {
    const locked = existing.filter((c) => c.publication_status === 'final');
    if (locked.length > 0) {
      return { error: 'Des bulletins définitifs existent déjà — déverrouillage impossible.' };
    }
  }

  const patch =
    params.mode === 'final'
      ? { publication_status: 'final', locked_at: now }
      : { publication_status: 'draft', locked_at: null };

  const { error } = await supabase
    .from('school_report_cards')
    .update(patch)
    .eq('organization_id', orgId)
    .eq('class_id', params.classId)
    .eq('semester', params.semester)
    .eq('academic_year', params.academicYear)
    .neq('publication_status', 'final');

  if (error) return { error: error.message };

  let archived = 0;
  let archiveErrors = 0;
  if (params.mode === 'final') {
    const { data: finalCards } = await supabase
      .from('school_report_cards')
      .select('id')
      .eq('organization_id', orgId)
      .eq('class_id', params.classId)
      .eq('semester', params.semester)
      .eq('academic_year', params.academicYear)
      .eq('publication_status', 'final');

    for (const row of finalCards ?? []) {
      const res = await archiveReportCardPdf(row.id as string, orgId);
      if ('error' in res) archiveErrors += 1;
      else archived += 1;
    }
  }

  let smsSent = 0;
  if (params.sendSms) {
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .single();

    const { data: cardRows } = await supabase
      .from('school_report_cards')
      .select(`student_id, school_students(person_id, core_persons(full_name))`)
      .eq('organization_id', orgId)
      .eq('class_id', params.classId)
      .eq('semester', params.semester)
      .eq('academic_year', params.academicYear);

    for (const row of cardRows ?? []) {
      const studentId = row.student_id as string;
      const { data: enrollment } = await supabase
        .from('school_enrollments')
        .select('guardian_phone, guardian_sms_consent')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const student = row.school_students as Record<string, unknown>;
      const res = await notifyBulletinPublished({
        guardianPhone: (enrollment?.guardian_phone as string) ?? null,
        guardianSmsConsent: Boolean(enrollment?.guardian_sms_consent),
        studentName: personName(student),
        orgName: (org?.name as string) ?? 'Établissement',
        semester: params.semester,
        isFinal: params.mode === 'final',
      });
      if (res.sent) smsSent += 1;
    }
  }

  revalidatePath('/etablissement/bulletins');
  return {
    success: true,
    count: existing.length,
    mode: params.mode,
    smsSent,
    archived,
    archiveErrors,
  };
}

export async function getClassReportCardCompleteness(params: {
  classId: string;
  semester: string;
  academicYear: string;
  includedExamTypes?: string[] | null;
}) {
  const orgId = await requireOrgId();
  const includedExamTypes = parseIncludedExamTypes(params.includedExamTypes);
  const readiness = await evaluateReportCardReadiness(
    orgId,
    params.classId,
    params.semester,
    params.academicYear,
    includedExamTypes
  );

  const supabase = await createClient();
  const { data: org } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', orgId)
    .maybeSingle();
  const schoolSettings = parseSchoolOrgSettings(
    (org?.settings as Record<string, unknown>) ?? null
  );
  const gapReport = await loadGradeGapReportForClass(
    orgId,
    params.classId,
    params.semester,
    params.academicYear,
    schoolSettings.grading_period_by_level,
    includedExamTypes
  );

  const { data: cls } = await supabase
    .from('school_classes')
    .select('level, education_level_band')
    .eq('id', params.classId)
    .eq('organization_id', orgId)
    .maybeSingle();

  const { educationLevelBandLabel, gradingPeriodLabel, resolveGradingPolicyForClass } =
    await import('@/lib/school/grading-period-settings');
  const { resolveClassEducationBand } = await import('@/lib/school/education-level-catalog');

  const classBand = resolveClassEducationBand(
    parseEducationLevelBand(cls?.education_level_band),
    (cls?.level as string) ?? null
  );
  const policy = resolveGradingPolicyForClass(
    schoolSettings.grading_period_by_level,
    (cls?.level as string) ?? null,
    parseEducationLevelBand(cls?.education_level_band)
  );

  return {
    ...readiness,
    includedExamTypes,
    includedExamTypesLabel: formatIncludedExamTypesLabel(includedExamTypes),
    levelBandLabel: educationLevelBandLabel(classBand),
    periodLabel: gradingPeriodLabel(policy, params.semester),
    requiredPerSubject: gapReport.requiredPerSubject,
    totalMissingSlots: gapReport.totalMissingSlots,
    studentsWithGaps: gapReport.studentsWithGaps,
    hasGaps: gapReport.hasGaps,
    gapSummary: summarizeGradeGaps(gapReport, 8),
  };
}

export async function applyDefaultAppreciationsForClass(params: {
  classId: string;
  semester: string;
  academicYear: string;
  onlyEmpty?: boolean;
}) {
  const orgId = await requireOrgId();
  const canManage = await canManageAssignments();
  if (!canManage) return { error: 'Non autorisé' };

  const supabase = await createClient();
  const { data: cards } = await supabase
    .from('school_report_cards')
    .select('id, average_score, appreciation, publication_status')
    .eq('organization_id', orgId)
    .eq('class_id', params.classId)
    .eq('semester', params.semester)
    .eq('academic_year', params.academicYear)
    .neq('publication_status', 'final');

  if (!cards?.length) return { error: 'Aucun bulletin provisoire pour cette classe.' };

  let updated = 0;
  for (const card of cards) {
    if (params.onlyEmpty !== false && (card.appreciation as string | null)?.trim()) {
      continue;
    }
    const avg = card.average_score != null ? Number(card.average_score) : null;
    const text = suggestCouncilAppreciation(avg);
    if (!text) continue;
    const { error } = await supabase
      .from('school_report_cards')
      .update({ appreciation: text })
      .eq('id', card.id);
    if (!error) updated += 1;
  }

  revalidatePath('/etablissement/bulletins');
  return { success: true, updated };
}

export async function updateReportCardAppreciation(cardId: string, appreciation: string) {
  const orgId = await requireOrgId();
  const canManage = await canManageAssignments();
  if (!canManage) return { error: 'Non autorisé' };

  const supabase = await createClient();
  const { data: card } = await supabase
    .from('school_report_cards')
    .select('publication_status')
    .eq('id', cardId)
    .eq('organization_id', orgId)
    .maybeSingle();

  if (card?.publication_status === 'final') {
    return { error: 'Bulletin définitif verrouillé — modification impossible.' };
  }

  const { error } = await supabase
    .from('school_report_cards')
    .update({ appreciation: appreciation.trim() || null })
    .eq('id', cardId)
    .eq('organization_id', orgId);

  if (error) return { error: error.message };
  revalidatePath('/etablissement/bulletins');
  return { success: true };
}

/** Export CSV conseil de classe (moyennes, rangs, appréciations). */
export async function exportClassCouncilCsv(params: {
  classId: string;
  semester: string;
  academicYear: string;
}) {
  const orgId = await requireOrgId();
  const canManage = await canManageAssignments();
  if (!canManage) return { error: 'Non autorisé' };

  const supabase = await createClient();
  const { data: cards } = await supabase
    .from('school_report_cards')
    .select(
      `average_score, rank, appreciation, publication_status, grades_completeness_pct, included_exam_types,
       school_students(matricule, core_persons(full_name))`
    )
    .eq('organization_id', orgId)
    .eq('class_id', params.classId)
    .eq('semester', params.semester)
    .eq('academic_year', params.academicYear)
    .order('rank', { ascending: true, nullsFirst: false });

  if (!cards?.length) return { error: 'Aucun bulletin pour cette classe et période.' };

  const header =
    'Matricule;Élève;Moyenne;Rang;Complétude %;Statut;Appréciation;Types notes retenues';
  const lines = cards.map((c) => {
    const st = c.school_students as Record<string, unknown>;
    const types = formatIncludedExamTypesLabel(
      parseIncludedExamTypes(c.included_exam_types),
      10
    );
    return [
      (st?.matricule as string) ?? '',
      personName(st ?? {}),
      c.average_score != null ? Number(c.average_score).toFixed(2) : '',
      c.rank ?? '',
      c.grades_completeness_pct ?? '',
      c.publication_status === 'final' ? 'Définitif' : 'Provisoire',
      ((c.appreciation as string) ?? '').replace(/;/g, ','),
      types ?? 'Toutes',
    ].join(';');
  });

  const csv = [header, ...lines].join('\n');
  const base64 = Buffer.from(csv, 'utf-8').toString('base64');
  return {
    base64,
    fileName: `conseil_classe_${params.semester}_${params.academicYear}.csv`,
    count: cards.length,
  };
}
