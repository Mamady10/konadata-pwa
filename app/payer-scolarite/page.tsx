import { listPublicSchools } from '@/lib/actions/learner-onboarding';
import { PayerScolariteClient } from './payer-scolarite-client';

export default async function PayerScolaritePage() {
  const schools = await listPublicSchools();
  return <PayerScolariteClient schools={schools} />;
}
