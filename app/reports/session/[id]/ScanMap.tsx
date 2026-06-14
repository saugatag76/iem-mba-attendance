"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Circle, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export interface ScanPoint {
  name: string;
  lat: number;
  lng: number;
  outOfRange: boolean;
  flagged: boolean;
}

interface Props {
  anchor: { lat: number; lng: number; radius: number } | null;
  points: ScanPoint[];
}

// Fit the view to include the classroom anchor + all scan points.
function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 1) map.setView(positions[0], 17);
    else if (positions.length > 1)
      map.fitBounds(positions, { padding: [30, 30], maxZoom: 18 });
  }, [map, positions]);
  return null;
}

export default function ScanMap({ anchor, points }: Props) {
  const positions: [number, number][] = [
    ...(anchor ? [[anchor.lat, anchor.lng] as [number, number]] : []),
    ...points.map((p) => [p.lat, p.lng] as [number, number]),
  ];
  const center = positions[0] ?? [0, 0];

  return (
    <MapContainer center={center} zoom={17} style={{ height: 320, width: "100%" }} scrollWheelZoom>
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {anchor && (
        <>
          {/* Geofence circle + classroom centre */}
          <Circle
            center={[anchor.lat, anchor.lng]}
            radius={anchor.radius}
            pathOptions={{ color: "#2563eb", fillColor: "#3b82f6", fillOpacity: 0.08 }}
          />
          <CircleMarker
            center={[anchor.lat, anchor.lng]}
            radius={6}
            pathOptions={{ color: "#1d4ed8", fillColor: "#1d4ed8", fillOpacity: 1 }}
          >
            <Popup>Classroom (geofence centre, {anchor.radius}m)</Popup>
          </CircleMarker>
        </>
      )}
      {points.map((p, i) => {
        const color = p.outOfRange ? "#dc2626" : p.flagged ? "#d97706" : "#16a34a";
        return (
          <CircleMarker
            key={i}
            center={[p.lat, p.lng]}
            radius={7}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.85 }}
          >
            <Popup>
              <strong>{p.name}</strong>
              <br />
              {p.outOfRange ? "Outside geofence" : "Inside geofence"}
              {p.flagged && " · flagged"}
            </Popup>
          </CircleMarker>
        );
      })}
      <FitBounds positions={positions} />
    </MapContainer>
  );
}
