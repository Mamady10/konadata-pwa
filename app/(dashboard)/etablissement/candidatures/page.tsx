import { getEnrollments, getClasses, getEnrollmentDocuments } from '@/lib/actions/school';
import { listReenrollmentCodes } from '@/lib/actions/learner-onboarding';
import {
  getStudentPaymentSettings,
  getStudentPaymentSettingsForOrgs,
  getOrgDefaultTuitionFees,
  getTuitionBalancesForEnrollments,
} from '@/lib/actions/student-payments';
import type { StudentPaymentSettings } from '@/lib/school/student-payments';
import { DEFAULT_STUDENT_PAYMENT_SETTINGS } from '@/lib/school/student-payments';
import { CandidaturesClient } from './candidatures-client';
import { redirect } from 'next/navigation';
import { requireEtablissementPage } from '@/lib/school/require-etablissement-page';
import { getEtablissementCapabilities } from '@/lib/school/etablissement-access';
import { reenrollmentCodeFormatExample } from '@/lib/school/reenrollment-code';

export default async function CandidaturesPage() {
  const session = await requireEtablissementPage('candidatures');
  const caps = getEtablissementCapabilities(session.profile?.role);
  const orgId = session.profile?.organization_id;
  const isLearnerPortal = caps.manageOwnEnrollment && !caps.manageEnrollments;

  if (!orgId && !isLearnerPortal) redirect('/etablissement');

  let enrollments: Record<string, unknown>[] = [];
  let classes: { id: string; name: string }[] = [];
  let documents: Awaited<ReturnType<typeof getEnrollmentDocuments>> = [];
  let reenrollmentCodes: Awaited<ReturnType<typeof listReenrollmentCodes>> = [];
  let studentPaymentSettings: StudentPaymentSettings | null = null;
  let paymentSettingsByOrg: Record<string, StudentPaymentSettings> = {};
  const loadErrors: string[] = [];

  const wantsDocuments = caps.viewEnrollmentDocuments || caps.manageOwnEnrollment;
  const wantsReenrollmentCodes = caps.manageEnrollments && Boolean(orgId);

  // Ces requêtes sont indépendantes : on les lance en parallèle pour réduire
  // fortement le temps de chargement de la page (au lieu de 5 allers-retours en série).
  const [
    enrollmentsRes,
    classesRes,
    documentsRes,
    reenrollmentCodesRes,
    paymentSettingsRes,
  ] = await Promise.allSettled([
    getEnrollments(orgId ?? ''),
    orgId ? getClasses(orgId) : Promise.resolve([]),
    wantsDocuments ? getEnrollmentDocuments(orgId ?? '') : Promise.resolve([]),
    wantsReenrollmentCodes && orgId
      ? listReenrollmentCodes(orgId)
      : Promise.resolve([]),
    orgId ? getStudentPaymentSettings() : Promise.resolve(null),
  ]);

  if (enrollmentsRes.status === 'fulfilled') {
    enrollments = enrollmentsRes.value as Record<string, unknown>[];
  } else {
    loadErrors.push(
      enrollmentsRes.reason instanceof Error
        ? enrollmentsRes.reason.message
        : 'Impossible de charger les demandes d’inscription.'
    );
  }

  if (orgId) {
    if (classesRes.status === 'fulfilled') {
      classes = (classesRes.value as { id: string; name: string }[]).map((c) => ({
        id: c.id as string,
        name: c.name as string,
      }));
    } else {
      loadErrors.push(
        classesRes.reason instanceof Error
          ? classesRes.reason.message
          : 'Impossible de charger les classes.'
      );
    }
  }

  if (wantsDocuments) {
    if (documentsRes.status === 'fulfilled') {
      documents = documentsRes.value as typeof documents;
    } else {
      loadErrors.push(
        documentsRes.reason instanceof Error
          ? documentsRes.reason.message
          : 'Impossible de charger les pièces jointes.'
      );
    }
  }

  if (wantsReenrollmentCodes) {
    if (reenrollmentCodesRes.status === 'fulfilled') {
      reenrollmentCodes = reenrollmentCodesRes.value as typeof reenrollmentCodes;
    } else {
      loadErrors.push(
        reenrollmentCodesRes.reason instanceof Error
          ? reenrollmentCodesRes.reason.message
          : 'Impossible de charger les codes réinscription.'
      );
    }
  }

  if (orgId && paymentSettingsRes.status === 'fulfilled' && paymentSettingsRes.value) {
    const { settings } = paymentSettingsRes.value as { settings: StudentPaymentSettings };
    studentPaymentSettings = settings;
    paymentSettingsByOrg[orgId] = settings;
  }

  const enrollmentOrgIds = [
    ...new Set(
      enrollments
        .map((e) => e.organization_id as string | undefined)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  let orgTuitionDefaults: Record<string, number> = {};
  if (enrollmentOrgIds.length > 0) {
    const [byOrg, tuitionDefaults] = await Promise.all([
      getStudentPaymentSettingsForOrgs(enrollmentOrgIds),
      getOrgDefaultTuitionFees(enrollmentOrgIds),
    ]);
    paymentSettingsByOrg = { ...paymentSettingsByOrg, ...byOrg };
    orgTuitionDefaults = tuitionDefaults;
    if (!studentPaymentSettings && caps.manageOwnEnrollment) {
      const first = enrollmentOrgIds[0];
      studentPaymentSettings = byOrg[first] ?? DEFAULT_STUDENT_PAYMENT_SETTINGS;
    }
  }

  if (caps.manageOwnEnrollment && enrollments.length > 0) {
    const balanceItems = enrollments
      .filter((e) => {
        const sid = (e.student_id as string) || null;
        const eid = e.id as string;
        return sid && ['admitted', 'enrolled'].includes((e.status as string) || '');
      })
      .map((e) => ({
        studentId: e.student_id as string,
        enrollmentId: e.id as string,
      }));
    if (balanceItems.length > 0) {
      const balances = await getTuitionBalancesForEnrollments(balanceItems);
      enrollments = enrollments.map((e) => ({
        ...e,
        tuition_balance: balances[e.id as string] ?? null,
      }));
    }
  }

  const organizationName =
    (session.profile?.organizations as { name?: string } | null)?.name ?? '';
  const reenrollmentCodeExample = reenrollmentCodeFormatExample(organizationName);

  return (
    <CandidaturesClient
      enrollments={enrollments}
      classes={classes}
      documents={documents}
      canManage={caps.manageEnrollments}
      canApplySelf={caps.manageOwnEnrollment}
      canCreateRequest={caps.createEnrollmentRequest}
      canSubmitDocuments={caps.submitEnrollmentDocuments}
      canViewDocuments={caps.viewEnrollmentDocuments || caps.manageOwnEnrollment}
      isDirector={caps.generateReportCards}
      reenrollmentCodes={reenrollmentCodes}
      loadErrors={loadErrors}
      organizationName={organizationName || undefined}
      reenrollmentCodeExample={reenrollmentCodeExample}
      studentPaymentSettings={studentPaymentSettings}
      paymentSettingsByOrg={paymentSettingsByOrg}
      orgTuitionDefaults={orgTuitionDefaults}
    />
  );
}
