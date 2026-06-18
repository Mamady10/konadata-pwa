'use client';

import { SectorPage } from '@/components/dashboard/sector-page';
import { Wrench } from 'lucide-react';

interface MaterielsItem {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  date?: string;
}

interface Props {
  items: MaterielsItem[];
}

export function MaterielsClient({ items }: Props) {
  return (
    <SectorPage
      title="Matériels"
      description="Équipements et stock de chantier"
      icon={Wrench}
      items={items}
      connected
      emptyMessage="Aucun matériel ou stock enregistré."
    />
  );
}
