"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Maximize2, X, Flag, ScanLine, Users } from "lucide-react";
import { Avatar } from "@/app/_components/ui";

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
  const [presenting, setPresenting] = useState(false);
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
        setQr(await QRCode.toDataURL(url, { width: 420, margin: 1 }));
      }
      if (!d.token) setQr("");
    } catch {
      /* transient — keep last frame */
    }
  }, [sessionId]);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 4000);
    return () => clearInterval(interval);
  }, [poll]);

  const present = data?.present ?? [];
  const total = data?.total ?? 0;
  const open = data?.status === "OPEN";

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-5">
        {/* QR */}
        <div className="lg:col-span-3">
          <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            {open && qr ? (
              <>
                <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-inner">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qr} alt="Attendance QR" className="h-60 w-60 sm:h-72 sm:w-72" />
                </div>
                <p className="mt-4 flex items-center gap-1.5 text-sm text-slate-500">
                  <ScanLine className="h-4 w-4 text-brand-600" />
                  Rotates every {data?.ttl}s · students scan to check in
                </p>
                <button
                  onClick={() => setPresenting(true)}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <Maximize2 className="h-4 w-4" /> Presentation mode
                </button>
              </>
            ) : (
              <div className="flex h-72 w-full items-center justify-center rounded-lg bg-slate-50 text-sm text-slate-400">
                {data?.status === "CLOSED" ? "Session closed" : "Loading…"}
              </div>
            )}
          </div>
        </div>

        {/* Roster */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                <Users className="h-4 w-4 text-brand-700" /> Present
              </span>
              <span className="text-2xl font-bold tabular-nums text-slate-900">
                {present.length}
                <span className="text-base font-normal text-slate-400">/{total}</span>
              </span>
            </div>
            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand-600 transition-all"
                style={{ width: total ? `${(present.length / total) * 100}%` : "0%" }}
              />
            </div>
            <ul className="max-h-80 space-y-1 overflow-auto">
              {present.map((p, i) => (
                <li key={i} className="flex items-center gap-2 rounded-lg px-1 py-1.5">
                  <Avatar name={p.name} />
                  <span className="flex-1 truncate text-sm text-slate-700">{p.name}</span>
                  {p.method === "MANUAL" && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                      manual
                    </span>
                  )}
                  {p.flagged && <Flag className="h-3.5 w-3.5 text-red-500" />}
                  <span className="text-xs tabular-nums text-slate-400">
                    {new Date(p.scannedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </li>
              ))}
              {present.length === 0 && (
                <li className="py-6 text-center text-sm text-slate-400">No scans yet.</li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Presentation mode overlay */}
      {presenting && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 p-6 text-white">
          <button
            onClick={() => setPresenting(false)}
            className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 text-white/70 transition hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
          <h2 className="mb-1 text-2xl font-bold tracking-tight">Scan to mark attendance</h2>
          <p className="mb-6 text-sm text-white/50">Open the app on your phone and scan · rotates every {data?.ttl}s</p>
          {qr && (
            <div className="rounded-3xl bg-white p-5 shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="Attendance QR" className="h-[min(70vh,560px)] w-[min(70vh,560px)]" />
            </div>
          )}
          <div className="mt-6 text-center">
            <div className="text-5xl font-bold tabular-nums">
              {present.length}
              <span className="text-2xl font-normal text-white/40">/{total}</span>
            </div>
            <div className="mt-1 text-sm uppercase tracking-wide text-white/40">present</div>
          </div>
        </div>
      )}
    </>
  );
}
