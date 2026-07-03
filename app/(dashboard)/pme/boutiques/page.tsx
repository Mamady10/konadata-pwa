import { requirePmePage } from '@/lib/pme/require-pme-page';
import {
  getPmeBoutiques,
  createPmeBoutique,
  updatePmeBoutique,
  setPmeBoutiqueActive,
  type PmeBoutiqueRow,
} from '@/lib/actions/pme';
import { isPmeDirector } from '@/lib/pme/pme-access';
import { PmeBoutiquesClient } from './pme-boutiques-client';

export default async function Page() {
  const session = await requirePmePage('boutiques');
  if (!session.profile?.organization_id) {
    return <p className="text-muted-foreground">Organisation non configurée.</p>;
  }

  const orgId = session.profile.organization_id;
  const canManage = isPmeDirector(session.profile.role);
  let boutiques: PmeBoutiqueRow[] = [];

  try {
    boutiques = await getPmeBoutiques(orgId);
  } catch {
    /* table non migrée */
  }

  return (
    <PmeBoutiquesClient
      boutiques={boutiques}
      canManage={canManage}
      onCreate={createPmeBoutique}
      onUpdate={updatePmeBoutique}
      onSetActive={setPmeBoutiqueActive}
    />
  );
}
