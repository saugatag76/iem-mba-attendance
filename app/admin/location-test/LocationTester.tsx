"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { MapPin, RefreshCw, AlertTriangle, CheckCircle2, Loader2, Info } from "lucide-react";

const GEOFENCE_M = 75;

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

type CaptureResult = {
  lat: number;
  lng: number;
  accuracyM: number;
  altitude: number | null;
  timestamp: number;
};

function accuracyLabel(m: number): { label: string; tone: "green" | "amber" | "red" } {
  if (m <= 15) return { label: "Excellent", tone: "green" };
  if (m <= 40) return { label: "Good", tone: "green" };
  if (m <= 75) return { label: "Fair — borderline for geofencing", tone: "amber" };
  return { label: "Poor — geofence may reject scans", tone: "red" };
}

export function LocationTester() {
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function capture() {
    setLoading(true);
    setError(null);
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser.");
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setResult({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          timestamp: pos.timestamp,
        });
        setLoading(false);
      },
      (err) => {
        setError(
          err.code === 1
            ? "Location permission denied. Allow location access and try again."
            : err.code === 3
            ? "GPS timed out — weak signal. Try near a window."
            : `GPS error: ${err.message}`,
        );
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  const accuracy = result ? accuracyLabel(result.accuracyM) : null;
  const toneClass = {
    green: "border-emerald-500/30 bg-emerald-500/8 text-emerald-700 dark:text-emerald-400",
    amber: "border-amber-500/30 bg-amber-500/8 text-amber-700 dark:text-amber-400",
    red: "border-red-500/30 bg-red-500/8 text-red-600 dark:text-red-400",
  };

  return (
    <div className="space-y-5">
      {/* Capture button */}
      <div className="flex items-center gap-3">
        <button
          onClick={capture}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Acquiring GPS…</>
          ) : (
            <><MapPin className="h-4 w-4" /> {result ? "Re-capture location" : "Capture my location"}</>
          )}
        </button>
        {result && !loading && (
          <button
            onClick={capture}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-accent"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/8 p-3 text-sm text-red-600 dark:text-red-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Latitude</p>
              <p className="mt-1 font-mono text-sm font-semibold text-foreground">{result.lat.toFixed(6)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Longitude</p>
              <p className="mt-1 font-mono text-sm font-semibold text-foreground">{result.lng.toFixed(6)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">GPS Accuracy</p>
              <p className="mt-1 font-mono text-sm font-semibold text-foreground">±{Math.round(result.accuracyM)} m</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Captured at</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {new Date(result.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </p>
            </div>
          </div>

          {/* Accuracy assessment */}
          {accuracy && (
            <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${toneClass[accuracy.tone]}`}>
              {accuracy.tone === "green" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              )}
              <div>
                <p className="font-semibold">GPS signal: {accuracy.label}</p>
                <p className="mt-0.5 text-xs opacity-80">
                  {accuracy.tone === "green"
                    ? `Your GPS accuracy (±${Math.round(result.accuracyM)}m) is well within the ${GEOFENCE_M}m geofence. Sessions opened from here should work reliably.`
                    : accuracy.tone === "amber"
                    ? `GPS accuracy is ±${Math.round(result.accuracyM)}m — close to the ${GEOFENCE_M}m geofence radius. Students near the boundary may be rejected. Consider opening sessions from a spot with better signal.`
                    : `GPS accuracy is ±${Math.round(result.accuracyM)}m — worse than the ${GEOFENCE_M}m geofence radius. The anchor point may be offset significantly from your real position. Students in the classroom could be incorrectly rejected. Move closer to a window or use an outdoor capture point.`}
                </p>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-6 rounded-sm border border-dashed border-amber-500 bg-amber-500/15" />
              GPS accuracy radius (±{Math.round(result.accuracyM)} m)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-6 rounded-sm border-2 border-primary bg-primary/15" />
              Geofence radius ({GEOFENCE_M} m) — students must scan within this
            </span>
          </div>

          {/* Map */}
          <div className="h-[420px] w-full overflow-hidden rounded-xl border border-border shadow-sm">
            <LocationTesterMap
              lat={result.lat}
              lng={result.lng}
              accuracyM={result.accuracyM}
              geofenceM={GEOFENCE_M}
            />
          </div>

          {/* Diagnosis note */}
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <p>
              The <strong>amber dashed circle</strong> shows how far off your GPS reading might be.
              The <strong>blue circle</strong> is the 75 m geofence students must be inside to scan.
              If the amber circle is larger than the blue one, your GPS is too inaccurate to reliably
              enforce attendance in this location — move closer to a window or open the session from the classroom.
            </p>
          </div>
        </>
      )}

      {/* Initial instructions */}
      {!result && !loading && !error && (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <MapPin className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">Click "Capture my location" to see what the system will use as the geofence anchor when you open a session from here.</p>
          <p className="mt-1 text-xs text-muted-foreground/70">Allow location permission when prompted.</p>
        </div>
      )}
    </div>
  );
}
