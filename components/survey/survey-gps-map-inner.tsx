'use client';

import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import type { SurveyMapPoint } from './survey-gps-map';
import 'leaflet/dist/leaflet.css';

const COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

function FitBounds({ points }: { points: SurveyMapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 12);
      return;
    }
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    map.fitBounds(
      [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      ],
      { padding: [24, 24], maxZoom: 14 }
    );
  }, [map, points]);
  return null;
}

interface Props {
  points: SurveyMapPoint[];
  height: number;
}

export function SurveyGpsMapInner({ points, height }: Props) {
  const choices = [...new Set(points.map((p) => p.choice))];
  const colorByChoice = Object.fromEntries(
    choices.map((c, i) => [c, COLORS[i % COLORS.length]])
  );

  const center = useMemo(() => {
    const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
    const lng = points.reduce((s, p) => s + p.lng, 0) / points.length;
    return [lat, lng] as [number, number];
  }, [points]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        {choices.map((c) => (
          <span key={c} className="inline-flex items-center gap-1">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ backgroundColor: colorByChoice[c] }}
            />
            {c}
          </span>
        ))}
      </div>
      <div className="rounded-lg overflow-hidden border" style={{ height }}>
        <MapContainer
          center={center}
          zoom={10}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds points={points} />
          {points.map((p) => (
            <CircleMarker
              key={p.id}
              center={[p.lat, p.lng]}
              radius={8}
              pathOptions={{
                color: colorByChoice[p.choice] ?? COLORS[0],
                fillColor: colorByChoice[p.choice] ?? COLORS[0],
                fillOpacity: 0.85,
                weight: 2,
              }}
            >
              <Popup>
                <strong>{p.choice}</strong>
                <br />
                {p.locality}
                <br />
                <span className="text-xs text-muted-foreground">
                  {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                </span>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
      <p className="text-xs text-muted-foreground">
        Cartographie OpenStreetMap — {points.length} point{points.length > 1 ? 's' : ''} GPS (réponses
        valides).
      </p>
    </div>
  );
}
