'use client';

import { SectorPage } from '@/components/dashboard/sector-page';
import { Receipt } from 'lucide-react';

interface BonsItem {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  date?: string;
}

interface Props {
  items: BonsItem[];
}

export function BonsClient({ items }: Props) {
  return (
    <SectorPage
      title="Bons"
      description="Bons de commande, livraison et carburant"
      icon={Receipt}
      items={items}
      connected
      emptyMessage="Aucun bon enregistré."
    />
  );
}
