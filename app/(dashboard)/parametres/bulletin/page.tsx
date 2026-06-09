import { redirect } from 'next/navigation';
import { getSession } from '@/lib/actions/auth';
import {
  getBulletinBrandingStatus,
  repairBulletinBrandingCache,
} from '@/lib/actions/bulletin-branding';
import { getBulletinReferenceInfo } from '@/lib/actions/bulletin-reference';
import { getSchoolOrgSettings } from '@/lib/actions/school-settings';
import { getEtablissementCapabilities } from '@/lib/school/etablissement-access';
import { BulletinTemplateClient } from './bulletin-client';

export default async function BulletinTemplatePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const caps = getEtablissementCapabilities(session.profile?.role);
  if (!caps.isDirector) redirect('/parametres');

  await repairBulletinBrandingCache();

  const [{ settings, error }, reference, branding] = await Promise.all([
    getSchoolOrgSettings(),
    getBulletinReferenceInfo(),
    getBulletinBrandingStatus(),
  ]);
  if (error && error.includes('Réservé')) redirect('/parametres');

  return (
    <BulletinTemplateClient
      initialTemplate={settings.bulletin_template}
      initialGradingByLevel={settings.grading_period_by_level}
      initialDefaultExamTypes={settings.bulletin_default_exam_types}
      reference={reference}
      branding={branding}
      loadError={error}
    />
  );
}
