"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, Loader2 } from "lucide-react";

export function OverrideButton({ sessionId, studentId, name }: { sessionId: string; studentId: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (busy || !note.trim()) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/attendance/override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, studentId, note: note.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Failed.");
      return;
    }
    setOpen(false);
    setNote("");
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md border border-primary/30 px-2 py-1 text-[11px] font-medium text-primary transition hover:bg-primary/10"
      >
        <UserCheck className="h-3 w-3" /> Mark present
      </button>
    );
  }

  return (
    <div className="flex w-64 flex-col items-stretch gap-1.5 text-left">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        autoFocus
        placeholder={`Reason for marking ${name} present (required)`}
        className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
      />
      {error && <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex justify-end gap-1.5">
        <button
          onClick={() => { setOpen(false); setError(""); }}
          className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={busy || !note.trim()}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-primary/90 disabled:opacity-40"
        >
          {busy && <Loader2 className="h-3 w-3 animate-spin" />} Confirm
        </button>
      </div>
    </div>
  );
}
