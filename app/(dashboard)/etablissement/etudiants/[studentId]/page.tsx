import { redirect, notFound } from 'next/navigation';
import { getStudentDossier } from '@/lib/actions/student-dossier';
import { requireEtablissementPage } from '@/lib/school/require-etablissement-page';
import { StudentDossierClient } from './student-dossier-client';

interface Props {
  params: Promise<{ studentId: string }>;
}

export default async function StudentDossierPage({ params }: Props) {
  await requireEtablissementPage('etudiants');
  const { studentId } = await params;
  const result = await getStudentDossier(studentId);

  if ('error' in result) {
    if (result.error === 'Non autorisé') redirect('/etablissement/etudiants');
    notFound();
  }

  return <StudentDossierClient dossier={result} />;
}
