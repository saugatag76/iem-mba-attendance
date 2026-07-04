"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Maximize2, X, Flag, KeyRound, Users, Clock, MapPinOff, AlertTriangle } from "lucide-react";
import { Avatar, cn } from "@/app/_components/ui";

interface PresentRow {
  name: string;
  method: "CODE" | "QR" | "MANUAL";
  flagged: boolean;
  flagReason?: string | null;
  scannedAt: string;
}
interface NonCompliantRow {
  studentId: string;
  name: string;
  email: string;
  flagReason: string | null;
  scannedAt: string;
}
interface LiveData {
  status: "OPEN" | "CLOSED";
  code: string | null;
  expiresAt: string | null;
  total: number;
  geoLat: number | null;
  geoLng: number | null;
  geoRadiusM: number;
  present: PresentRow[];
  nonCompliant: NonCompliantRow[];
}

function Countdown({ expiresAt, dark = false }: { expiresAt: string; dark?: boolean }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, Date.parse(expiresAt) - Date.now()));
  useEffect(() => {
    const interval = setInterval(() => setRemaining(Math.max(0, Date.parse(expiresAt) - Date.now())), 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);
  const totalSec = Math.floor(remaining / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const critical = totalSec <= 10;
  const urgent = totalSec <= 30;

  const toneClasses = critical
    ? "bg-red-600 text-white animate-pulse"
    : urgent
      ? "bg-amber-100 text-amber-700"
      : dark
        ? "bg-card/10 text-white"
        : "bg-muted text-foreground";

  return (
    <div className={cn("inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-semibold", toneClasses)}>
      <Clock className="h-4 w-4" />
      <span className="text-base tabular-nums">
        Auto-closes in {m}:{s.toString().padStart(2, "0")}
      </span>
    </div>
  );
}

/** Renders a 6-digit code as spaced, boxed digits. */
function CodeDisplay({ code, size = "normal" }: { code: string; size?: "normal" | "huge" }) {
  const digitCls =
    size === "huge"
      ? "h-[14vh] min-h-24 w-[10vw] min-w-16 text-[10vh] rounded-2xl"
      : "h-16 w-12 text-4xl rounded-xl sm:h-20 sm:w-14 sm:text-5xl";
  return (
    <div className="flex justify-center gap-2 sm:gap-3">
      {code.split("").map((d, i) => (
        <span
          key={i}
          className={cn(
            "flex items-center justify-center border font-bold tabular-nums",
            size === "huge"
              ? "border-white/15 bg-white/5 text-white"
              : "border-border bg-muted text-foreground",
            digitCls,
          )}
        >
          {d}
        </span>
      ))}
    </div>
  );
}

export function LiveSession({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [data, setData] = useState<LiveData | null>(null);
  const [presenting, setPresenting] = useState(false);
  const wasOpen = useRef(false);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/session/${sessionId}/live`, { cache: "no-store" });
      if (!res.ok) return;
      const d: LiveData = await res.json();
      setData(d);
      if (d.status === "OPEN") wasOpen.current = true;
      else if (wasOpen.current) {
        router.push(`/reports/session/${sessionId}`);
      }
    } catch {
      /* transient — keep last frame */
    }
  }, [sessionId, router]);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 4000);
    return () => clearInterval(interval);
  }, [poll]);

  const present = data?.present ?? [];
  const nonCompliant = data?.nonCompliant ?? [];
  const total = data?.total ?? 0;
  const open = data?.status === "OPEN";
  const code = data?.code ?? null;
  const geofenceInactive = data != null && data.geoLat == null;

  return (
    <>
      {/* Geofence inactive warning */}
      {geofenceInactive && (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/12 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>
            <strong>Geofence inactive</strong> — location was not acquired when this session was opened.
            Students can check in from any location. Re-open the session to enable geofencing.
          </span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Code */}
        <div className="lg:col-span-3">
          <div className="flex flex-col items-center rounded-xl border border-border bg-card p-6 shadow-sm">
            {open && code ? (
              <>
                <p className="mb-4 text-sm font-medium uppercase tracking-widest text-muted-foreground">
                  Attendance code
                </p>
                <CodeDisplay code={code} />
                {data?.expiresAt && (
                  <div className="mt-5">
                    <Countdown expiresAt={data.expiresAt} />
                  </div>
                )}
                <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <KeyRound className="h-4 w-4 text-primary" />
                  Students open the app and enter this code to check in
                </p>
                <button
                  onClick={() => setPresenting(true)}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
                >
                  <Maximize2 className="h-4 w-4" /> Presentation mode
                </button>
              </>
            ) : (
              <div className="flex h-60 w-full items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
                {data?.status === "CLOSED" ? "Session closed" : "Loading…"}
              </div>
            )}
          </div>
        </div>

        {/* Roster */}
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Users className="h-4 w-4 text-primary" /> Present
              </span>
              <span className="text-2xl font-bold tabular-nums text-foreground">
                {present.length}
                <span className="text-base font-normal text-muted-foreground">/{total}</span>
              </span>
            </div>
            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: total ? `${(present.length / total) * 100}%` : "0%" }}
              />
            </div>
            <ul className="max-h-72 space-y-1 overflow-auto">
              {present.map((p, i) => (
                <li key={i} className="flex items-center gap-2 rounded-lg px-1 py-1.5">
                  <Avatar name={p.name} />
                  <span className="flex-1 truncate text-sm text-foreground">{p.name}</span>
                  {p.method === "MANUAL" && (
                    <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                      manual
                    </span>
                  )}
                  {p.flagged && <Flag className="h-3.5 w-3.5 text-red-500" />}
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {new Date(p.scannedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </li>
              ))}
              {present.length === 0 && (
                <li className="py-6 text-center text-sm text-muted-foreground">No check-ins yet.</li>
              )}
            </ul>
          </div>

          {/* Location non-compliant */}
          {nonCompliant.length > 0 && (
            <div className="rounded-xl border border-red-500/20 bg-card p-5 shadow-sm dark:border-red-500/15">
              <div className="mb-3 flex items-center gap-1.5">
                <MapPinOff className="h-4 w-4 text-red-500" />
                <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                  Location non-compliant ({nonCompliant.length})
                </span>
              </div>
              <ul className="space-y-1">
                {nonCompliant.map((r) => (
                  <li key={r.studentId} className="flex items-center gap-2 rounded-lg px-1 py-1.5">
                    <Avatar name={r.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">{r.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{r.email}</p>
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {new Date(r.scannedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                These students checked in but had no location. Use the manual fallback to mark them present if verified in person.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Presentation mode overlay */}
      {presenting && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 p-6 text-white">
          <button
            onClick={() => setPresenting(false)}
            className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 text-white/70 transition hover:bg-card/10"
          >
            <X className="h-5 w-5" />
          </button>
          <h2 className="mb-1 text-2xl font-bold tracking-tight">Enter this code to mark attendance</h2>
          <p className="mb-8 text-sm text-white/50">Open the app on your phone and type the code below</p>
          {data?.expiresAt && (
            <div className="mb-8 scale-125">
              <Countdown expiresAt={data.expiresAt} dark />
            </div>
          )}
          {code && <CodeDisplay code={code} size="huge" />}
          <div className="mt-10 text-center">
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
