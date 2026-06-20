"use client";

import { useCallback, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { ScanLine, CheckCircle2, XCircle } from "lucide-react";

export function ManualScanButton({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState<boolean | null>(null);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);

  const stop = useCallback(async () => {
    const s = scannerRef.current;
    if (s) {
      try { await s.stop(); await s.clear(); } catch { /* ignore */ }
      scannerRef.current = null;
    }
  }, []);

  const submit = useCallback(
    async (token: string, consentNote: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      const res = await fetch("/api/attendance/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, token, note: consentNote.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      setOk(res.ok);
      setMsg(res.ok ? (data.message ?? "Marked present.") : (data.error ?? "Failed."));
      setPendingToken(null);
      setNote("");
      setTimeout(() => { busyRef.current = false; }, 1500);
    },
    [sessionId],
  );

  const onDecode = useCallback(async (decoded: string) => {
    if (busyRef.current) return;
    await stop();
    setOpen(false);
    setPendingToken(decoded);
    setMsg("");
    setOk(null);
  }, [stop]);

  const toggle = useCallback(async () => {
    if (open) {
      await stop();
      setOpen(false);
      return;
    }
    setOpen(true);
    setPendingToken(null);
    setMsg("");
    setOk(null);
    setNote("");
    const scanner = new Html5Qrcode("manual-reader");
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decoded) => onDecode(decoded),
        () => {},
      );
    } catch {
      setOk(false);
      setMsg("Could not open the camera.");
      setOpen(false);
    }
  }, [open, stop, onDecode]);

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Manual fallback</p>
          <p className="text-xs text-muted-foreground">Scan a student&apos;s personal QR if their camera fails.</p>
        </div>
        <button
          onClick={toggle}
          className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-sm font-medium text-foreground transition hover:bg-accent active:scale-[0.98]"
        >
          <ScanLine className="h-4 w-4" />
          {open ? "Stop" : "Scan student QR"}
        </button>
      </div>

      <div id="manual-reader" className={`mt-3 w-full max-w-xs overflow-hidden rounded-lg ${open ? "" : "hidden"}`} />

      {/* Confirm scan with optional consent note */}
      {pendingToken && (
        <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/8 p-3 dark:border-amber-500/25 dark:bg-amber-500/12">
          <p className="mb-2 text-sm font-medium text-amber-700 dark:text-amber-400">Student QR scanned. Add a reason for the override (optional):</p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. GPS not working on device, teacher verified in person"
            rows={2}
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => submit(pendingToken, note)}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary/90"
            >
              Confirm & mark present
            </button>
            <button
              onClick={() => { setPendingToken(null); setNote(""); }}
              className="rounded-lg border border-input px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {msg && (
        <p className={`mt-2 flex items-center gap-1.5 text-sm ${ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
          {ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {msg}
        </p>
      )}
    </div>
  );
}
