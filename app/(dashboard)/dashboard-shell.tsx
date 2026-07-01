'use client';

import { AppProvider } from '@/lib/contexts/app-context';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { QueryProvider } from '@/components/providers/query-provider';
import type { AppRole, Organization } from '@/types/database';

export interface DashboardInitialProfile {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
  organization: Organization | null;
  assistantNavVisible?: boolean;
}

export function DashboardShell({
  children,
  initialProfile,
}: {
  children: React.ReactNode;
  initialProfile: DashboardInitialProfile | null;
}) {
  return (
    <QueryProvider>
      <AppProvider initialProfile={initialProfile}>
        <DashboardLayout>{children}</DashboardLayout>
      </AppProvider>
    </QueryProvider>
  );
}
