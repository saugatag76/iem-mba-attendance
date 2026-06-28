"use client";

import { MapContainer, TileLayer, Circle, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icons (Leaflet + webpack bundler quirk)
const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  map.flyTo([lat, lng], 18, { animate: true, duration: 1 });
  return null;
}

export function LocationTesterMap({
  lat,
  lng,
  accuracyM,
  geofenceM,
}: {
  lat: number;
  lng: number;
  accuracyM: number;
  geofenceM: number;
}) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={18}
      style={{ height: "100%", width: "100%", borderRadius: "0.65rem" }}
      zoomControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FlyTo lat={lat} lng={lng} />

      {/* GPS accuracy radius (how far off the reading might be) */}
      <Circle
        center={[lat, lng]}
        radius={accuracyM}
        pathOptions={{ color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 0.08, weight: 1.5, dashArray: "4" }}
      />

      {/* Geofence radius (what students must be within to scan) */}
      <Circle
        center={[lat, lng]}
        radius={geofenceM}
        pathOptions={{ color: "#2f7eda", fillColor: "#2f7eda", fillOpacity: 0.10, weight: 2 }}
      />

      {/* Captured position */}
      <Marker position={[lat, lng]} icon={icon}>
        <Popup>
          <strong>Captured anchor</strong><br />
          {lat.toFixed(6)}, {lng.toFixed(6)}<br />
          GPS accuracy: ±{Math.round(accuracyM)} m<br />
          Geofence radius: {geofenceM} m
        </Popup>
      </Marker>
    </MapContainer>
  );
}
