import { requireBtpPage } from '@/lib/btp/require-btp-page';
import { getBtpEquipment, getBtpSites } from '@/lib/actions/btp';
import {
  getBtpStockMovements,
  getBtpStockOptions,
  getBtpPersonnelForStock,
} from '@/lib/actions/btp-stock';
import { MaterielsClient } from './materiels-client';

type SiteRow = { name?: string } | null;

export default async function Page() {
  const session = await requireBtpPage('materiels');
  if (!session.profile?.organization_id) {
    return <p className="text-muted-foreground">Organisation non configurée.</p>;
  }
  const orgId = session.profile.organization_id;

  let stock: Awaited<ReturnType<typeof getBtpStockOptions>> = [];
  let movements: Awaited<ReturnType<typeof getBtpStockMovements>>['rows'] = [];
  let movementsTotal = 0;
  let sites: { id: string; name: string }[] = [];
  let personnel: Awaited<ReturnType<typeof getBtpPersonnelForStock>> = [];
  const equipmentItems: { id: string; title: string; subtitle: string; status: string }[] = [];

  try {
    const [stockRows, movementResult, siteRows, personnelRows, equipment] = await Promise.all([
      getBtpStockOptions(orgId),
      getBtpStockMovements(orgId, { limit: 40 }),
      getBtpSites(orgId),
      getBtpPersonnelForStock(orgId),
      getBtpEquipment(orgId),
    ]);
    stock = stockRows;
    movements = movementResult.rows;
    movementsTotal = movementResult.total;
    sites = siteRows.map((s) => ({ id: s.id, name: s.name }));
    personnel = personnelRows;

    for (const e of equipment) {
      const site = e.btp_sites as SiteRow;
      equipmentItems.push({
        id: e.id,
        title: e.name,
        subtitle: `${e.type ?? 'Équipement'} — ${Number(e.hours_used ?? 0).toLocaleString('fr-FR')} h`,
        status: e.status === 'operational' ? 'Opérationnel' : String(e.status ?? '—'),
      });
      if (site?.name) equipmentItems[equipmentItems.length - 1].subtitle += ` · ${site.name}`;
    }
  } catch {
    stock = [];
    movements = [];
    movementsTotal = 0;
    sites = [];
    personnel = [];
  }

  return (
    <MaterielsClient
      stock={stock}
      movements={movements}
      movementsTotal={movementsTotal}
      sites={sites}
      personnel={personnel}
      equipmentItems={equipmentItems}
    />
  );
}
