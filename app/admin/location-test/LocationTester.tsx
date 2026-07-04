"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Crosshair, Copy, Check, AlertTriangle, Info } from "lucide-react";

const LocationTesterMap = dynamic(
  () => import("./LocationTesterMap").then((m) => m.LocationTesterMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">
        Loading map…
      </div>
    ),
  },
);

// Default starting view before any point is placed or GPS is used.
const DEFAULT_CENTER = { lat: 22.5726, lng: 88.3639 };

export function LocationTester() {
  const [point, setPoint] = useState(DEFAULT_CENTER);
  const [radiusM, setRadiusM] = useState(75);
  const [accuracyM, setAccuracyM] = useState<number | null>(null);
  const [flyToken, setFlyToken] = useState(0);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function placePoint(lat: number, lng: number) {
    setPoint({ lat, lng });
    setAccuracyM(null); // manually placed — no GPS accuracy figure attached
  }

  function useMyLocation() {
    setLocating(true);
    setError(null);
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser.");
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setAccuracyM(pos.coords.accuracy);
        setFlyToken((v) => v + 1);
        setLocating(false);
      },
      (err) => {
        setError(
          err.code === 1
            ? "Location permission denied. Allow location access and try again."
            : err.code === 3
            ? "GPS timed out — weak signal. Try near a window."
            : `GPS error: ${err.message}`,
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  function copyCoords() {
    navigator.clipboard.writeText(`${point.lat.toFixed(6)}, ${point.lng.toFixed(6)} · radius ${radiusM}m`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={useMyLocation}
          disabled={locating}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-50"
        >
          <Crosshair className="h-4 w-4" /> {locating ? "Locating…" : "Use my location"}
        </button>
        <button
          onClick={copyCoords}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-accent"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy coordinates"}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/8 p-3 text-sm text-red-600 dark:text-red-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Latitude</p>
          <p className="mt-1 font-mono text-sm font-semibold text-foreground">{point.lat.toFixed(6)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Longitude</p>
          <p className="mt-1 font-mono text-sm font-semibold text-foreground">{point.lng.toFixed(6)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Geofence radius</p>
          <p className="mt-1 font-mono text-sm font-semibold text-primary">{radiusM} m</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">GPS accuracy</p>
          <p className="mt-1 font-mono text-sm font-semibold text-foreground">
            {accuracyM != null ? `±${Math.round(accuracyM)} m` : "— (manual point)"}
          </p>
        </div>
      </div>

      {/* Radius slider */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-semibold text-foreground">Geofence radius</label>
          <span className="font-mono text-sm font-bold text-primary">{radiusM} m</span>
        </div>
        <input
          type="range"
          min={10}
          max={300}
          step={5}
          value={radiusM}
          onChange={(e) => setRadiusM(Number(e.target.value))}
          className="w-full accent-primary"
        />
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>10 m (tight)</span>
          <span>75 m (default)</span>
          <span>300 m (loose)</span>
        </div>
      </div>

      {/* Map */}
      <div className="h-[480px] w-full overflow-hidden rounded-xl border border-border shadow-sm">
        <LocationTesterMap
          lat={point.lat}
          lng={point.lng}
          radiusM={radiusM}
          accuracyM={accuracyM}
          flyToken={flyToken}
          onPlace={placePoint}
        />
      </div>

      {/* Instructions */}
      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
        <p>
          <strong>Click anywhere on the map</strong> to place the anchor there, or <strong>drag the marker</strong> to
          fine-tune it. Use the slider above to preview exactly how far the <strong>{radiusM}m geofence</strong>{" "}
          (blue circle) reaches from that point.
          {accuracyM != null &&
            " The amber dashed circle shows your device's GPS accuracy at the point you just captured."}
        </p>
      </div>
    </div>
  );
}
