"use client";

import dynamic from "next/dynamic";
import type { ScanPoint } from "./ScanMap";

// Leaflet touches `window`, so load the map only on the client.
const ScanMap = dynamic(() => import("./ScanMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-80 items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-500">
      Loading map…
    </div>
  ),
});

export function ScanMapClient(props: {
  anchor: { lat: number; lng: number; radius: number } | null;
  points: ScanPoint[];
}) {
  return <ScanMap {...props} />;
}
