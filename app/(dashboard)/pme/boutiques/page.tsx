import { requirePmePage } from '@/lib/pme/require-pme-page';
import {
  getPmeBoutiques,
  createPmeBoutique,
  type PmeBoutiqueRow,
} from '@/lib/actions/pme';
import { PmeBoutiquesClient } from './pme-boutiques-client';

export default async function Page() {
  const session = await requirePmePage('boutiques');
  if (!session.profile?.organization_id) {
    return <p className="text-muted-foreground">Organisation non configurée.</p>;
  }

  const orgId = session.profile.organization_id;
  let boutiques: PmeBoutiqueRow[] = [];

  try {
    boutiques = await getPmeBoutiques(orgId);
  } catch {
    /* table non migrée */
  }

  return <PmeBoutiquesClient boutiques={boutiques} onCreate={createPmeBoutique} />;
}
