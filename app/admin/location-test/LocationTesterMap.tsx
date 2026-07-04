"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
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

/** Flies the map to a point only when `flyToken` increments — not on every point change,
 *  otherwise the map would yank itself back while the admin is dragging/clicking. */
function FlyTo({ lat, lng, flyToken }: { lat: number; lng: number; flyToken: number }) {
  const map = useMap();
  useEffect(() => {
    if (flyToken > 0) map.flyTo([lat, lng], 18, { animate: true, duration: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyToken]);
  return null;
}

/** Lets the admin click anywhere on the map to move the anchor there. */
function ClickToPlace({ onPlace }: { onPlace: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPlace(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function LocationTesterMap({
  lat,
  lng,
  radiusM,
  accuracyM,
  flyToken,
  onPlace,
}: {
  lat: number;
  lng: number;
  radiusM: number;
  accuracyM: number | null;
  flyToken: number;
  onPlace: (lat: number, lng: number) => void;
}) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={17}
      style={{ height: "100%", width: "100%", borderRadius: "0.65rem" }}
      zoomControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FlyTo lat={lat} lng={lng} flyToken={flyToken} />
      <ClickToPlace onPlace={onPlace} />

      {/* GPS accuracy — only shown right after a live "Use my location" capture */}
      {accuracyM != null && (
        <Circle
          center={[lat, lng]}
          radius={accuracyM}
          pathOptions={{ color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 0.06, weight: 1.5, dashArray: "4" }}
        />
      )}

      {/* Geofence radius — driven live by the slider */}
      <Circle
        center={[lat, lng]}
        radius={radiusM}
        pathOptions={{ color: "#2f7eda", fillColor: "#2f7eda", fillOpacity: 0.12, weight: 2 }}
      />

      {/* Draggable anchor marker */}
      <Marker
        position={[lat, lng]}
        icon={icon}
        draggable
        eventHandlers={{
          dragend(e) {
            const marker = e.target;
            const { lat: nlat, lng: nlng } = marker.getLatLng();
            onPlace(nlat, nlng);
          },
        }}
      >
        <Popup>
          <strong>Geofence anchor</strong>
          <br />
          {lat.toFixed(6)}, {lng.toFixed(6)}
          <br />
          Radius: {radiusM} m
          {accuracyM != null && (
            <>
              <br />
              GPS accuracy: ±{Math.round(accuracyM)} m
            </>
          )}
        </Popup>
      </Marker>
    </MapContainer>
  );
}
