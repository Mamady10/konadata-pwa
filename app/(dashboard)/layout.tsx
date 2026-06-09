import { getSession } from '@/lib/actions/auth';
import { resolveAssistantNavVisible } from '@/lib/ai/chat/assistant-nav-server';
import { DashboardShell, type DashboardInitialProfile } from './dashboard-shell';
import type { Organization } from '@/types/database';
import type { AppRole } from '@/types/database';

export default async function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const assistantNavVisible = await resolveAssistantNavVisible();

  let initialProfile: DashboardInitialProfile | null = null;
  if (session?.profile) {
    const p = session.profile;
    initialProfile = {
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      role: p.role as AppRole,
      organization: (p.organizations as Organization | null) ?? null,
      assistantNavVisible,
    };
  }

  return <DashboardShell initialProfile={initialProfile}>{children}</DashboardShell>;
}
