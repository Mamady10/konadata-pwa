import { listPublicSchools } from '@/lib/actions/learner-onboarding';
import { SuiviScolariteClient } from './suivi-scolarite-client';

export const metadata = {
  title: 'Suivi scolarité — KonaData',
  description: 'Consultez le statut d\'inscription, le solde et le bulletin de votre enfant (confirmation SMS)',
};

export default async function SuiviScolaritePage() {
  const schools = await listPublicSchools();
  return <SuiviScolariteClient schools={schools} />;
}
