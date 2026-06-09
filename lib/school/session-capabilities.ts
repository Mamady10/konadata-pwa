import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/actions/auth';
import {
  getEtablissementCapabilities,
  type EtablissementCapabilities,
} from '@/lib/school/etablissement-access';
import { parseSchoolOrgSettings } from '@/lib/school/school-org-settings';
import type { AppRole } from '@/types/database';

export async function getSessionEtablissementCapabilities(): Promise<EtablissementCapabilities> {
  const session = await getSession();
  const role = session?.profile?.role as AppRole | undefined;
  const orgId = session?.profile?.organization_id;
  if (!orgId) return getEtablissementCapabilities(role);

  const supabase = await createClient();
  const { data: org } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', orgId)
    .maybeSingle();

  const school = parseSchoolOrgSettings(
    (org?.settings as Record<string, unknown>) ?? null
  );

  return getEtablissementCapabilities(role, {
    registrarCanRecordPayments: school.registrar_can_record_payments,
  });
}
