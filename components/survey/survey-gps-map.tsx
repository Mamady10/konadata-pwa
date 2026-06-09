'use client';

import dynamic from 'next/dynamic';

export interface SurveyMapPoint {
  id: string;
  lat: number;
  lng: number;
  locality: string;
  choice: string;
}

interface Props {
  points: SurveyMapPoint[];
  height?: number;
}

const SurveyGpsMapInner = dynamic(
  () => import('./survey-gps-map-inner').then((m) => m.SurveyGpsMapInner),
  {
    ssr: false,
    loading: () => (
      <p className="text-sm text-muted-foreground py-8 text-center">Chargement de la carte…</p>
    ),
  }
);

export function SurveyGpsMap({ points, height = 400 }: Props) {
  if (!points.length) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Aucun point GPS dans les réponses valides. Activez la géolocalisation à la collecte ou
        renseignez la localité pour l&apos;analyse territoriale.
      </p>
    );
  }

  return <SurveyGpsMapInner points={points} height={height} />;
}
