"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

interface PresentRow {
  name: string;
  method: "QR" | "MANUAL";
  flagged: boolean;
  flagReason?: string | null;
  scannedAt: string;
}
interface LiveData {
  status: "OPEN" | "CLOSED";
  ttl: number;
  token: string | null;
  total: number;
  present: PresentRow[];
}

export function LiveSession({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<LiveData | null>(null);
  const [qr, setQr] = useState<string>("");
  const lastToken = useRef<string>("");

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/session/${sessionId}/live`, { cache: "no-store" });
      if (!res.ok) return;
      const d: LiveData = await res.json();
      setData(d);
      if (d.token && d.token !== lastToken.current) {
        lastToken.current = d.token;
        const url = `${window.location.origin}/student/scan?t=${encodeURIComponent(d.token)}`;
        setQr(await QRCode.toDataURL(url, { width: 320, margin: 1 }));
      }
      if (!d.token) setQr("");
    } catch {
      /* transient network error — keep last frame */
    }
  }, [sessionId]);

  useEffect(() => {
    poll();
    // Re-poll well within the rotation TTL so the on-screen QR is always fresh.
    const interval = setInterval(poll, 4000);
    return () => clearInterval(interval);
  }, [poll]);

  const present = data?.present ?? [];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        {data?.status === "OPEN" && qr ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="Attendance QR" className="h-64 w-64" />
            <p className="mt-3 text-center text-xs text-gray-500">
              Rotates every {data.ttl}s · students scan with the app
            </p>
          </>
        ) : (
          <div className="flex h-64 w-64 items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-500">
            {data?.status === "CLOSED" ? "Session closed" : "Loading…"}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-sm font-semibold text-gray-800">Present</span>
          <span className="text-2xl font-bold tabular-nums">
            {present.length}
            <span className="text-base font-normal text-gray-400">/{data?.total ?? "–"}</span>
          </span>
        </div>
        <ul className="max-h-72 space-y-1 overflow-auto text-sm">
          {present.map((p, i) => (
            <li key={i} className="flex items-center justify-between border-b border-gray-100 py-1">
              <span>{p.name}</span>
              <span className="flex items-center gap-1 text-xs text-gray-400">
                {p.method === "MANUAL" && <span className="text-amber-600">manual</span>}
                {p.flagged && <span title={p.flagReason ?? ""} className="text-red-600">⚑</span>}
                {new Date(p.scannedAt).toLocaleTimeString()}
              </span>
            </li>
          ))}
          {present.length === 0 && <li className="py-2 text-gray-400">No scans yet.</li>}
        </ul>
      </div>
    </div>
  );
}
