"use client";

import { useState, useRef } from "react";
import { QrCode, Loader2, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

export function EventScanButton({ eventId }: { eventId: string }) {
  const [phase, setPhase] = useState<"idle" | "scanning" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);

  async function startScan() {
    setPhase("scanning");
    const scanner = new Html5Qrcode(`event-qr-${eventId}`);
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 220 },
        async (text) => {
          await scanner.stop();
          setPhase("loading");
          const res = await fetch("/api/events/scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: text }),
          });
          const data = await res.json();
          setMessage(data.message ?? data.error ?? "Unknown response");
          setPhase(res.ok ? "done" : "error");
        },
        () => {},
      );
    } catch {
      setPhase("error");
      setMessage("Camera access denied or unavailable.");
    }
  }

  async function stop() {
    try { await scannerRef.current?.stop(); } catch {}
    setPhase("idle");
  }

  if (phase === "idle") {
    return (
      <button onClick={startScan} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-primary/90">
        <QrCode className="h-4 w-4" /> Scan
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-4">
      {phase === "scanning" && (
        <div className="w-full max-w-sm">
          <div id={`event-qr-${eventId}`} className="w-full" />
          <button onClick={stop} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 py-2 text-sm text-white">
            <X className="h-4 w-4" /> Cancel
          </button>
        </div>
      )}
      {phase === "loading" && <Loader2 className="h-10 w-10 animate-spin text-white" />}
      {(phase === "done" || phase === "error") && (
        <div className="flex max-w-xs flex-col items-center gap-3 rounded-2xl bg-card p-6 text-center">
          {phase === "done"
            ? <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            : <AlertTriangle className="h-10 w-10 text-red-500" />}
          <p className="text-sm font-medium text-foreground">{message}</p>
          <button onClick={() => setPhase("idle")} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-accent">
            Close
          </button>
        </div>
      )}
    </div>
  );
}
