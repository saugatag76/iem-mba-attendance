"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { QrCode, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { getDeviceId } from "@/lib/device";

type Phase = "idle" | "scanning" | "submitting" | "done" | "error";

function extractToken(text: string): string {
  // QR encodes `${origin}/student/scan?t=<token>`; accept a raw token too.
  try {
    const url = new URL(text);
    return url.searchParams.get("t") ?? text;
  } catch {
    return text;
  }
}

function getPosition(): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(p),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  });
}

export function Scanner({ initialToken }: { initialToken?: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const submittingRef = useRef(false);

  const submit = useCallback(async (raw: string) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setPhase("submitting");
    setMessage("Verifying…");

    const pos = await getPosition();
    const res = await fetch("/api/attendance/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: extractToken(raw),
        deviceId: getDeviceId(),
        lat: pos?.coords.latitude ?? null,
        lng: pos?.coords.longitude ?? null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setOk(true);
      setPhase("done");
      setMessage(data.message ?? "Marked present!");
    } else {
      setOk(false);
      setPhase("error");
      setMessage(data.error ?? "Something went wrong.");
      submittingRef.current = false; // allow retry on failure
    }
  }, []);

  const stop = useCallback(async () => {
    const s = scannerRef.current;
    if (s) {
      try {
        await s.stop();
        await s.clear();
      } catch {
        /* ignore */
      }
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
        async (decoded) => {
          await stop();
          await submit(decoded);
        },
        () => {},
      );
    } catch {
      setPhase("error");
      setMessage("Could not open the camera. Check permissions.");
    }
  }, [stop, submit]);

  // Deep-link path: scanned by the phone's native camera → token already in the URL.
  useEffect(() => {
    if (initialToken) submit(initialToken);
    return () => {
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        id="reader"
        className={`w-full max-w-xs overflow-hidden rounded-2xl border-2 border-brand-200 shadow-sm ${
          phase === "scanning" ? "" : "hidden"
        }`}
      />

      {phase === "idle" && (
        <button
          onClick={startCamera}
          className="inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 px-4 py-3.5 font-semibold text-white shadow-md shadow-brand-900/20 transition active:scale-[0.99]"
        >
          <QrCode className="h-5 w-5" /> Scan attendance QR
        </button>
      )}

      {(phase === "submitting" || phase === "scanning") && (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          {phase === "submitting" && <Loader2 className="h-4 w-4 animate-spin" />}
          {message || "Point at the QR on the teacher's screen…"}
        </p>
      )}

      {(phase === "done" || phase === "error") && (
        <div className="w-full max-w-xs text-center">
          <div
            className={`flex flex-col items-center gap-2 rounded-2xl px-4 py-8 ${
              ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
            }`}
          >
            {ok ? <CheckCircle2 className="h-12 w-12" /> : <XCircle className="h-12 w-12" />}
            <span className="text-lg font-semibold">{message}</span>
          </div>
          {!ok && (
            <button
              onClick={() => {
                setPhase("idle");
                setMessage("");
              }}
              className="mt-3 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
