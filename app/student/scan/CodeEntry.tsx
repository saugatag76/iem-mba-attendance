"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, CheckCircle2, XCircle, Loader2, MapPinOff, AlertTriangle } from "lucide-react";
import { getDeviceId } from "@/lib/device";

type Phase = "idle" | "submitting" | "done" | "error" | "location_denied" | "location_timeout";
type LocationErrorType = "permission_denied" | "unavailable" | "timeout" | null;

interface PositionResult {
  coords: { latitude: number; longitude: number } | null;
  errorType: LocationErrorType;
}

function getPosition(): Promise<PositionResult> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      return resolve({ coords: null, errorType: "unavailable" });
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ coords: { latitude: p.coords.latitude, longitude: p.coords.longitude }, errorType: null }),
      (err) => {
        if (err.code === 1) resolve({ coords: null, errorType: "permission_denied" });
        else if (err.code === 3) resolve({ coords: null, errorType: "timeout" });
        else resolve({ coords: null, errorType: "unavailable" });
      },
      { enableHighAccuracy: true, timeout: 20000 },
    );
  });
}

export function CodeEntry() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);
  const [isAbsent, setIsAbsent] = useState(false);

  const submit = useCallback(async (skipLocation = false) => {
    if (!/^\d{6}$/.test(code)) return;
    setPhase("submitting");

    let lat: number | null = null;
    let lng: number | null = null;

    if (!skipLocation) {
      setMessage("Acquiring location…");
      const pos = await getPosition();
      if (pos.errorType === "permission_denied") { setPhase("location_denied"); return; }
      if (pos.errorType !== null) { setPhase("location_timeout"); return; }
      lat = pos.coords!.latitude;
      lng = pos.coords!.longitude;
    }

    setMessage("Verifying…");
    const res = await fetch("/api/attendance/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, deviceId: getDeviceId(), lat, lng }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok && data.ok) {
      setOk(true); setIsAbsent(false); setPhase("done");
      setMessage(data.message ?? "Marked present!");
    } else if (res.ok && data.absent) {
      setOk(false); setIsAbsent(true); setPhase("done");
      setMessage(data.message ?? "Marked absent: location not available.");
    } else if (data.error === "must_change_password") {
      router.push(data.redirect ?? "/settings/change-password?forced=1");
    } else {
      setOk(false); setIsAbsent(false); setPhase("error");
      setMessage(data.error ?? "Something went wrong. Try again.");
    }
  }, [code, router]);

  const reset = () => { setPhase("idle"); setMessage(""); setIsAbsent(false); };

  return (
    <div className="flex w-full max-w-xs flex-col items-center gap-4">
      {(phase === "idle" || phase === "submitting") && (
        <>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoFocus
            placeholder="••••••"
            disabled={phase === "submitting"}
            className="w-full rounded-2xl border-2 border-primary/30 bg-card px-4 py-4 text-center text-4xl font-bold tracking-[0.4em] tabular-nums text-foreground outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:opacity-60"
          />
          {phase === "submitting" ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {message || "Verifying…"}
            </p>
          ) : (
            <button
              onClick={() => submit()}
              disabled={!/^\d{6}$/.test(code)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 font-semibold text-white shadow-md shadow-primary/20 transition active:scale-[0.99] disabled:opacity-40"
            >
              <KeyRound className="h-5 w-5" /> Mark attendance
            </button>
          )}
        </>
      )}

      {phase === "location_denied" && (
        <div className="w-full rounded-2xl border border-red-500/20 bg-red-500/8 px-4 py-6 text-center dark:bg-red-500/12">
          <MapPinOff className="mx-auto mb-3 h-10 w-10 text-red-500" />
          <p className="mb-1 text-base font-semibold text-red-600 dark:text-red-400">Location permission denied</p>
          <p className="mb-4 text-sm text-muted-foreground">
            Attendance requires your location. Enable it in your browser or device settings, then try again.
          </p>
          <button onClick={reset} className="rounded-lg border border-input px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent">
            Try again after enabling location
          </button>
        </div>
      )}

      {phase === "location_timeout" && (
        <div className="w-full rounded-2xl border border-amber-500/20 bg-amber-500/8 px-4 py-6 text-center dark:bg-amber-500/12">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-500" />
          <p className="mb-1 text-base font-semibold text-amber-700 dark:text-amber-400">Could not acquire location</p>
          <p className="mb-4 text-sm text-muted-foreground">
            Your device could not get a GPS fix. If you continue, you will be <strong>marked absent</strong> due to location non-compliance. Tell your teacher if this is a device issue — they can mark you present manually.
          </p>
          <div className="flex flex-col gap-2">
            <button onClick={() => submit(true)} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600">
              Continue (I understand I may be marked absent)
            </button>
            <button onClick={reset} className="rounded-lg border border-input px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent">
              Wait & retry
            </button>
          </div>
        </div>
      )}

      {phase === "done" && (
        <div className="w-full text-center">
          <div className={`flex flex-col items-center gap-2 rounded-2xl px-4 py-8 ${
            ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
            : isAbsent ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
            : "bg-red-500/10 text-red-700 dark:text-red-400"
          }`}>
            {ok ? <CheckCircle2 className="h-12 w-12" /> : isAbsent ? <MapPinOff className="h-12 w-12" /> : <XCircle className="h-12 w-12" />}
            <span className="text-lg font-semibold">{message}</span>
            {isAbsent && <p className="text-sm opacity-80">Please speak to your teacher if this is a device issue.</p>}
          </div>
        </div>
      )}

      {phase === "error" && (
        <div className="w-full text-center">
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-red-500/10 px-4 py-8 text-red-700 dark:text-red-400">
            <XCircle className="h-12 w-12" />
            <span className="text-lg font-semibold">{message}</span>
          </div>
          <button onClick={reset} className="mt-3 rounded-lg border border-input px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent">
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
