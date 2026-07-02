import {
  getPayments,
  getClasses,
  getSchoolFinanceByClass,
  getEnrollmentOptionsForStaffPayments,
  getOrgDefaultAcademicYear,
  getUnassignedEnrolledStudents,
} from '@/lib/actions/school';
import type { UnassignedEnrolledStudent } from '@/lib/actions/school';
import { getStudentPaymentSettings } from '@/lib/actions/student-payments';
import { getTuitionDebtors } from '@/lib/actions/tuition-finance';
import type { TuitionDebtorRow } from '@/lib/school/tuition-debtors';

import { PaiementsClient } from './paiements-client';

import { redirect } from 'next/navigation';

import { requireEtablissementPage } from '@/lib/school/require-etablissement-page';

import { getEtablissementCapabilities } from '@/lib/school/etablissement-access';

import { personName } from '@/lib/school/person-utils';



export default async function PaiementsPage() {

  const session = await requireEtablissementPage('paiements');

  const caps = getEtablissementCapabilities(session.profile?.role);

  const orgId = session.profile?.organization_id;

  if (!orgId) redirect('/etablissement');

  const academicYear = await getOrgDefaultAcademicYear(orgId);

  let payments: Record<string, unknown>[] = [];

  let students: { id: string; full_name: string; matricule?: string }[] = [];

  let classes: { id: string; name: string }[] = [];

  let financeOverview: Awaited<ReturnType<typeof getSchoolFinanceByClass>> | null = null;
  const loadErrors: string[] = [];

  try {
    const rawPayments = await getPayments(orgId);
    payments = rawPayments.map((p) => {

      const student = p.school_students as Record<string, unknown>;

      const classRef = student?.school_classes as { name?: string } | null;

      return {

        ...p,

        class_id: (student?.class_id as string) || null,

        class_name: classRef?.name || 'Sans classe',

        student_name: personName(student),

      };

    });
  } catch (e) {
    loadErrors.push(
      e instanceof Error ? e.message : 'Impossible de charger les paiements.'
    );
  }

  try {
    const allClasses = await getClasses(orgId);
    classes = allClasses.map((c) => ({ id: c.id as string, name: c.name as string }));
  } catch (e) {
    loadErrors.push(e instanceof Error ? e.message : 'Impossible de charger les classes.');
  }

  if (caps.recordPayments) {
    try {
      const { getStudentOptions } = await import('@/lib/actions/school');
      students = await getStudentOptions(orgId);
    } catch (e) {
      loadErrors.push(e instanceof Error ? e.message : 'Impossible de charger les élèves.');
    }
  }

  let unassignedStudents: UnassignedEnrolledStudent[] = [];

  if (caps.viewFinanceStats) {
    try {
      financeOverview = await getSchoolFinanceByClass(orgId);
    } catch (e) {
      loadErrors.push(
        e instanceof Error ? e.message : 'Impossible de charger la synthèse financière.'
      );
    }
    try {
      unassignedStudents = await getUnassignedEnrolledStudents(orgId);
    } catch {
      // non bloquant
    }
  }



  let minPaymentGnf = 100_000;
  let paymentSettings = null;
  let enrollments: Awaited<ReturnType<typeof getEnrollmentOptionsForStaffPayments>> = [];
  let debtors: TuitionDebtorRow[] = [];
  let debtorsLoadError: string | null = null;

  const canViewTuitionFinance =
    caps.viewPayments || caps.recordPayments || caps.viewFinanceStats;

  if (orgId && canViewTuitionFinance) {
    try {
      const { settings } = await getStudentPaymentSettings();
      minPaymentGnf = settings.min_payment_gnf;
      paymentSettings = settings;
    } catch (e) {
      loadErrors.push(
        e instanceof Error ? e.message : 'Impossible de charger les paramètres de paiement.'
      );
    }
    const debtorResult = await getTuitionDebtors();
    if (debtorResult.error) debtorsLoadError = debtorResult.error;
    else debtors = debtorResult.debtors;
  }

  if (orgId && caps.recordPayments) {
    enrollments = await getEnrollmentOptionsForStaffPayments(orgId);
  }

  return (
    <PaiementsClient
      payments={payments}
      students={students}
      classes={classes}
      canRecord={caps.recordPayments}
      viewByClass={caps.viewPaymentsByClass}
      financeOverview={financeOverview}
      minPaymentGnf={minPaymentGnf}
      paymentSettings={paymentSettings}
      enrollments={enrollments}
      academicYear={academicYear}
      debtors={debtors}
      canViewDebtors={canViewTuitionFinance}
      unassignedStudents={unassignedStudents}
      canReassignClass={caps.manageStudents}
      loadErrors={loadErrors}
      debtorsLoadError={debtorsLoadError}
    />
  );

}

