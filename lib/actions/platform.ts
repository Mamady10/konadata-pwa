'use server';

import { createClient } from '@/lib/supabase/server';

export async function getPlatformStats() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_platform_stats');

  if (error) {
    throw error;
  }

  const raw = data as {
    organisations: number;
    utilisateurs: number;
    documents: number;
    etudiants: number;
    projets_ong: number;
    chantiers_btp: number;
    orgs_by_type: { type: string; count: number }[];
    recent_orgs: { id: string; name: string; type: string; created_at: string }[];
  };

  return {
    kpis: {
      organisations: raw.organisations ?? 0,
      utilisateurs: raw.utilisateurs ?? 0,
      documents: raw.documents ?? 0,
      etudiants: raw.etudiants ?? 0,
      projetsOng: raw.projets_ong ?? 0,
      chantiersBtp: raw.chantiers_btp ?? 0,
    },
    orgsByType: raw.orgs_by_type ?? [],
    recentOrgs: (raw.recent_orgs ?? []).map((o) => ({
      id: o.id,
      name: o.name,
      type: o.type,
      date: new Date(o.created_at).toLocaleDateString('fr-FR'),
    })),
  };
}
