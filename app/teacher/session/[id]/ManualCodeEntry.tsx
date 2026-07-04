"use client";

import { useState } from "react";
import { KeyRound, CheckCircle2, XCircle, Loader2 } from "lucide-react";

export function ManualCodeEntry({ sessionId }: { sessionId: string }) {
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy || !/^\d{6}$/.test(code)) return;
    setBusy(true);
    setMsg("");
    setOk(null);
    const res = await fetch("/api/attendance/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, personalCode: code, note: note.trim() || null }),
    });
    const data = await res.json().catch(() => ({}));
    setOk(res.ok);
    setMsg(res.ok ? (data.message ?? "Marked present.") : (data.error ?? "Failed."));
    if (res.ok) { setCode(""); setNote(""); }
    setBusy(false);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3">
        <p className="text-sm font-semibold text-foreground">Manual fallback</p>
        <p className="text-xs text-muted-foreground">
          Ask the student for their 6-digit personal code (shown on their dashboard) and enter it to mark them present.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-shrink-0">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Student personal code</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            placeholder="6-digit code"
            className="w-40 rounded-md border border-input bg-card px-3 py-2 text-center text-lg font-semibold tracking-[0.3em] tabular-nums text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Reason / consent note (optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. device not working, verified in person"
            rows={2}
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
        </div>
      </div>

      <button
        onClick={submit}
        disabled={busy || !/^\d{6}$/.test(code)}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-40"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        Mark present
      </button>

      {msg && (
        <p className={`mt-2 flex items-center gap-1.5 text-sm ${ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
          {ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {msg}
        </p>
      )}
    </div>
  );
}
