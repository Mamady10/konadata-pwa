'use client';

import { useQuery } from '@tanstack/react-query';
import { getBtpDashboard, getPersonalBtpDashboard } from '@/lib/actions/btp';

const BTP_DASHBOARD_STALE_MS = 60_000;

export function useBtpOrgDashboard(orgId: string, enabled = true) {
  return useQuery({
    queryKey: ['btp-dashboard', orgId],
    queryFn: () => getBtpDashboard(orgId),
    staleTime: BTP_DASHBOARD_STALE_MS,
    enabled: enabled && Boolean(orgId),
    placeholderData: (previous) => previous,
  });
}

export function useBtpPersonalDashboard(orgId: string, enabled = true) {
  return useQuery({
    queryKey: ['btp-dashboard-personal', orgId],
    queryFn: () => getPersonalBtpDashboard(orgId),
    staleTime: BTP_DASHBOARD_STALE_MS,
    enabled: enabled && Boolean(orgId),
    placeholderData: (previous) => previous,
  });
}
