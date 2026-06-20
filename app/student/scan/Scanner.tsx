"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { QrCode, CheckCircle2, XCircle, Loader2, MapPinOff, AlertTriangle } from "lucide-react";
import { getDeviceId } from "@/lib/device";

type Phase = "idle" | "locating" | "scanning" | "submitting" | "done" | "error" | "location_denied" | "location_timeout";
type LocationErrorType = "permission_denied" | "unavailable" | "timeout" | null;

interface PositionResult {
  coords: { latitude: number; longitude: number } | null;
  errorType: LocationErrorType;
}

function extractToken(text: string): string {
  try {
    const url = new URL(text);
    return url.searchParams.get("t") ?? text;
  } catch {
    return text;
  }
}

function getPosition(): Promise<PositionResult> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      return resolve({ coords: null, errorType: "unavailable" });
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ coords: { latitude: p.coords.latitude, longitude: p.coords.longitude }, errorType: null }),
      (err) => {
        if (err.code === 1 /* PERMISSION_DENIED */) {
          resolve({ coords: null, errorType: "permission_denied" });
        } else if (err.code === 3 /* TIMEOUT */) {
          resolve({ coords: null, errorType: "timeout" });
        } else {
          resolve({ coords: null, errorType: "unavailable" });
        }
      },
      { enableHighAccuracy: true, timeout: 20000 },
    );
  });
}

export function Scanner({ initialToken }: { initialToken?: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [isAbsent, setIsAbsent] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const submittingRef = useRef(false);

  const doSubmit = useCallback(async (raw: string, skipLocation = false) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setPhase("submitting");
    setMessage("Verifying…");

    let lat: number | null = null;
    let lng: number | null = null;

    if (!skipLocation) {
      setMessage("Acquiring location…");
      const pos = await getPosition();

      if (pos.errorType === "permission_denied") {
        submittingRef.current = false;
        setPendingToken(raw);
        setPhase("location_denied");
        return;
      }
      if (pos.errorType !== null) {
        submittingRef.current = false;
        setPendingToken(raw);
        setPhase("location_timeout");
        return;
      }
      lat = pos.coords!.latitude;
      lng = pos.coords!.longitude;
    }

    setMessage("Verifying…");
    const res = await fetch("/api/attendance/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: extractToken(raw),
        deviceId: getDeviceId(),
        lat,
        lng,
      }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok && data.ok) {
      setOk(true);
      setIsAbsent(false);
      setPhase("done");
      setMessage(data.message ?? "Marked present!");
    } else if (res.ok && data.absent) {
      // Location non-compliance — server marked ABSENT and returned 200
      setOk(false);
      setIsAbsent(true);
      setPhase("done");
      setMessage(data.message ?? "Marked absent: location not available.");
    } else {
      setOk(false);
      setIsAbsent(false);
      setPhase("error");
      setMessage(data.error ?? "Something went wrong. Try again.");
      submittingRef.current = false;
    }
  }, []);

  const stop = useCallback(async () => {
    const s = scannerRef.current;
    if (s) {
      try { await s.stop(); await s.clear(); } catch { /* ignore */ }
      scannerRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setPhase("scanning");
    setMessage("");
    const scanner = new Html5Qrcode("reader");
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decoded) => { await stop(); doSubmit(decoded); },
        () => {},
      );
    } catch {
      setPhase("error");
      setMessage("Could not open the camera. Check camera permissions.");
    }
  }, [stop, doSubmit]);

  const reset = () => {
    setPhase("idle");
    setMessage("");
    setPendingToken(null);
    setIsAbsent(false);
    submittingRef.current = false;
  };

  useEffect(() => {
    if (initialToken) doSubmit(initialToken);
    return () => { stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        id="reader"
        className={`w-full max-w-xs overflow-hidden rounded-2xl border-2 border-primary/30 shadow-sm ${phase === "scanning" ? "" : "hidden"}`}
      />

      {phase === "idle" && (
        <button
          onClick={startCamera}
          className="inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 font-semibold text-white shadow-md shadow-primary/20 transition active:scale-[0.99]"
        >
          <QrCode className="h-5 w-5" /> Scan attendance QR
        </button>
      )}

      {(phase === "submitting" || phase === "scanning") && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          {phase === "submitting" && <Loader2 className="h-4 w-4 animate-spin" />}
          {message || "Point at the QR on the teacher's screen…"}
        </p>
      )}

      {/* Location permission denied */}
      {phase === "location_denied" && (
        <div className="w-full max-w-xs rounded-2xl border border-red-500/20 bg-red-500/8 px-4 py-6 text-center dark:bg-red-500/12">
          <MapPinOff className="mx-auto mb-3 h-10 w-10 text-red-500" />
          <p className="mb-1 text-base font-semibold text-red-600 dark:text-red-400">Location permission denied</p>
          <p className="mb-4 text-sm text-muted-foreground">
            Attendance requires your location. Please enable it in your browser or device settings, then try again.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => { submittingRef.current = false; setPhase("idle"); setPendingToken(null); }}
              className="rounded-lg border border-input px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
            >
              Try again after enabling location
            </button>
            <p className="text-xs text-muted-foreground">
              To enable: open your browser settings → Site permissions → Location → Allow this site.
            </p>
          </div>
        </div>
      )}

      {/* Location timeout / unavailable */}
      {phase === "location_timeout" && (
        <div className="w-full max-w-xs rounded-2xl border border-amber-500/20 bg-amber-500/8 px-4 py-6 text-center dark:bg-amber-500/12">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-500" />
          <p className="mb-1 text-base font-semibold text-amber-700 dark:text-amber-400">Could not acquire location</p>
          <p className="mb-4 text-sm text-muted-foreground">
            Your device could not get a GPS fix. If you continue, you will be <strong>marked absent</strong> due to location non-compliance. Inform your teacher if this is a device issue — they can manually mark you present.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => { if (pendingToken) doSubmit(pendingToken, /* skipLocation */ true); }}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600"
            >
              Continue (I understand I may be marked absent)
            </button>
            <button
              onClick={() => { submittingRef.current = false; setPhase("idle"); setPendingToken(null); }}
              className="rounded-lg border border-input px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
            >
              Wait & retry
            </button>
          </div>
        </div>
      )}

      {/* Done — present or absent */}
      {phase === "done" && (
        <div className="w-full max-w-xs text-center">
          <div
            className={`flex flex-col items-center gap-2 rounded-2xl px-4 py-8 ${
              ok
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : isAbsent
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                : "bg-red-500/10 text-red-700 dark:text-red-400"
            }`}
          >
            {ok ? (
              <CheckCircle2 className="h-12 w-12" />
            ) : isAbsent ? (
              <MapPinOff className="h-12 w-12" />
            ) : (
              <XCircle className="h-12 w-12" />
            )}
            <span className="text-lg font-semibold">{message}</span>
            {isAbsent && (
              <p className="text-sm opacity-80">Please speak to your teacher if this is a device issue.</p>
            )}
          </div>
        </div>
      )}

      {/* Retryable error */}
      {phase === "error" && (
        <div className="w-full max-w-xs text-center">
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
