import { postPublicJson } from '@/lib/http/public-json-fetch';

export type ContactAccountOption = {
  id: string;
  label: string;
  authEmail: string;
};

export async function listContactAccounts(params: {
  method: 'phone' | 'email';
  phone?: string;
  email?: string;
}): Promise<{ accounts: ContactAccountOption[]; error?: string }> {
  const result = await postPublicJson<{
    accounts?: ContactAccountOption[];
    error?: string;
  }>('/api/auth/list-contact-accounts', params);
  if (!result.ok) return { accounts: [], error: result.error };
  return { accounts: result.data.accounts ?? [] };
}
