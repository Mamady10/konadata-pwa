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
  const loadErrors: string[] = [];

  try {
    enrollments = await getEnrollments(orgId ?? '');
  } catch (e) {
    loadErrors.push(
      e instanceof Error ? e.message : 'Impossible de charger les demandes d’inscription.'
    );
  }

  if (orgId) {
    try {
      const cls = await getClasses(orgId);
      classes = cls.map((c) => ({ id: c.id as string, name: c.name as string }));
    } catch (e) {
      loadErrors.push(e instanceof Error ? e.message : 'Impossible de charger les classes.');
    }
  }

  if (caps.viewEnrollmentDocuments || caps.manageOwnEnrollment) {
    try {
      documents = await getEnrollmentDocuments(orgId ?? '');
    } catch (e) {
      loadErrors.push(
        e instanceof Error ? e.message : 'Impossible de charger les pièces jointes.'
      );
    }
  }

  if (caps.manageEnrollments && orgId) {
    try {
      reenrollmentCodes = await listReenrollmentCodes(orgId);
    } catch (e) {
      loadErrors.push(e instanceof Error ? e.message : 'Impossible de charger les codes réinscription.');
    }
  }

  let studentPaymentSettings: StudentPaymentSettings | null = null;
  let paymentSettingsByOrg: Record<string, StudentPaymentSettings> = {};

  const enrollmentOrgIds = [
    ...new Set(
      enrollments
        .map((e) => e.organization_id as string | undefined)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  if (orgId) {
    const { settings } = await getStudentPaymentSettings();
    studentPaymentSettings = settings;
    paymentSettingsByOrg[orgId] = settings;
  }

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
