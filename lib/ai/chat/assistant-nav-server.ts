'use server';

import { getSession } from '@/lib/actions/auth';
import { getOrganizationAiQuotaStatus } from '@/lib/ai/quota/ai-quota';
import { isAssistantNavVisible } from '@/lib/ai/chat/assistant-access';
import type { AppRole } from '@/types/database';

export async function resolveAssistantNavVisible(): Promise<boolean> {
  const session = await getSession();
  if (!session?.profile) return false;

  const role = session.profile.role as AppRole;
  const orgId = session.profile.organization_id;

  if (role === 'platform_admin') return true;
  if (!orgId) return false;

  const quota = await getOrganizationAiQuotaStatus(orgId);
  const tier = 'error' in quota ? null : quota.tier;
  return isAssistantNavVisible(role, tier);
}
