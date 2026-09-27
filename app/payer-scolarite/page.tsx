import { listPublicSchools } from '@/lib/actions/learner-onboarding';
import { PayerScolariteClient } from './payer-scolarite-client';
import { PaymentsUnavailableNotice } from '@/components/billing/payments-unavailable';
import { PLATFORM_ONLINE_PAYMENTS_ENABLED } from '@/lib/billing/payments-availability';

export default async function PayerScolaritePage() {
  if (!PLATFORM_ONLINE_PAYMENTS_ENABLED) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
        <div className="max-w-lg w-full">
          <PaymentsUnavailableNotice />
        </div>
      </div>
    );
  }
  const schools = await listPublicSchools();
  return <PayerScolariteClient schools={schools} />;
}
