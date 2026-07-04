"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, CheckCircle2, XCircle, Loader2 } from "lucide-react";

export function EventCodeEntry() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState<boolean | null>(null);

  async function submit() {
    if (busy || !/^\d{6}$/.test(code)) return;
    setBusy(true);
    setMsg("");
    setOk(null);
    const res = await fetch("/api/events/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    setOk(res.ok && data.ok);
    setMsg(res.ok ? (data.message ?? "Recorded.") : (data.error ?? "Failed."));
    if (res.ok && data.ok) { setCode(""); router.refresh(); }
    setBusy(false);
  }

  return (
    <div className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="mb-2 text-sm font-semibold text-foreground">Enter event code</p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          placeholder="6-digit code"
          className="w-44 rounded-lg border border-input bg-card px-3 py-2.5 text-center text-xl font-bold tracking-[0.3em] tabular-nums text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <button
          onClick={submit}
          disabled={busy || !/^\d{6}$/.test(code)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          Mark attendance
        </button>
      </div>
      {msg && (
        <p className={`mt-2 flex items-center gap-1.5 text-sm ${ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
          {ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {msg}
        </p>
      )}
    </div>
  );
}
