import { getReportCards, getClasses } from '@/lib/actions/school';
import { BulletinsClient } from './bulletins-client';
import { redirect } from 'next/navigation';
import { requireEtablissementPage } from '@/lib/school/require-etablissement-page';
import { getEtablissementCapabilities } from '@/lib/school/etablissement-access';
import {
  getBulletinBrandingStatus,
  repairBulletinBrandingCache,
} from '@/lib/actions/bulletin-branding';
import { getBulletinReferenceInfo } from '@/lib/actions/bulletin-reference';
import { getSchoolOrgSettings } from '@/lib/actions/school-settings';
import type { EducationLevelBand } from '@/lib/school/grading-period-settings';

export default async function BulletinsPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; semester?: string; year?: string }>;
}) {
  const qs = await searchParams;
  const session = await requireEtablissementPage('bulletins');
  const caps = getEtablissementCapabilities(session.profile?.role);
  const orgId = session.profile?.organization_id;
  if (!orgId) redirect('/etablissement');

  let reportCards: Record<string, unknown>[] = [];
  let classes: { id: string; name: string }[] = [];
  const loadErrors: string[] = [];

  try {
    reportCards = await getReportCards(orgId);
  } catch (e) {
    loadErrors.push(
      e instanceof Error ? e.message : 'Impossible de charger les bulletins.'
    );
  }

  try {
    const rows = await getClasses(orgId);
    classes = rows.map((c) => ({
      id: c.id as string,
      name: c.name as string,
      level: (c.level as string) || null,
      education_level_band: (c.education_level_band as EducationLevelBand) || null,
    }));
  } catch (e) {
    loadErrors.push(e instanceof Error ? e.message : 'Impossible de charger les classes.');
  }

  await repairBulletinBrandingCache();

  const [{ settings: schoolSettings }, bulletinReference, branding] = await Promise.all([
    getSchoolOrgSettings(),
    getBulletinReferenceInfo(),
    getBulletinBrandingStatus(),
  ]);

  return (
    <BulletinsClient
      reportCards={reportCards}
      classes={classes}
      canGenerate={caps.generateReportCards}
      ownBulletinsOnly={caps.viewOwnBulletinsOnly}
      defaultAcademicYear={schoolSettings.default_academic_year}
      bulletinReference={bulletinReference}
      branding={branding}
      initialClassId={qs.classId}
      initialSemester={qs.semester}
      initialAcademicYear={qs.year}
      gradingPeriodByLevel={schoolSettings.grading_period_by_level}
      bulletinDefaultExamTypes={schoolSettings.bulletin_default_exam_types}
      loadErrors={loadErrors}
    />
  );
}
