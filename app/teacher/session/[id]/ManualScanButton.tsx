"use client";

import { useCallback, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { ScanLine } from "lucide-react";

export function ManualScanButton({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState<boolean | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);

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

  const submit = useCallback(
    async (token: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      const res = await fetch("/api/attendance/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, token }),
      });
      const data = await res.json().catch(() => ({}));
      setOk(res.ok);
      setMsg(res.ok ? data.message : data.error ?? "Failed.");
      // brief pause so the same QR isn't read twice, then keep scanning
      setTimeout(() => {
        busyRef.current = false;
      }, 1500);
    },
    [sessionId],
  );

  const toggle = useCallback(async () => {
    if (open) {
      await stop();
      setOpen(false);
      return;
    }
    setOpen(true);
    setMsg("");
    setOk(null);
    const scanner = new Html5Qrcode("manual-reader");
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decoded) => submit(decoded),
        () => {},
      );
    } catch {
      setOk(false);
      setMsg("Could not open the camera.");
      setOpen(false);
    }
  }, [open, stop, submit]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">Manual fallback</p>
          <p className="text-xs text-slate-500">Scan a student&apos;s personal QR if their camera fails.</p>
        </div>
        <button
          onClick={toggle}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
        >
          <ScanLine className="h-4 w-4" />
          {open ? "Stop" : "Scan student QR"}
        </button>
      </div>
      <div id="manual-reader" className={`mt-3 w-full max-w-xs overflow-hidden rounded-lg ${open ? "" : "hidden"}`} />
      {msg && (
        <p className={`mt-2 text-sm ${ok ? "text-green-700" : "text-red-700"}`}>
          {ok ? "✓ " : "✕ "}
          {msg}
        </p>
      )}
    </div>
  );
}
