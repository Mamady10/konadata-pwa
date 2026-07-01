import { getNgoCartographyDetail } from '@/lib/actions/ngo';
import { CartographieClient } from './cartographie-client';
import { requireOngPage } from '@/lib/ong/require-ong-page';

export default async function Page() {
  const session = await requireOngPage('cartographie');
  if (!session.profile?.organization_id) {
    return <p className="text-muted-foreground">Organisation non configurée.</p>;
  }

  let localities: Awaited<ReturnType<typeof getNgoCartographyDetail>>['localities'] = [];
  let projects: Awaited<ReturnType<typeof getNgoCartographyDetail>>['projects'] = [];

  try {
    const detail = await getNgoCartographyDetail(session.profile.organization_id);
    localities = detail.localities;
    projects = detail.projects;
  } catch {
    /* empty */
  }

  return <CartographieClient localities={localities} projects={projects} />;
}
