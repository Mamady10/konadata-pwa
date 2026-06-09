'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import {
  personName,
  STUDENT_WITH_PERSON,
  TEACHER_WITH_PERSON,
  STUDENT_NESTED,
} from '@/lib/school/person-utils';
import { canManageSchoolCatalog } from '@/lib/school/permissions';
import {
  buildMonthSeries,
  incrementMonth,
  toInscriptionsChart,
  toPaymentsChart,
} from '@/lib/school/chart-utils';

import { requireOrgId } from '@/lib/actions/org';
import { getSession } from '@/lib/actions/auth';
import { canManageAssignments, getMyTeachingAssignments } from '@/lib/actions/assignments';
import {
  getEtablissementCapabilities,
  isSelfServiceLearner,
} from '@/lib/school/etablissement-access';
import { verifyReenrollmentCode } from '@/lib/school/reenrollment-verify';
import { parseSchoolOrgSettings } from '@/lib/school/school-org-settings';
import {
  parseDocumentAiAdaptation,
  type DocumentAiAdaptation,
} from '@/lib/ai/template-adaptation-types';
import type { AppRole } from '@/types/database';
import {
  MAX_STUDENT_IMPORT_ROWS,
  type StudentImportRow,
} from '@/lib/school/student-import';
import { parseStudentMatriculeSettings } from '@/lib/school/student-matricules';
import { getSessionEtablissementCapabilities } from '@/lib/school/session-capabilities';
import type { StaffPaymentEnrollmentOption } from '@/lib/school/student-payments';

async function assertSchoolCapability(
  key: keyof ReturnType<typeof getEtablissementCapabilities>
): Promise<{ ok: true; role: AppRole | undefined } | { error: string }> {
  const session = await getSession();
  const role = session?.profile?.role as AppRole | undefined;
  const caps = getEtablissementCapabilities(role);
  if (!caps[key]) {
    return { error: 'Action non autorisée pour votre rôle.' };
  }
  return { ok: true, role };
}

export async function getLinkedSchoolStudentIds(): Promise<string[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: persons } = await supabase
    .from('core_persons')
    .select('id')
    .eq('profile_id', user.id);

  if (!persons?.length) return [];

  const personIds = persons.map((p) => p.id as string);
  const { data: students } = await supabase
    .from('school_students')
    .select('id')
    .in('person_id', personIds);

  return (students ?? []).map((s) => s.id as string);
}

export async function getLinkedSchoolStudentId(): Promise<string | null> {
  const ids = await getLinkedSchoolStudentIds();
  return ids[0] ?? null;
}

async function getDefaultTuitionFee(orgId: string): Promise<number> {
  const supabase = await createClient();
  const { data: org } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', orgId)
    .single();
  const settings = (org?.settings ?? {}) as { tuition_fee_gnf?: number };
  return Number(settings.tuition_fee_gnf ?? 1_500_000);
}

export interface ClassFinanceRow {
  classId: string;
  className: string;
  level: string | null;
  capacity: number;
  tuitionFeeGnf: number;
  enrolledCount: number;
  pendingCandidates: number;
  collectedAmount: number;
  expectedAmount: number;
  gap: number;
}

function resolveClassTuitionFee(
  classRow: { tuition_fee_gnf?: number | string | null },
  orgDefault: number
): number {
  const v = classRow.tuition_fee_gnf;
  if (v !== null && v !== undefined && Number(v) > 0) return Number(v);
  return orgDefault;
}

export interface SchoolFinanceOverview {
  tuitionFeeGnf: number;
  rows: ClassFinanceRow[];
  totals: {
    enrolled: number;
    pending: number;
    collected: number;
    expected: number;
    gap: number;
  };
}

export async function getOrgDefaultAcademicYear(orgId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', orgId)
    .maybeSingle();
  return parseSchoolOrgSettings((data?.settings as Record<string, unknown> | null) ?? null)
    .default_academic_year;
}

export type GetClassesOptions = {
  /** Année scolaire ; `all` = toutes les années. Défaut : année courante de l'établissement. */
  academicYear?: string | 'all';
  includeInactive?: boolean;
};

export async function getSchoolFinanceByClass(orgId: string): Promise<SchoolFinanceOverview> {
  const supabase = await createClient();
  const tuitionFeeGnf = await getDefaultTuitionFee(orgId);
  const currentYear = await getOrgDefaultAcademicYear(orgId);

  const [{ data: classes }, { data: students }, { data: enrollments }, { data: payments }] =
    await Promise.all([
      supabase
        .from('school_classes')
        .select('id, name, level, capacity, tuition_fee_gnf')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .eq('academic_year', currentYear),
      supabase
        .from('school_students')
        .select('id, class_id, enrollment_status')
        .eq('organization_id', orgId),
      supabase
        .from('school_enrollments')
        .select('id, class_id, status')
        .eq('organization_id', orgId),
      supabase
        .from('school_payments')
        .select(`amount, status, student_id, school_students(class_id, school_classes(name))`)
        .eq('organization_id', orgId),
    ]);

  const paidByClass = new Map<string, number>();
  for (const p of payments ?? []) {
    if (p.status !== 'paid' && p.status !== 'partial') continue;
    const sid = p.student_id as string;
    const student = (students ?? []).find((s) => s.id === sid);
    const classId =
      (student?.class_id as string) ||
      ((p.school_students as { class_id?: string } | null)?.class_id ?? null);
    if (!classId) continue;
    paidByClass.set(classId, (paidByClass.get(classId) ?? 0) + Number(p.amount ?? 0));
  }

  const rows: ClassFinanceRow[] = (classes ?? []).map((c) => {
    const classId = c.id as string;
    const enrolledCount = (students ?? []).filter(
      (s) => s.class_id === classId && s.enrollment_status === 'enrolled'
    ).length;
    const pendingCandidates = (enrollments ?? []).filter(
      (e) => e.class_id === classId && e.status === 'pending'
    ).length;
    const collectedAmount = paidByClass.get(classId) ?? 0;
    const classFee = resolveClassTuitionFee(c, tuitionFeeGnf);
    const expectedAmount = enrolledCount * classFee;
    return {
      classId,
      className: c.name as string,
      level: (c.level as string) || null,
      capacity: Number(c.capacity ?? 0),
      tuitionFeeGnf: classFee,
      enrolledCount,
      pendingCandidates,
      collectedAmount,
      expectedAmount,
      gap: collectedAmount - expectedAmount,
    };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      enrolled: acc.enrolled + r.enrolledCount,
      pending: acc.pending + r.pendingCandidates,
      collected: acc.collected + r.collectedAmount,
      expected: acc.expected + r.expectedAmount,
      gap: acc.gap + r.gap,
    }),
    { enrolled: 0, pending: 0, collected: 0, expected: 0, gap: 0 }
  );

  return { tuitionFeeGnf, rows, totals };
}

export interface EnrollmentDocumentRow {
  id: string;
  enrollmentId: string | null;
  studentId: string | null;
  documentId: string | null;
  filePath: string | null;
  fileName: string;
  docType: string;
  docTypeLabel: string;
  createdAt: string;
  aiAdaptation: DocumentAiAdaptation | null;
  requestType?: string | null;
  requestTypeLabel?: string;
  applicantName?: string;
  className?: string;
  studyLevel?: string | null;
  department?: string | null;
  program?: string | null;
}

export async function getEnrollmentDocuments(orgId: string): Promise<EnrollmentDocumentRow[]> {
  const supabase = await createClient();
  const session = await getSession();
  const role = session?.profile?.role as AppRole | undefined;
  const { getEnrollmentDocumentLabel } = await import('@/lib/school/enrollment-document-types');

  const requestLabels: Record<string, string> = {
    new: 'Inscription',
    reenrollment: 'Réinscription',
  };

  const fullSelect = `id, enrollment_id, student_id, document_id, doc_type, created_at,
      school_enrollments (
        request_type, applicant_name, study_level, department, program,
        school_classes (name)
      ),
      documents (id, file_name, file_path, created_at, extracted_data)`;

  const learnerMode = isSelfServiceLearner(role);
  const studentIds = learnerMode ? await getLinkedSchoolStudentIds() : [];

  let query = supabase.from('school_student_documents').select(fullSelect).order('created_at', {
    ascending: false,
  });

  if (learnerMode) {
    if (!studentIds.length) return [];
    query = query.in('student_id', studentIds);
  } else {
    query = query.eq('organization_id', orgId);
  }

  let { data, error } = await query;

  if (error) {
    let fallbackQuery = supabase
      .from('school_student_documents')
      .select(
        `id, enrollment_id, student_id, document_id, doc_type, created_at,
        documents (id, file_name, file_path, created_at, extracted_data)`
      )
      .order('created_at', { ascending: false });
    if (learnerMode) {
      fallbackQuery = fallbackQuery.in('student_id', studentIds);
    } else {
      fallbackQuery = fallbackQuery.eq('organization_id', orgId);
    }
    const fallback = await fallbackQuery;
    data = fallback.data as typeof data;
    error = fallback.error;
  }

  if (error) throw new Error(error.message);

  const enrollmentIds = [
    ...new Set((data ?? []).map((r) => r.enrollment_id as string).filter(Boolean)),
  ];
  const enrollmentMeta = new Map<string, Record<string, unknown>>();
  if (enrollmentIds.length > 0) {
    let enrQuery = supabase
      .from('school_enrollments')
      .select(
        'id, request_type, applicant_name, study_level, department, program, school_classes(name)'
      )
      .in('id', enrollmentIds);
    if (!learnerMode) {
      enrQuery = enrQuery.eq('organization_id', orgId);
    }
    const { data: enrRows } = await enrQuery;
    for (const row of enrRows ?? []) {
      enrollmentMeta.set(row.id as string, row as Record<string, unknown>);
    }
  }

  return (data ?? []).map((row) => {
    const docRaw = row.documents as
      | {
          id?: string;
          file_name?: string;
          file_path?: string;
          extracted_data?: Record<string, unknown>;
        }
      | {
          id?: string;
          file_name?: string;
          file_path?: string;
          extracted_data?: Record<string, unknown>;
        }[]
      | null;
    const docMeta = Array.isArray(docRaw) ? docRaw[0] ?? null : docRaw;
    const enr =
      (row.school_enrollments as {
        request_type?: string;
        applicant_name?: string;
        study_level?: string;
        department?: string;
        program?: string;
        school_classes?: { name?: string } | null;
      } | null) ??
      (row.enrollment_id
        ? (enrollmentMeta.get(row.enrollment_id as string) as {
            request_type?: string;
            applicant_name?: string;
            study_level?: string;
            department?: string;
            program?: string;
            school_classes?: { name?: string } | null;
          } | undefined)
        : null) ??
      null;
    const rt = enr?.request_type ?? null;
    return {
      id: row.id as string,
      enrollmentId: (row.enrollment_id as string) || null,
      studentId: (row.student_id as string) || null,
      documentId: (row.document_id as string) || docMeta?.id || null,
      filePath: docMeta?.file_path ?? null,
      fileName: docMeta?.file_name || 'Document',
      docType: (row.doc_type as string) || 'other',
      docTypeLabel: getEnrollmentDocumentLabel(row.doc_type as string),
      createdAt: (row.created_at as string) || '',
      aiAdaptation: parseDocumentAiAdaptation(docMeta?.extracted_data),
      requestType: rt,
      requestTypeLabel: rt ? requestLabels[rt] ?? rt : null,
      applicantName: enr?.applicant_name ?? undefined,
      className: (Array.isArray(enr?.school_classes)
        ? enr.school_classes[0]?.name
        : enr?.school_classes?.name) ?? undefined,
      studyLevel: enr?.study_level ?? undefined,
      department: enr?.department ?? undefined,
      program: enr?.program ?? undefined,
    };
  }) as EnrollmentDocumentRow[];
}

async function createCorePerson(
  orgId: string,
  kind: 'student' | 'candidate' | 'teacher',
  data: { full_name: string; email?: string | null; phone?: string | null; gender?: string | null; date_of_birth?: string | null },
  profileId?: string | null
) {
  const supabase = await createClient();
  const { data: person, error } = await supabase
    .from('core_persons')
    .insert({
      organization_id: orgId,
      profile_id: profileId ?? null,
      kind,
      full_name: data.full_name,
      email: data.email || null,
      phone: data.phone || null,
      gender: data.gender || null,
      date_of_birth: data.date_of_birth || null,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return person.id;
}

export async function getSchoolDashboard(orgId: string) {
  const supabase = await createClient();
  const currentYear = await getOrgDefaultAcademicYear(orgId);

  const [students, teachers, classes, enrollments, payments, grades] = await Promise.all([
    supabase
      .from('school_students')
      .select('id, enrollment_status, matricule, class_id')
      .eq('organization_id', orgId),
    supabase.from('school_teachers').select('id').eq('organization_id', orgId).eq('is_active', true),
    supabase
      .from('school_classes')
      .select('id, name')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .eq('academic_year', currentYear),
    supabase.from('school_enrollments').select('id, status, created_at').eq('organization_id', orgId),
    supabase.from('school_payments').select('amount, status, paid_at, created_at').eq('organization_id', orgId),
    supabase.from('school_grades').select('score, max_score').eq('organization_id', orgId),
  ]);

  const studentRows = students.data ?? [];
  const paymentRows = payments.data ?? [];
  const enrollmentRows = enrollments.data ?? [];
  const gradeRows = grades.data ?? [];

  const totalStudents = studentRows.filter((s) => s.enrollment_status === 'enrolled').length;
  const totalCandidates =
    studentRows.filter((s) => ['pending', 'admitted'].includes(s.enrollment_status ?? '')).length +
    enrollmentRows.filter((e) => e.status === 'pending').length;
  const paidPayments = paymentRows.filter((p) => p.status === 'paid');
  const pendingPayments = paymentRows.filter((p) => p.status === 'pending' || p.status === 'overdue');
  const totalReceived = paidPayments.reduce((s, p) => s + Number(p.amount), 0);
  const paymentRate = paymentRows.length ? (paidPayments.length / paymentRows.length) * 100 : 0;
  const successRate = gradeRows.length
    ? (gradeRows.filter((g) => Number(g.score) >= Number(g.max_score) * 0.5).length / gradeRows.length) * 100
    : 0;

  const { data: recentEnrollmentDetails } = await supabase
    .from('school_enrollments')
    .select(`id, status, created_at, applicant_name, school_students(${STUDENT_NESTED}), school_classes(name)`)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(5);

  const { data: recentPaymentDetails } = await supabase
    .from('school_payments')
    .select(`id, amount, status, paid_at, payment_method, school_students(${STUDENT_NESTED})`)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(5);

  const { data: pendingStudentsRaw } = await supabase
    .from('school_students')
    .select(`${STUDENT_WITH_PERSON}`)
    .eq('organization_id', orgId)
    .in('enrollment_status', ['pending', 'admitted'])
    .order('created_at', { ascending: false })
    .limit(5);

  // ─── Graphiques (données réelles) ─────────────────────────────
  const monthBuckets = buildMonthSeries(6);

  const { data: enrollmentDates } = await supabase
    .from('school_enrollments')
    .select('created_at')
    .eq('organization_id', orgId);

  for (const e of enrollmentDates ?? []) {
    incrementMonth(monthBuckets, e.created_at, 'inscriptions');
  }

  const { data: studentDates } = await supabase
    .from('school_students')
    .select('enrollment_date, created_at')
    .eq('organization_id', orgId);

  for (const s of studentDates ?? []) {
    incrementMonth(monthBuckets, s.enrollment_date ?? s.created_at, 'inscriptions');
  }

  const { data: paidPaymentsChart } = await supabase
    .from('school_payments')
    .select('amount, paid_at, created_at, status')
    .eq('organization_id', orgId)
    .eq('status', 'paid');

  for (const p of paidPaymentsChart ?? []) {
    incrementMonth(monthBuckets, p.paid_at ?? p.created_at, 'montant', Number(p.amount));
  }

  const currentYearClassIds = new Set((classes.data ?? []).map((c) => c.id as string));

  const { data: studentsByClass } = await supabase
    .from('school_students')
    .select('id, class_id, school_classes(name, academic_year)')
    .eq('organization_id', orgId)
    .eq('enrollment_status', 'enrolled');

  const classCounts = new Map<string, number>();
  for (const s of studentsByClass ?? []) {
    const classId = s.class_id as string | null;
    const cls = s.school_classes as { name?: string; academic_year?: string } | null;
    if (classId && currentYearClassIds.size > 0 && !currentYearClassIds.has(classId)) {
      continue;
    }
    if (cls?.academic_year && cls.academic_year !== currentYear) continue;
    const name = cls?.name ?? 'Sans classe';
    classCounts.set(name, (classCounts.get(name) ?? 0) + 1);
  }
  const filiereRepartition = Array.from(classCounts.entries()).map(([name, value]) => ({
    name,
    value,
  }));

  const { count: bulletinsIncompletsCount, error: bulletinsIncompletsErr } = await supabase
    .from('school_report_cards')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .neq('publication_status', 'final')
    .lt('grades_completeness_pct', 100);
  const bulletinsIncomplets = bulletinsIncompletsErr ? 0 : (bulletinsIncompletsCount ?? 0);

  return {
    scope: 'organization' as const,
    kpis: {
      candidats: totalCandidates,
      etudiants: totalStudents,
      tauxPaiement: paymentRate,
      montantEncaisse: totalReceived,
      enseignants: teachers.data?.length ?? 0,
      classes: classes.data?.length ?? 0,
      paiementsEnAttente: pendingPayments.length,
      tauxReussite: successRate,
      elevesSansCode: studentRows.filter((s) => !String(s.matricule ?? '').trim()).length,
      elevesSansClasse: studentRows.filter(
        (s) => s.enrollment_status === 'enrolled' && !s.class_id
      ).length,
      bulletinsIncomplets,
    },
    recentEnrollments: recentEnrollmentDetails ?? [],
    recentPayments: recentPaymentDetails ?? [],
    pendingStudents: pendingStudentsRaw ?? [],
    classes: classes.data ?? [],
    charts: {
      inscriptions: toInscriptionsChart(monthBuckets),
      paiements: toPaymentsChart(monthBuckets),
      filieres: filiereRepartition.length ? filiereRepartition : [{ name: 'Aucune donnée', value: 1 }],
    },
  };
}

export interface PersonalDashboardLink {
  href: string;
  label: string;
  description: string;
}

export interface PersonalSchoolDashboard {
  scope: 'personal';
  role: 'teacher' | 'student' | 'candidate';
  userName: string;
  highlights: { label: string; value: string }[];
  links: PersonalDashboardLink[];
  enrollments: Array<{
    id: string;
    status: string;
    className: string;
    academicYear: string;
    date: string;
  }>;
  documentsCount: number;
  bulletinPublished: boolean;
  assignedClassesCount: number;
  assignedSubjectsCount: number;
}

const enrollmentStatusFr: Record<string, string> = {
  pending: 'En attente',
  admitted: 'Admis',
  enrolled: 'Inscrit',
  rejected: 'Refusé',
};

export async function getPersonalSchoolDashboard(
  orgId: string,
  role: AppRole
): Promise<PersonalSchoolDashboard> {
  const supabase = await createClient();
  const session = await getSession();
  const userName = session?.profile?.full_name ?? 'Utilisateur';

  let links: PersonalDashboardLink[] = [];
  let highlights: { label: string; value: string }[] = [];
  let enrollments: PersonalSchoolDashboard['enrollments'] = [];
  let documentsCount = 0;
  let bulletinPublished = false;
  let assignedClassesCount = 0;
  let assignedSubjectsCount = 0;

  if (role === 'teacher') {
    const slots = await getMyTeachingAssignments();
    const classIds = new Set((slots ?? []).map((s) => s.classId));
    const subjectIds = new Set((slots ?? []).map((s) => s.subjectId));
    assignedClassesCount = classIds.size;
    assignedSubjectsCount = subjectIds.size;

    highlights = [
      { label: 'Classes assignées', value: String(assignedClassesCount) },
      { label: 'Matières enseignées', value: String(assignedSubjectsCount) },
    ];

    links = [
      {
        href: '/etablissement/formations',
        label: 'Mes classes',
        description: 'Voir vos cours classe × matière',
      },
      {
        href: '/etablissement/resultats',
        label: 'Saisir les notes',
        description: 'Enregistrer les notes de vos élèves',
      },
    ];

    if (assignedClassesCount === 0) {
      highlights.push({
        label: 'Assignation',
        value: 'Aucune classe — contactez la direction',
      });
    }
  } else {
    const studentId = await getLinkedSchoolStudentId();
    const enrollmentRows = studentId ? await getEnrollments(orgId) : [];

    enrollments = enrollmentRows.map((e) => ({
      id: e.id as string,
      status: enrollmentStatusFr[e.status as string] ?? String(e.status),
      className: ((e.school_classes as { name?: string })?.name) || '—',
      academicYear: (e.academic_year as string) || '—',
      date: new Date(e.created_at as string).toLocaleDateString('fr-FR'),
    }));

    if (studentId) {
      const { count } = await supabase
        .from('school_student_documents')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('student_id', studentId);

      documentsCount = count ?? 0;

      const cards = await getReportCards(orgId);
      bulletinPublished = (cards?.length ?? 0) > 0;
    }

    const latest = enrollments[0];
    highlights = [
      {
        label: 'Dossier',
        value: latest?.status ?? 'Aucune demande',
      },
      { label: 'Pièces déposées', value: String(documentsCount) },
      {
        label: 'Bulletin',
        value: bulletinPublished ? 'Disponible' : 'Pas encore publié',
      },
    ];

    links = [
      {
        href: '/etablissement/candidatures',
        label: role === 'student' ? 'Ma réinscription' : 'Mon inscription',
        description: 'Déposer ou suivre votre dossier',
      },
    ];

    if (role === 'student') {
      links.push({
        href: '/etablissement/bulletins',
        label: 'Mon bulletin',
        description: bulletinPublished
          ? 'Consulter votre bulletin'
          : 'Sera visible après publication',
      });
    }
  }

  return {
    scope: 'personal',
    role: role as 'teacher' | 'student' | 'candidate',
    userName,
    highlights,
    links,
    enrollments,
    documentsCount,
    bulletinPublished,
    assignedClassesCount,
    assignedSubjectsCount,
  };
}

// ─── Students ────────────────────────────────────────────────

export async function getStudents(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('school_students')
    .select(STUDENT_WITH_PERSON)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getStudentOptions(orgId: string) {
  const students = await getStudents(orgId);
  return students.map((s) => ({
    id: s.id as string,
    full_name: personName(s),
    matricule: (s.matricule as string) || undefined,
  }));
}

export async function createStudent(formData: FormData) {
  const guard = await assertSchoolCapability('manageStudents');
  if ('error' in guard) return guard;

  const orgId = await requireOrgId();
  const supabase = await createClient();
  const enrollmentStatus = (formData.get('enrollment_status') as string) || 'pending';

  try {
    const personId = await createCorePerson(orgId, enrollmentStatus === 'pending' ? 'candidate' : 'student', {
      full_name: formData.get('full_name') as string,
      email: (formData.get('email') as string) || null,
      phone: (formData.get('phone') as string) || null,
      gender: (formData.get('gender') as string) || null,
      date_of_birth: (formData.get('date_of_birth') as string) || null,
    });

    const classId = (formData.get('class_id') as string) || null;
    let matricule = ((formData.get('matricule') as string) || '').trim() || null;
    if (!matricule && classId) {
      const { data: settingsRaw } = await supabase.rpc('school_student_matricule_settings', {
        p_org_id: orgId,
      });
      if (parseStudentMatriculeSettings(settingsRaw).auto_generate_on_import) {
        const { data: allocated, error: allocErr } = await supabase.rpc(
          'allocate_school_student_matricule',
          { p_org_id: orgId, p_class_id: classId, p_commit: true }
        );
        if (allocErr) return { error: allocErr.message };
        matricule = allocated ? String(allocated).trim() : null;
      }
    }

    const { error } = await supabase.from('school_students').insert({
      organization_id: orgId,
      person_id: personId,
      matricule,
      class_id: classId,
      enrollment_status: enrollmentStatus,
    });

    if (error) return { error: error.message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur création élève' };
  }

  revalidatePath('/etablissement');
  revalidatePath('/etablissement/etudiants');
  return { success: true };
}

export async function updateStudent(id: string, formData: FormData) {
  const orgId = await requireOrgId();
  const supabase = await createClient();

  const { data: student } = await supabase
    .from('school_students')
    .select('person_id')
    .eq('id', id)
    .eq('organization_id', orgId)
    .single();

  if (!student?.person_id) return { error: 'Élève introuvable' };

  await supabase
    .from('core_persons')
    .update({
      full_name: formData.get('full_name') as string,
      email: (formData.get('email') as string) || null,
      phone: (formData.get('phone') as string) || null,
    })
    .eq('id', student.person_id)
    .eq('organization_id', orgId);

  const { error } = await supabase
    .from('school_students')
    .update({
      class_id: (formData.get('class_id') as string) || null,
      enrollment_status: formData.get('enrollment_status') as string,
    })
    .eq('id', id)
    .eq('organization_id', orgId);

  if (error) return { error: error.message };
  revalidatePath('/etablissement/etudiants');
  return { success: true };
}

// ─── Teachers ────────────────────────────────────────────────

export async function getTeachers(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('school_teachers')
    .select(TEACHER_WITH_PERSON)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createTeacher(formData: FormData) {
  if (!(await canManageSchoolCatalog())) {
    return { error: 'Seuls la direction et la scolarité peuvent ajouter des enseignants au catalogue.' };
  }
  const orgId = await requireOrgId();
  const supabase = await createClient();

  try {
    const personId = await createCorePerson(orgId, 'teacher', {
      full_name: formData.get('full_name') as string,
      email: (formData.get('email') as string) || null,
      phone: (formData.get('phone') as string) || null,
    });

    const { error } = await supabase.from('school_teachers').insert({
      organization_id: orgId,
      person_id: personId,
      specialty: (formData.get('specialty') as string) || null,
    });

    if (error) return { error: error.message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur création enseignant' };
  }

  revalidatePath('/etablissement/formations');
  return { success: true };
}

// ─── Classes & Subjects ──────────────────────────────────────

export interface GetSubjectsOptions {
  educationLevelBand?: string;
  includeInactive?: boolean;
}

export async function getClasses(orgId: string, options?: GetClassesOptions) {
  const supabase = await createClient();
  const yearFilter =
    options?.academicYear === 'all'
      ? null
      : options?.academicYear ?? (await getOrgDefaultAcademicYear(orgId));

  let query = supabase.from('school_classes').select('*').eq('organization_id', orgId);
  if (!options?.includeInactive) {
    query = query.eq('is_active', true);
  }
  if (yearFilter) {
    query = query.eq('academic_year', yearFilter);
  }
  const { data, error } = await query.order('name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createClass(formData: FormData) {
  if (!(await canManageSchoolCatalog())) {
    return { error: 'Seuls la direction et la scolarité peuvent créer des classes.' };
  }
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const tuitionRaw = formData.get('tuition_fee_gnf') as string;
  const tuitionFee =
    tuitionRaw && Number(tuitionRaw) > 0 ? Number(tuitionRaw) : null;

  const { data: org } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', orgId)
    .single();
  const defaultYear = parseSchoolOrgSettings(
    (org?.settings as Record<string, unknown>) ?? null
  ).default_academic_year;

  const { parseEducationLevelBand } = await import('@/lib/school/education-level-catalog');
  const educationLevelBand = parseEducationLevelBand(formData.get('education_level_band'));
  if (!educationLevelBand) {
    return { error: 'Choisissez un palier (primaire, collège, lycée ou université).' };
  }

  const { error } = await supabase.from('school_classes').insert({
    organization_id: orgId,
    name: formData.get('name') as string,
    level: (formData.get('level') as string) || null,
    education_level_band: educationLevelBand,
    department: (formData.get('department') as string) || null,
    program: (formData.get('program') as string) || null,
    academic_year: (formData.get('academic_year') as string) || defaultYear,
    capacity: Number(formData.get('capacity')) || 40,
    tuition_fee_gnf: tuitionFee,
  });
  if (error) return { error: error.message };
  revalidatePath('/etablissement/formations');
  revalidatePath('/etablissement/paiements');
  revalidatePath('/etablissement/rapports');
  return { success: true };
}

export async function createClassesFromPresets(input: {
  educationLevelBand: string;
  presetIds: string[];
}) {
  if (!(await canManageSchoolCatalog())) {
    return { error: 'Seuls la direction et la scolarité peuvent créer des classes.' };
  }
  const orgId = await requireOrgId();
  const supabase = await createClient();

  const { parseEducationLevelBand, resolveClassPresets } = await import(
    '@/lib/school/education-level-catalog'
  );
  const band = parseEducationLevelBand(input.educationLevelBand);
  if (!band) {
    return { error: 'Palier invalide.' };
  }

  const presetIds = [...new Set(input.presetIds.filter(Boolean))];
  if (presetIds.length === 0) {
    return { error: 'Sélectionnez au moins un modèle de classe.' };
  }

  const presets = resolveClassPresets(band, presetIds);
  if (presets.length === 0) {
    return { error: 'Aucun modèle valide pour ce palier.' };
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', orgId)
    .single();
  const defaultYear = parseSchoolOrgSettings(
    (org?.settings as Record<string, unknown>) ?? null
  ).default_academic_year;

  const { data: existing } = await supabase
    .from('school_classes')
    .select('name')
    .eq('organization_id', orgId)
    .eq('academic_year', defaultYear)
    .eq('is_active', true);

  const existingNames = new Set(
    (existing ?? []).map((c) => (c.name as string).trim().toLowerCase())
  );

  const toInsert = presets
    .filter((p) => !existingNames.has(p.name.trim().toLowerCase()))
    .map((p) => ({
      organization_id: orgId,
      name: p.name,
      level: p.level,
      education_level_band: band,
      department: p.department ?? null,
      program: p.program ?? null,
      academic_year: defaultYear,
      capacity: p.capacity ?? 40,
      tuition_fee_gnf: null,
    }));

  const skipped = presets.length - toInsert.length;

  if (toInsert.length === 0) {
    return {
      success: true,
      created: 0,
      skipped,
      message: 'Toutes les classes sélectionnées existent déjà pour cette année.',
    };
  }

  const { error } = await supabase.from('school_classes').insert(toInsert);
  if (error) return { error: error.message };

  revalidatePath('/etablissement/formations');
  revalidatePath('/etablissement/paiements');
  revalidatePath('/etablissement/rapports');
  revalidatePath('/etablissement/resultats');
  revalidatePath('/etablissement/bulletins');

  return {
    success: true,
    created: toInsert.length,
    skipped,
    message: `${toInsert.length} classe(s) créée(s)${skipped > 0 ? `, ${skipped} déjà existante(s)` : ''}.`,
  };
}

export async function updateClassTuition(classId: string, tuitionFeeGnf: number) {
  if (!(await canManageSchoolCatalog())) {
    return { error: 'Seuls la direction et la scolarité peuvent modifier les frais.' };
  }
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const fee = tuitionFeeGnf > 0 ? tuitionFeeGnf : null;
  const { error } = await supabase
    .from('school_classes')
    .update({ tuition_fee_gnf: fee })
    .eq('id', classId)
    .eq('organization_id', orgId);
  if (error) return { error: error.message };
  revalidatePath('/etablissement/formations');
  revalidatePath('/etablissement/paiements');
  revalidatePath('/etablissement/rapports');
  return { success: true };
}

export async function getSubjects(orgId: string, options?: GetSubjectsOptions) {
  const supabase = await createClient();
  let query = supabase.from('school_subjects').select('*').eq('organization_id', orgId);
  if (!options?.includeInactive) {
    query = query.eq('is_active', true);
  }
  if (options?.educationLevelBand) {
    query = query.eq('education_level_band', options.educationLevelBand);
  }
  const { data, error } = await query.order('name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createSubject(formData: FormData) {
  if (!(await canManageSchoolCatalog())) {
    return { error: 'Seuls la direction et la scolarité peuvent créer des matières.' };
  }
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const { parseEducationLevelBand } = await import('@/lib/school/education-level-catalog');
  const educationLevelBand = parseEducationLevelBand(formData.get('education_level_band'));
  if (!educationLevelBand) {
    return { error: 'Choisissez un palier (primaire, collège, lycée ou université).' };
  }

  const { error } = await supabase.from('school_subjects').insert({
    organization_id: orgId,
    name: formData.get('name') as string,
    code: (formData.get('code') as string) || null,
    coefficient: Number(formData.get('coefficient')) || 1,
    education_level_band: educationLevelBand,
  });
  if (error) return { error: error.message };
  revalidatePath('/etablissement/formations');
  return { success: true };
}

export async function createSubjectsFromPresets(input: {
  educationLevelBand: string;
  presetIds: string[];
}) {
  if (!(await canManageSchoolCatalog())) {
    return { error: 'Seuls la direction et la scolarité peuvent créer des matières.' };
  }
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const { parseEducationLevelBand, resolveSubjectPresets } = await import(
    '@/lib/school/education-level-catalog'
  );
  const band = parseEducationLevelBand(input.educationLevelBand);
  if (!band) return { error: 'Palier invalide.' };
  const presetIds = [...new Set(input.presetIds.filter(Boolean))];
  if (presetIds.length === 0) return { error: 'Sélectionnez au moins une matière.' };
  const presets = resolveSubjectPresets(band, presetIds);
  if (presets.length === 0) return { error: 'Aucun modèle valide.' };

  const { data: existing } = await supabase
    .from('school_subjects')
    .select('name')
    .eq('organization_id', orgId)
    .eq('is_active', true);
  const existingNames = new Set(
    (existing ?? []).map((s) => (s.name as string).trim().toLowerCase())
  );

  const toInsert = presets
    .filter((p) => !existingNames.has(p.name.trim().toLowerCase()))
    .map((p) => ({
      organization_id: orgId,
      name: p.name,
      code: p.code ?? null,
      coefficient: p.coefficient ?? 1,
      education_level_band: band,
      is_active: true,
    }));

  const skipped = presets.length - toInsert.length;
  if (toInsert.length === 0) {
    return {
      success: true,
      created: 0,
      skipped,
      message: 'Toutes les matières sélectionnées existent déjà.',
    };
  }

  const { error } = await supabase.from('school_subjects').insert(toInsert);
  if (error) return { error: error.message };
  revalidatePath('/etablissement/formations');
  revalidatePath('/etablissement/resultats');
  return {
    success: true,
    created: toInsert.length,
    skipped,
    message: `${toInsert.length} matière(s) créée(s)${skipped > 0 ? `, ${skipped} existante(s)` : ''}.`,
  };
}

export async function updateClass(classId: string, formData: FormData) {
  if (!(await canManageSchoolCatalog())) {
    return { error: 'Seuls la direction et la scolarité peuvent modifier les classes.' };
  }
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const { parseEducationLevelBand } = await import('@/lib/school/education-level-catalog');
  const band = parseEducationLevelBand(formData.get('education_level_band'));
  if (!band) return { error: 'Palier invalide.' };

  const { error } = await supabase
    .from('school_classes')
    .update({
      name: (formData.get('name') as string)?.trim(),
      level: (formData.get('level') as string) || null,
      education_level_band: band,
      department: (formData.get('department') as string) || null,
      program: (formData.get('program') as string) || null,
      capacity: Number(formData.get('capacity')) || 40,
    })
    .eq('id', classId)
    .eq('organization_id', orgId);
  if (error) return { error: error.message };
  revalidatePath('/etablissement/formations');
  revalidatePath('/etablissement/bulletins');
  revalidatePath('/etablissement/resultats');
  return { success: true };
}

export async function setClassActive(classId: string, isActive: boolean) {
  if (!(await canManageSchoolCatalog())) {
    return { error: 'Non autorisé.' };
  }
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const { error } = await supabase
    .from('school_classes')
    .update({ is_active: isActive })
    .eq('id', classId)
    .eq('organization_id', orgId);
  if (error) return { error: error.message };
  revalidatePath('/etablissement/formations');
  return { success: true };
}

export async function updateSubject(subjectId: string, formData: FormData) {
  if (!(await canManageSchoolCatalog())) {
    return { error: 'Non autorisé.' };
  }
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const { parseEducationLevelBand } = await import('@/lib/school/education-level-catalog');
  const band = parseEducationLevelBand(formData.get('education_level_band'));
  if (!band) return { error: 'Palier invalide.' };

  const { error } = await supabase
    .from('school_subjects')
    .update({
      name: (formData.get('name') as string)?.trim(),
      code: (formData.get('code') as string) || null,
      coefficient: Number(formData.get('coefficient')) || 1,
      education_level_band: band,
    })
    .eq('id', subjectId)
    .eq('organization_id', orgId);
  if (error) return { error: error.message };
  revalidatePath('/etablissement/formations');
  revalidatePath('/etablissement/resultats');
  return { success: true };
}

export async function setSubjectActive(subjectId: string, isActive: boolean) {
  if (!(await canManageSchoolCatalog())) {
    return { error: 'Non autorisé.' };
  }
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const { error } = await supabase
    .from('school_subjects')
    .update({ is_active: isActive })
    .eq('id', subjectId)
    .eq('organization_id', orgId);
  if (error) return { error: error.message };
  revalidatePath('/etablissement/formations');
  revalidatePath('/etablissement/resultats');
  return { success: true };
}

export async function importClassesFromRows(
  rows: import('@/lib/school/class-import').ClassImportRow[],
  parseIssues: string[] = []
) {
  if (!(await canManageSchoolCatalog())) {
    return { error: 'Non autorisé.' };
  }
  if (!rows.length) {
    return { error: parseIssues.join(' · ') || 'Aucune classe à importer.' };
  }

  const orgId = await requireOrgId();
  const supabase = await createClient();

  const { data: org } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', orgId)
    .single();
  const defaultYear = parseSchoolOrgSettings(
    (org?.settings as Record<string, unknown>) ?? null
  ).default_academic_year;

  const { data: existing } = await supabase
    .from('school_classes')
    .select('name')
    .eq('organization_id', orgId)
    .eq('academic_year', defaultYear)
    .eq('is_active', true);
  const existingNames = new Set(
    (existing ?? []).map((c) => (c.name as string).trim().toLowerCase())
  );

  const toInsert = rows
    .filter((r) => !existingNames.has(r.name.trim().toLowerCase()))
    .map((r) => ({
      organization_id: orgId,
      name: r.name,
      level: r.level,
      education_level_band: r.education_level_band,
      department: r.department,
      program: r.program,
      academic_year: defaultYear,
      capacity: r.capacity,
      is_active: true,
    }));

  if (toInsert.length > 0) {
    const { error } = await supabase.from('school_classes').insert(toInsert);
    if (error) return { error: error.message };
  }

  revalidatePath('/etablissement/formations');
  const skipped = rows.length - toInsert.length;
  const parts = [`${toInsert.length} classe(s) importée(s)`];
  if (skipped > 0) parts.push(`${skipped} ignorée(s) (doublon)`);
  if (parseIssues.length) parts.push(parseIssues.join(' · '));

  return {
    success: true,
    created: toInsert.length,
    skipped,
    errors: parseIssues,
    message: parts.join(' — '),
  };
}

export async function importClassesFromCsv(csvText: string) {
  const { parseClassImportCsv } = await import('@/lib/school/class-import');
  const { rows, errors, warnings } = parseClassImportCsv(csvText);
  const parseIssues = [...errors, ...warnings];
  if (parseIssues.length > 0 && rows.length === 0) {
    return { error: parseIssues.join(' · ') };
  }
  return importClassesFromRows(rows, parseIssues);
}

export async function backfillEducationLevelBands() {
  if (!(await canManageSchoolCatalog())) {
    return { error: 'Non autorisé.' };
  }
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const { inferEducationLevelBand } = await import('@/lib/school/grading-period-settings');

  const [{ data: classes }, { data: subjects }] = await Promise.all([
    supabase
      .from('school_classes')
      .select('id, level, education_level_band')
      .eq('organization_id', orgId),
    supabase
      .from('school_subjects')
      .select('id, education_level_band')
      .eq('organization_id', orgId)
      .is('education_level_band', null),
  ]);

  let classesUpdated = 0;
  for (const c of classes ?? []) {
    if (c.education_level_band) continue;
    const band = inferEducationLevelBand(c.level as string | null);
    const { error } = await supabase
      .from('school_classes')
      .update({ education_level_band: band })
      .eq('id', c.id as string);
    if (!error) classesUpdated++;
  }

  let subjectsUpdated = 0;
  for (const s of subjects ?? []) {
    const { error } = await supabase
      .from('school_subjects')
      .update({ education_level_band: 'college' })
      .eq('id', s.id as string);
    if (!error) subjectsUpdated++;
  }

  revalidatePath('/etablissement/formations');
  return {
    success: true,
    classesUpdated,
    subjectsUpdated,
    message: `${classesUpdated} classe(s) et ${subjectsUpdated} matière(s) mises à jour.`,
  };
}

// ─── Enrollments ─────────────────────────────────────────────

export async function getEnrollments(orgId: string) {
  const supabase = await createClient();
  const session = await getSession();
  const role = session?.profile?.role as AppRole | undefined;

  const select = `*, school_students(${STUDENT_NESTED}), school_classes(name, tuition_fee_gnf), organizations(name)`;
  const selectFallback = `*, school_students(${STUDENT_NESTED}), school_classes(name, tuition_fee_gnf)`;

  if (isSelfServiceLearner(role)) {
    const { data: rpcRows, error: rpcErr } = await supabase.rpc('get_my_learner_enrollments');
    if (!rpcErr && rpcRows != null) {
      const list = Array.isArray(rpcRows)
        ? rpcRows
        : typeof rpcRows === 'string'
          ? (JSON.parse(rpcRows) as unknown[])
          : [];
      if (Array.isArray(list) && list.length >= 0) {
        return list as Record<string, unknown>[];
      }
    }

    const studentIds = await getLinkedSchoolStudentIds();
    if (!studentIds.length) return [];

    let { data, error } = await supabase
      .from('school_enrollments')
      .select(select)
      .in('student_id', studentIds)
      .order('created_at', { ascending: false });

    if (error) {
      const retry = await supabase
        .from('school_enrollments')
        .select(selectFallback)
        .in('student_id', studentIds)
        .order('created_at', { ascending: false });
      data = retry.data;
      error = retry.error;
    }

    if (error) throw new Error(error.message);

    const rows = data ?? [];
    if (rows.length > 0 && !rows[0].organizations) {
      const orgIds = [...new Set(rows.map((r) => r.organization_id as string).filter(Boolean))];
      if (orgIds.length > 0) {
        const { data: orgs } = await supabase
          .from('organizations')
          .select('id, name')
          .in('id', orgIds);
        const nameById = new Map((orgs ?? []).map((o) => [o.id as string, o.name as string]));
        return rows.map((r) => ({
          ...r,
          organizations: { name: nameById.get(r.organization_id as string) ?? 'Établissement' },
        }));
      }
    }

    return rows;
  }

  const { data, error } = await supabase
    .from('school_enrollments')
    .select(select)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createEnrollment(formData: FormData) {
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const session = await getSession();
  const role = session?.profile?.role as AppRole | undefined;
  const caps = getEtablissementCapabilities(role);

  if (!caps.createEnrollmentRequest) {
    return {
      error:
        'Seuls les candidats ou élèves peuvent créer une demande d’inscription en ligne. La scolarité traite les dossiers reçus.',
    };
  }

  let applicantName = formData.get('applicant_name') as string;
  let email = formData.get('email') as string;
  const isReenrollment = formData.get('is_reenrollment') === 'true';
  let studentId = formData.get('student_id') as string | null;

  if (caps.manageOwnEnrollment && !caps.manageEnrollments) {
    applicantName = session?.profile?.full_name || applicantName;
    email = session?.profile?.email || email;
    studentId = (await getLinkedSchoolStudentId()) ?? studentId;
  }

  if (!studentId && applicantName) {
    try {
      const personId = await createCorePerson(
        orgId,
        caps.manageOwnEnrollment && role === 'student' ? 'student' : 'candidate',
        {
          full_name: applicantName,
          email: email || null,
          phone: (formData.get('phone') as string) || null,
        },
        caps.manageOwnEnrollment ? session?.profile?.id : null
      );
      const { data: student, error: studentError } = await supabase
        .from('school_students')
        .insert({
          organization_id: orgId,
          person_id: personId,
          enrollment_status: 'pending',
        })
        .select('id')
        .single();
      if (studentError) return { error: studentError.message };
      studentId = student.id;
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Erreur candidature' };
    }
  }

  const requestType =
    (formData.get('request_type') as string) === 'reenrollment' || isReenrollment
      ? 'reenrollment'
      : 'new';
  const reenrollmentCode = (formData.get('reenrollment_verification_code') as string)?.trim().toUpperCase() || null;

  const enrollmentYear = (formData.get('academic_year') as string) || '2025-2026';
  let codeVerified = false;
  let matchedCodeId: string | undefined;
  if (requestType === 'reenrollment' && reenrollmentCode) {
    const check = await verifyReenrollmentCode(
      supabase,
      orgId,
      reenrollmentCode,
      enrollmentYear
    );
    codeVerified = check.verified;
    matchedCodeId = check.codeId;
  }

  const { data, error } = await supabase
    .from('school_enrollments')
    .insert({
      organization_id: orgId,
      student_id: studentId,
      class_id: (formData.get('class_id') as string) || null,
      academic_year: enrollmentYear,
      status: 'pending',
      applicant_name: applicantName,
      applicant_email: email,
      applicant_phone: (formData.get('phone') as string) || null,
      request_type: requestType,
      study_level: (formData.get('study_level') as string) || null,
      department: (formData.get('department') as string) || null,
      program: (formData.get('program') as string) || null,
      reenrollment_verification_code: requestType === 'reenrollment' ? reenrollmentCode : null,
      reenrollment_code_verified: codeVerified,
      notes: requestType === 'reenrollment' ? 'Réinscription' : 'Nouvelle inscription',
    })
    .select()
    .single();

  if (error) return { error: error.message };

  if (codeVerified && matchedCodeId && data?.id) {
    const { data: codeRow } = await supabase
      .from('school_reenrollment_codes')
      .select('academic_year')
      .eq('id', matchedCodeId)
      .maybeSingle();

    if (codeRow?.academic_year) {
      await supabase
        .from('school_reenrollment_codes')
        .update({
          used_at: new Date().toISOString(),
          used_by_enrollment_id: data.id,
          is_active: false,
        })
        .eq('id', matchedCodeId)
        .is('used_at', null);
    } else {
      await supabase
        .from('school_reenrollment_codes')
        .update({ used_by_enrollment_id: data.id })
        .eq('id', matchedCodeId);
    }
  }

  revalidatePath('/etablissement/candidatures');
  return { data };
}

export async function updateEnrollmentStatus(
  id: string,
  status: string,
  options?: { classId?: string | null; sendSms?: boolean }
) {
  const guard = await assertSchoolCapability('manageEnrollments');
  if ('error' in guard) return guard;

  const orgId = await requireOrgId();
  const supabase = await createClient();

  if (status === 'enrolled' && !options?.classId) {
    const { data: current } = await supabase
      .from('school_enrollments')
      .select('class_id')
      .eq('id', id)
      .eq('organization_id', orgId)
      .maybeSingle();
    if (!current?.class_id) {
      return { error: 'Choisissez une classe avant de confirmer l’inscription.' };
    }
  }

  const enrollmentPatch: Record<string, unknown> = { status };
  if (options?.classId) {
    enrollmentPatch.class_id = options.classId;
  }

  const { error } = await supabase
    .from('school_enrollments')
    .update(enrollmentPatch)
    .eq('id', id)
    .eq('organization_id', orgId);

  if (error) return { error: error.message };

  const { data: enrollment } = await supabase
    .from('school_enrollments')
    .select(
      'student_id, class_id, applicant_name, guardian_phone, guardian_sms_consent, school_classes(name)'
    )
    .eq('id', id)
    .single();

  if (enrollment?.student_id) {
    if (status === 'admitted' || status === 'enrolled') {
      const resolvedClassId = options?.classId ?? enrollment.class_id;
      const studentUpdate: Record<string, unknown> = {
        enrollment_status: status === 'enrolled' ? 'enrolled' : 'admitted',
        ...(status === 'enrolled' ? { enrollment_source: 'platform' } : {}),
      };
      if (resolvedClassId) {
        studentUpdate.class_id = resolvedClassId;
      }
      await supabase
        .from('school_students')
        .update(studentUpdate)
        .eq('id', enrollment.student_id);

      const { data: student } = await supabase
        .from('school_students')
        .select('person_id')
        .eq('id', enrollment.student_id)
        .maybeSingle();

      if (student?.person_id) {
        const { data: person } = await supabase
          .from('core_persons')
          .select('profile_id')
          .eq('id', student.person_id as string)
          .maybeSingle();

        if (person?.profile_id) {
          await supabase
            .from('profiles')
            .update({ role: 'student' })
            .eq('id', person.profile_id as string);
        }
      }
    } else if (status === 'rejected') {
      await supabase
        .from('school_students')
        .update({ enrollment_status: 'pending' })
        .eq('id', enrollment.student_id);
    }

    if (status === 'enrolled') {
      await supabase.rpc('refresh_school_platform_invoice', { p_org_id: orgId });

      if (options?.sendSms !== false) {
        const { data: org } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', orgId)
          .maybeSingle();
        const { data: studentRow } = await supabase
          .from('school_students')
          .select(STUDENT_WITH_PERSON)
          .eq('id', enrollment.student_id)
          .maybeSingle();
        const { notifyEnrollmentConfirmed } = await import(
          '@/lib/school/enrollment-notifications'
        );
        await notifyEnrollmentConfirmed({
          guardianPhone: (enrollment.guardian_phone as string) ?? null,
          guardianSmsConsent: Boolean(enrollment.guardian_sms_consent),
          studentName:
            personName(studentRow as Record<string, unknown>) ||
            (enrollment.applicant_name as string) ||
            'Élève',
          orgName: (org?.name as string) ?? 'Établissement',
          className: ((enrollment.school_classes as { name?: string })?.name) ?? null,
        });
      }
    }
  }

  revalidatePath('/etablissement/candidatures');
  revalidatePath('/parametres/facturation');
  revalidatePath('/etablissement');
  revalidatePath('/etablissement/etudiants');
  return { success: true };
}

export async function submitEnrollmentDossier(enrollmentId: string) {
  const guard = await assertSchoolCapability('manageOwnEnrollment');
  if ('error' in guard) return guard;

  const supabase = await createClient();
  const studentIds = await getLinkedSchoolStudentIds();
  if (!studentIds.length) {
    return { error: 'Profil élève introuvable. Reconnectez-vous ou contactez la scolarité.' };
  }

  const { data: enrollment, error: fetchErr } = await supabase
    .from('school_enrollments')
    .select('id, student_id, status, organization_id')
    .eq('id', enrollmentId)
    .in('student_id', studentIds)
    .maybeSingle();

  if (fetchErr) return { error: fetchErr.message };
  if (!enrollment) return { error: 'Dossier introuvable.' };
  if ((enrollment.status as string) !== 'pending') {
    return { error: 'Ce dossier n’est plus modifiable.' };
  }

  const orgId = enrollment.organization_id as string;

  const { count, error: countErr } = await supabase
    .from('school_student_documents')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('enrollment_id', enrollmentId);

  if (countErr) return { error: countErr.message };
  if (!count || count < 1) {
    return { error: 'Ajoutez au moins une pièce avant de finaliser le dossier.' };
  }

  const submittedAt = new Date().toISOString();
  const { error: updErr } = await supabase
    .from('school_enrollments')
    .update({ dossier_submitted_at: submittedAt })
    .eq('id', enrollmentId)
    .eq('organization_id', orgId);

  if (updErr?.message?.includes('dossier_submitted_at')) {
    return {
      error:
        'Migration 030 non appliquée. Exécutez supabase/migrations/030_enrollment_dossier_submitted.sql.',
    };
  }
  if (updErr) return { error: updErr.message };

  revalidatePath('/etablissement/candidatures');
  return { success: true, submittedAt };
}

// ─── Payments ────────────────────────────────────────────────

export async function getPayments(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('school_payments')
    .select(`*, school_students(${STUDENT_NESTED})`)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getEnrollmentOptionsForStaffPayments(
  orgId: string
): Promise<StaffPaymentEnrollmentOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('school_enrollments')
    .select('id, student_id, request_type, status, academic_year, school_classes(name)')
    .eq('organization_id', orgId)
    .in('status', ['pending', 'admitted', 'enrolled'])
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const cls = row.school_classes as { name?: string } | { name?: string }[] | null;
    const className = Array.isArray(cls) ? cls[0]?.name ?? null : cls?.name ?? null;
    return {
      id: row.id as string,
      studentId: row.student_id as string,
      requestType: (row.request_type as string) || 'new',
      status: (row.status as string) || 'pending',
      academicYear: (row.academic_year as string) || null,
      className,
    };
  });
}

export async function recordPayment(formData: FormData) {
  const caps = await getSessionEtablissementCapabilities();
  if (!caps.recordPayments) {
    return { error: 'Action non autorisée pour votre rôle.' };
  }

  const studentId = (formData.get('student_id') as string)?.trim();
  if (!studentId) return { error: 'Élève requis.' };

  const amount = Number(formData.get('amount'));
  if (!amount || amount <= 0) return { error: 'Montant invalide.' };

  const paymentKind = ((formData.get('payment_kind') as string) || 'tuition').trim();
  if (!['tuition', 'enrollment', 'reenrollment'].includes(paymentKind)) {
    return { error: 'Type de paiement invalide.' };
  }

  const enrollmentId = (formData.get('enrollment_id') as string)?.trim() || null;
  if (paymentKind !== 'tuition' && !enrollmentId) {
    return { error: 'Sélectionnez le dossier d\'inscription ou de réinscription.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('record_school_staff_payment', {
    p_student_id: studentId,
    p_kind: paymentKind,
    p_amount: amount,
    p_enrollment_id: enrollmentId,
    p_payment_method: (formData.get('payment_method') as string) || 'cash',
    p_reference: (formData.get('reference') as string) || null,
    p_description: (formData.get('description') as string) || null,
    p_status: (formData.get('status') as string) || 'paid',
  });

  if (error) return { error: error.message };
  const row = data as { error?: string; receipt_url?: string } | null;
  if (row?.error) return { error: row.error };

  revalidatePath('/etablissement/paiements');
  revalidatePath('/etablissement/candidatures');
  revalidatePath('/etablissement');
  return { success: true, receiptUrl: row?.receipt_url ?? null };
}

// ─── Grades ──────────────────────────────────────────────────

export async function getGrades(orgId: string, classId?: string) {
  const supabase = await createClient();
  let query = supabase
    .from('school_grades')
    .select(`*, school_students(${STUDENT_NESTED}), school_subjects(name, coefficient), school_classes(name, level, education_level_band)`)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });

  if (classId) query = query.eq('class_id', classId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function saveGrade(formData: FormData) {
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const classId = (formData.get('class_id') as string) || null;
  const subjectId = (formData.get('subject_id') as string) || null;

  if (!classId) {
    return { error: 'La classe est obligatoire pour enregistrer une note.' };
  }
  if (!subjectId) {
    return { error: 'La matière est obligatoire pour enregistrer une note.' };
  }

  const studentId = ((formData.get('student_id') as string) || '').trim();
  if (!studentId) {
    return {
      error:
        'Choisissez un élève. S\'il n\'apparaît pas dans la liste, la direction doit d\'abord inscrire des élèves dans cette classe (Étudiants).',
    };
  }

  const teachingSlots = await getMyTeachingAssignments();
  if (
    teachingSlots !== null &&
    !teachingSlots.some((s) => s.classId === classId && s.subjectId === subjectId)
  ) {
    return { error: 'Vous n\'êtes pas autorisé à saisir des notes pour cette classe et cette matière.' };
  }

  const { error } = await supabase.from('school_grades').insert({
    organization_id: orgId,
    student_id: studentId,
    subject_id: formData.get('subject_id') as string,
    class_id: classId,
    exam_type: (formData.get('exam_type') as string) || 'Examen',
    score: Number(formData.get('score')),
    max_score: Number(formData.get('max_score')) || 20,
    semester: (formData.get('semester') as string) || 'S1',
    academic_year: (formData.get('academic_year') as string) || '2025-2026',
  });

  if (error) return { error: error.message };
  revalidatePath('/etablissement/resultats');
  return { success: true };
}

// ─── Report Cards ──────────────────────────────────────────────

export async function generateReportCards(
  classId: string,
  semester: string,
  academicYear: string,
  options?: { force?: boolean; includedExamTypes?: string[] | null }
) {
  const orgId = await requireOrgId();
  const supabase = await createClient();

  const canManage = await canManageAssignments();
  if (!canManage) {
    return { error: 'Seuls les directeurs peuvent générer les bulletins.' };
  }

  const { data: orgRow } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', orgId)
    .maybeSingle();
  const { parseSchoolOrgSettings } = await import('@/lib/school/school-org-settings');
  const schoolSettings = parseSchoolOrgSettings(
    (orgRow?.settings as Record<string, unknown>) ?? null
  );

  const { parseIncludedExamTypes, filterByIncludedExamTypes } = await import(
    '@/lib/school/bulletin-exam-types'
  );
  const includedExamTypes = parseIncludedExamTypes(options?.includedExamTypes);

  const { loadGradeGapReportForClass } = await import('@/lib/school/load-grade-gap-report');
  const { summarizeGradeGaps } = await import('@/lib/school/grade-gaps');
  const gapReport = await loadGradeGapReportForClass(
    orgId,
    classId,
    semester,
    academicYear,
    schoolSettings.grading_period_by_level,
    includedExamTypes
  );

  if (gapReport.hasGaps && !options?.force) {
    return {
      needsConfirmation: true as const,
      gapReport,
      gapSummary: summarizeGradeGaps(gapReport),
      message: `${gapReport.studentsWithGaps} élève(s) ont des notes manquantes (${gapReport.totalMissingSlots} case(s)). La note 0/20 est bien prise en compte dans la moyenne ; seules les cases vides sont signalées.`,
    };
  }

  const { data: { user } } = await supabase.auth.getUser();

  const { data: students } = await supabase
    .from('school_students')
    .select(STUDENT_WITH_PERSON)
    .eq('organization_id', orgId)
    .eq('class_id', classId)
    .eq('enrollment_status', 'enrolled');

  if (!students?.length) return { error: 'Aucun élève inscrit dans cette classe' };

  const [{ data: grades }, { data: evaluations }] = await Promise.all([
    supabase
      .from('school_grades')
      .select('student_id, subject_id, exam_type, score, max_score, school_subjects(coefficient)')
      .eq('organization_id', orgId)
      .eq('class_id', classId)
      .eq('semester', semester)
      .eq('academic_year', academicYear),
    supabase
      .from('school_grade_evaluations')
      .select('subject_id, exam_type')
      .eq('organization_id', orgId)
      .eq('class_id', classId)
      .eq('semester', semester)
      .eq('academic_year', academicYear),
  ]);

  const { computeStudentAverageFromGrades } = await import('@/lib/school/report-card-average');
  const { evaluateClassCompleteness } = await import('@/lib/school/report-card-completeness');

  const { isGradeRecorded } = await import('@/lib/school/grade-gaps');
  const gradeRows = filterByIncludedExamTypes(
    (grades ?? [])
      .filter((g) => isGradeRecorded(g.score))
      .map((g) => ({
        studentId: g.student_id as string,
        subjectId: g.subject_id as string,
        examType: (g.exam_type as string) ?? 'default',
        score: Number(g.score),
        maxScore: Number(g.max_score) || 20,
        coefficient: Number((g.school_subjects as { coefficient?: number })?.coefficient ?? 1),
      })),
    includedExamTypes
  );

  const completeness = evaluateClassCompleteness({
    classId,
    semester,
    academicYear,
    enrolledStudentIds: students.map((s) => s.id as string),
    evaluationSlots: filterByIncludedExamTypes(
      (evaluations ?? []).map((e) => ({
        subjectId: e.subject_id as string,
        examType: e.exam_type as string,
      })),
      includedExamTypes
    ),
    grades: gradeRows,
  });

  const completenessByStudent = new Map(
    completeness.perStudent.map((s) => [s.studentId, s.pct])
  );

  const cards = [];
  for (const student of students) {
    const studentId = student.id as string;
    const studentGrades = gradeRows.filter((g) => g.studentId === studentId);
    const average = computeStudentAverageFromGrades(studentGrades);
    const gradesCompletenessPct = completenessByStudent.get(studentId) ?? 0;

    const { data: existingCard } = await supabase
      .from('school_report_cards')
      .select('id, publication_status')
      .eq('student_id', student.id)
      .eq('semester', semester)
      .eq('academic_year', academicYear)
      .maybeSingle();

    if (existingCard?.publication_status === 'final') {
      cards.push({ student: personName(student), average, card: { id: existingCard.id } });
      continue;
    }

    const cardPayload = {
      organization_id: orgId,
      student_id: student.id,
      class_id: classId,
      semester,
      academic_year: academicYear,
      average_score: average,
      grades_completeness_pct: gradesCompletenessPct,
      included_exam_types: includedExamTypes,
      generated_by: user?.id,
      publication_status: 'draft' as const,
      locked_at: null,
    };

    let card: { id: string } | null = null;
    if (existingCard?.id) {
      const { data: updated } = await supabase
        .from('school_report_cards')
        .update({
          average_score: cardPayload.average_score,
          grades_completeness_pct: cardPayload.grades_completeness_pct,
          included_exam_types: cardPayload.included_exam_types,
          class_id: classId,
          generated_by: user?.id,
          generated_at: new Date().toISOString(),
        })
        .eq('id', existingCard.id)
        .select('id')
        .single();
      card = updated;
    } else {
      const { data: inserted } = await supabase
        .from('school_report_cards')
        .insert(cardPayload)
        .select('id')
        .single();
      card = inserted;
    }

    cards.push({ student: personName(student), average, card });
  }

  cards.sort((a, b) => b.average - a.average);
  for (let i = 0; i < cards.length; i++) {
    if (cards[i].card?.id) {
      await supabase.from('school_report_cards').update({ rank: i + 1 }).eq('id', cards[i].card.id);
    }
  }

  revalidatePath('/etablissement/bulletins');

  let aiBulletinGuidance: string | undefined;
  try {
    const { getAiTemplateContext, buildAdaptationPrompt } = await import('@/lib/ai/adapt-from-template');
    const { hasActiveLlmApi, queryKonaAI } = await import('@/lib/integrations/openai');
    const { buildOfflineTemplateGuidance } = await import('@/lib/ai/offline-template-guidance');
    const template = await getAiTemplateContext(orgId, 'school', 'school_bulletin');
    if (template) {
      const producedFileName = `Bulletins ${semester} ${academicYear}`;
      const producedDocType = `Classe, ${cards.length} élève(s)`;
      if (hasActiveLlmApi()) {
        const { systemContext, userPrompt } = buildAdaptationPrompt({
          sector: 'school',
          template,
          producedFileName,
          extraContext: `Classe ${classId}, ${cards.length} élèves, moyennes calculées.`,
        });
        aiBulletinGuidance = await queryKonaAI(userPrompt, systemContext, {
          organizationId: orgId,
          operation: 'report',
        });
      } else {
        aiBulletinGuidance = buildOfflineTemplateGuidance({
          sector: 'school',
          template,
          producedFileName,
          producedDocType,
        });
      }
    }
  } catch {
    /* optionnel */
  }

  return {
    cards,
    count: cards.length,
    aiBulletinGuidance,
    completeness: {
      averagePct: completeness.averageCompletenessPct,
      evaluationSlots: completeness.evaluationSlots,
      studentsFullyComplete: completeness.studentsFullyComplete,
      enrolledCount: completeness.enrolledCount,
    },
  };
}

export async function getReportCards(orgId: string) {
  const supabase = await createClient();
  const session = await getSession();
  const caps = getEtablissementCapabilities(session?.profile?.role);

  let query = supabase
    .from('school_report_cards')
    .select(`*, school_students(${STUDENT_NESTED}), school_classes(name)`)
    .eq('organization_id', orgId)
    .order('generated_at', { ascending: false });

  if (caps.viewOwnBulletinsOnly) {
    const studentId = await getLinkedSchoolStudentId();
    if (!studentId) return [];
    query = query.eq('student_id', studentId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ─── Import élèves (CSV / Excel) ─────────────────────────────

export interface StudentImportBatchResult {
  created: number;
  updated: number;
  skipped: number;
  matricules_assigned: number;
  sms_sent: number;
  errors: { line: number; message: string }[];
}

function normalizeStudentName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ');
}

async function ensureEnrollmentForImportedStudent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    orgId: string;
    studentId: string;
    classId: string;
    row: StudentImportRow;
    enrollmentStatus: 'enrolled' | 'pending';
    academicYear: string;
  }
) {
  const guardianPhone =
    params.row.guardian_phone?.trim() || params.row.phone?.trim() || null;
  const guardianSmsConsent =
    params.row.guardian_sms_consent ??
    Boolean(params.row.guardian_phone?.trim() && params.row.guardian_sms_consent !== false);

  const enrollmentPatch = {
    class_id: params.classId,
    status: params.enrollmentStatus === 'enrolled' ? 'enrolled' : 'pending',
    guardian_name: params.row.guardian_name?.trim() || null,
    guardian_phone: guardianPhone,
    guardian_sms_consent: guardianSmsConsent,
    applicant_name: params.row.full_name,
    applicant_phone: params.row.phone?.trim() || null,
    applicant_email: params.row.email?.trim() || null,
  };

  const { data: existing } = await supabase
    .from('school_enrollments')
    .select('id')
    .eq('organization_id', params.orgId)
    .eq('student_id', params.studentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from('school_enrollments')
      .update(enrollmentPatch)
      .eq('id', existing.id);
  } else {
    await supabase.from('school_enrollments').insert({
      organization_id: params.orgId,
      student_id: params.studentId,
      academic_year: params.academicYear,
      request_type: 'new',
      notes: 'Import liste KonaData',
      ...enrollmentPatch,
    });
  }
}

export async function importSchoolStudentsBatch(
  classId: string,
  rows: StudentImportRow[],
  enrollmentStatus: 'enrolled' | 'pending' = 'enrolled',
  options?: { autoGenerateMatricules?: boolean; sendSmsToGuardians?: boolean }
): Promise<StudentImportBatchResult | { error: string }> {
  const guard = await assertSchoolCapability('manageStudents');
  if ('error' in guard) return guard;

  if (!classId) return { error: 'Sélectionnez une classe.' };
  if (!rows.length) return { error: 'Aucune ligne à importer.' };
  if (rows.length > MAX_STUDENT_IMPORT_ROWS) {
    return { error: `Maximum ${MAX_STUDENT_IMPORT_ROWS} élèves par fichier.` };
  }

  const orgId = await requireOrgId();
  const supabase = await createClient();

  const [{ data: cls }, { data: org }] = await Promise.all([
    supabase
      .from('school_classes')
      .select('id, name, academic_year')
      .eq('id', classId)
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .maybeSingle(),
    supabase.from('organizations').select('name').eq('id', orgId).maybeSingle(),
  ]);

  if (!cls) return { error: 'Classe introuvable.' };
  const className = (cls.name as string) || null;
  const orgName = (org?.name as string) || 'Établissement';
  const academicYear = (cls.academic_year as string) || '2025-2026';

  const { data: matriculeSettingsRaw } = await supabase.rpc('school_student_matricule_settings', {
    p_org_id: orgId,
  });
  const matriculeSettings = parseStudentMatriculeSettings(matriculeSettingsRaw);
  const autoGenerate =
    options?.autoGenerateMatricules ?? matriculeSettings.auto_generate_on_import;

  const result: StudentImportBatchResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    matricules_assigned: 0,
    sms_sent: 0,
    errors: [],
  };

  const smsQueue: Array<{
    row: StudentImportRow;
    studentId: string;
    matricule: string | null;
  }> = [];

  const { data: existingStudents } = await supabase
    .from('school_students')
    .select('id, matricule, class_id, core_persons(full_name)')
    .eq('organization_id', orgId);

  const matriculeToId = new Map<string, string>();
  const nameWithoutMatriculeToId = new Map<string, string>();
  for (const s of existingStudents ?? []) {
    const m = (s.matricule as string)?.trim();
    if (m) {
      matriculeToId.set(m.toUpperCase(), s.id as string);
    } else if ((s.class_id as string) === classId) {
      const person = (s.core_persons ?? {}) as { full_name?: string };
      const nameKey = normalizeStudentName(person.full_name ?? '');
      if (nameKey && !nameWithoutMatriculeToId.has(nameKey)) {
        nameWithoutMatriculeToId.set(nameKey, s.id as string);
      }
    }
  }

  async function resolveMatricule(provided: string | undefined): Promise<string | null> {
    const trimmed = provided?.trim();
    if (trimmed) return trimmed;
    if (!autoGenerate) return null;
    const { data, error } = await supabase.rpc('allocate_school_student_matricule', {
      p_org_id: orgId,
      p_class_id: classId,
      p_commit: true,
    });
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Génération du code élève impossible');
    result.matricules_assigned++;
    const code = String(data).trim();
    matriculeToId.set(code.toUpperCase(), '__pending__');
    return code;
  }

  let hasEnrolled = false;

  for (const row of rows) {
    try {
      const matKey = row.matricule?.trim().toUpperCase();
      if (matKey && matriculeToId.has(matKey) && matriculeToId.get(matKey) !== '__pending__') {
        const studentId = matriculeToId.get(matKey)!;
        const { error: updErr } = await supabase
          .from('school_students')
          .update({
            class_id: classId,
            enrollment_status: enrollmentStatus,
            enrollment_source: 'import',
          })
          .eq('id', studentId)
          .eq('organization_id', orgId);

        if (updErr) {
          result.errors.push({ line: row.sourceLine, message: updErr.message });
          result.skipped++;
        } else {
          result.updated++;
          if (enrollmentStatus === 'enrolled') hasEnrolled = true;
          await ensureEnrollmentForImportedStudent(supabase, {
            orgId,
            studentId,
            classId,
            row,
            enrollmentStatus,
            academicYear,
          });
          const { data: stu } = await supabase
            .from('school_students')
            .select('matricule')
            .eq('id', studentId)
            .maybeSingle();
          smsQueue.push({
            row,
            studentId,
            matricule: (stu?.matricule as string) || row.matricule?.trim() || null,
          });
        }
        continue;
      }

      if (matKey && matriculeToId.has(matKey)) {
        result.errors.push({
          line: row.sourceLine,
          message: `Code élève déjà utilisé dans ce fichier : ${row.matricule}`,
        });
        result.skipped++;
        continue;
      }

      const nameKey = normalizeStudentName(row.full_name);
      const existingByName = nameWithoutMatriculeToId.get(nameKey);
      if (existingByName) {
        const matricule = await resolveMatricule(row.matricule);
        const { error: updErr } = await supabase
          .from('school_students')
          .update({
            class_id: classId,
            enrollment_status: enrollmentStatus,
            enrollment_source: 'import',
            ...(matricule ? { matricule } : {}),
          })
          .eq('id', existingByName)
          .eq('organization_id', orgId)
          .is('matricule', null);

        if (updErr) {
          result.errors.push({ line: row.sourceLine, message: updErr.message });
          result.skipped++;
        } else {
          result.updated++;
          if (enrollmentStatus === 'enrolled') hasEnrolled = true;
          if (matricule) {
            matriculeToId.set(matricule.toUpperCase(), existingByName);
            nameWithoutMatriculeToId.delete(nameKey);
          }
          await ensureEnrollmentForImportedStudent(supabase, {
            orgId,
            studentId: existingByName,
            classId,
            row,
            enrollmentStatus,
            academicYear,
          });
          smsQueue.push({ row, studentId: existingByName, matricule: matricule ?? null });
        }
        continue;
      }

      const matricule = await resolveMatricule(row.matricule);

      const personId = await createCorePerson(
        orgId,
        enrollmentStatus === 'pending' ? 'candidate' : 'student',
        {
          full_name: row.full_name,
          email: row.email ?? null,
          phone: row.phone ?? null,
        }
      );

      const { data: inserted, error: insErr } = await supabase
        .from('school_students')
        .insert({
          organization_id: orgId,
          person_id: personId,
          matricule,
          class_id: classId,
          enrollment_status: enrollmentStatus,
          enrollment_source: 'import',
          enrollment_date: new Date().toISOString().slice(0, 10),
        })
        .select('id')
        .single();

      if (insErr) {
        result.errors.push({ line: row.sourceLine, message: insErr.message });
        result.skipped++;
      } else {
        result.created++;
        if (enrollmentStatus === 'enrolled') hasEnrolled = true;
        if (inserted?.id) {
          await ensureEnrollmentForImportedStudent(supabase, {
            orgId,
            studentId: inserted.id as string,
            classId,
            row,
            enrollmentStatus,
            academicYear,
          });
          smsQueue.push({
            row,
            studentId: inserted.id as string,
            matricule: matricule ?? null,
          });
          if (matricule) {
            matriculeToId.set(matricule.toUpperCase(), inserted.id as string);
          }
        }
      }
    } catch (e) {
      result.errors.push({
        line: row.sourceLine,
        message: e instanceof Error ? e.message : 'Erreur inconnue',
      });
      result.skipped++;
    }
  }

  if (hasEnrolled) {
    await supabase.rpc('refresh_school_platform_invoice', { p_org_id: orgId });
  }

  if (options?.sendSmsToGuardians && enrollmentStatus === 'enrolled') {
    const { notifyImportWelcome } = await import('@/lib/school/enrollment-notifications');
    for (const item of smsQueue) {
      const guardianPhone =
        item.row.guardian_phone?.trim() || item.row.phone?.trim() || null;
      const consent =
        item.row.guardian_sms_consent ??
        Boolean(item.row.guardian_phone?.trim());
      const sms = await notifyImportWelcome({
        guardianPhone,
        guardianSmsConsent: consent,
        studentName: item.row.full_name,
        matricule: item.matricule,
        orgName,
        className,
      });
      if (sms.sent) result.sms_sent += 1;
    }
  }

  revalidatePath('/etablissement');
  revalidatePath('/etablissement/etudiants');
  revalidatePath('/etablissement/candidatures');
  revalidatePath('/etablissement/formations');
  revalidatePath('/etablissement/paiements');
  revalidatePath('/parametres/facturation');

  return result;
}
