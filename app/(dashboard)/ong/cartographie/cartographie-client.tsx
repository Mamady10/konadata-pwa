'use client';

import { MapPin, FolderKanban } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';

interface Locality {
  localite: string;
  region: string;
  projets: number;
  beneficiaires: number;
}

interface Project {
  id: string;
  name: string;
  region: string | null;
  locality: string | null;
  budget: number | null;
  progress_pct: number | null;
  status: string;
}

interface Props {
  localities: Locality[];
  projects: Project[];
}

export function CartographieClient({ localities, projects }: Props) {
  const hasData = localities.length > 0 || projects.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Cartographie</h1>
          <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-200">
            Couverture terrain
          </Badge>
        </div>
        <p className="text-muted-foreground">
          Répartition géographique de vos projets et bénéficiaires déclarés par localité.
        </p>
      </div>

      {!hasData ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="font-medium">Aucune localité couverte pour le moment</p>
            <p className="text-sm text-muted-foreground mt-2">
              Créez des projets avec une région et une localité dans{' '}
              <Link href="/ong/projets" className="text-primary underline">
                Projets
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {localities.map((l) => (
              <Card key={`${l.region}-${l.localite}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    {l.localite}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">{l.region}</p>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p>
                    <strong>{l.projets}</strong> projet{l.projets !== 1 ? 's' : ''}
                  </p>
                  <p>
                    <strong>{l.beneficiaires.toLocaleString('fr-FR')}</strong> bénéficiaires déclarés
                  </p>
                  <Badge variant="outline" className="text-[10px] mt-2">
                    {l.beneficiaires > 0 ? 'Couvert' : 'À compléter'}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Projets par zone</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {projects.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <FolderKanban className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium truncate">{p.name}</span>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {[p.locality, p.region].filter(Boolean).join(' — ') || 'Localité non renseignée'}
                    {' · '}
                    {formatCurrency(Number(p.budget ?? 0))}
                    {' · '}
                    {Math.round(Number(p.progress_pct ?? 0))}%
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
