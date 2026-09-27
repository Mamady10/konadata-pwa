import { getSession } from '@/lib/actions/auth';
import { resolveAssistantNavVisible } from '@/lib/ai/chat/assistant-nav-server';
import { DashboardShell, type DashboardInitialProfile } from './dashboard-shell';
import type { Organization } from '@/types/database';
import type { AppRole } from '@/types/database';
import { createClient } from '@/lib/supabase/server';

/** Accès aux devis délégué par le directeur (menu « Devis » pour un chef de chantier). */
async function resolveBtpQuoteAccess(profileId: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('btp_quote_access')
      .select('profile_id')
      .eq('profile_id', profileId)
      .maybeSingle();
    return !error && Boolean(data);
  } catch {
    return false;
  }
}

export default async function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const [assistantNavVisible, btpQuoteAccess] = await Promise.all([
    resolveAssistantNavVisible(),
    session?.profile?.role === 'btp_staff' ? resolveBtpQuoteAccess(session.profile.id) : false,
  ]);

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
      btpQuoteAccess,
    };
  }

  return <DashboardShell initialProfile={initialProfile}>{children}</DashboardShell>;
}
