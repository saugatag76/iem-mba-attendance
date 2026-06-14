"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
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
        className={`w-full max-w-xs overflow-hidden rounded-xl ${phase === "scanning" ? "" : "hidden"}`}
      />

      {phase === "idle" && (
        <button
          onClick={startCamera}
          className="w-full max-w-xs rounded-lg bg-gray-900 px-4 py-3 font-medium text-white active:scale-[0.99]"
        >
          Scan attendance QR
        </button>
      )}

      {(phase === "submitting" || phase === "scanning") && (
        <p className="text-sm text-gray-500">{message || "Point at the QR on screen…"}</p>
      )}

      {(phase === "done" || phase === "error") && (
        <div className="w-full max-w-xs text-center">
          <div
            className={`rounded-xl px-4 py-6 text-lg font-semibold ${
              ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
            }`}
          >
            {ok ? "✓ " : "✕ "}
            {message}
          </div>
          {!ok && (
            <button
              onClick={() => {
                setPhase("idle");
                setMessage("");
              }}
              className="mt-3 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium"
            >
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
