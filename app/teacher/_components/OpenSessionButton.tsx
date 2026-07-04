"use client";

import { useRef, useState } from "react";
import { KeyRound, Loader2, X } from "lucide-react";
import { openSession } from "../actions";

export function OpenSessionButton({
  offeringId,
  variant = "primary",
  label = "Open session",
}: {
  offeringId: string;
  variant?: "primary" | "secondary";
  label?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const customRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [customMode, setCustomMode] = useState(false);

  // Geofence is a fixed, pre-surveyed campus anchor (lib/campusLocation.ts) — no
  // client-side GPS capture needed, so the session opens immediately.
  function start() {
    setBusy(true);
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={openSession} className="flex flex-shrink-0 items-center gap-1.5">
      <input type="hidden" name="offeringId" value={offeringId} />

      {customMode ? (
        <div className="flex items-center gap-1">
          <input
            ref={customRef}
            type="number"
            name="customMin"
            min={1}
            autoFocus
            placeholder="mins"
            aria-label="Auto-close after (minutes)"
            className="w-16 rounded-lg border border-input bg-card px-2 py-1.5 text-xs font-medium text-foreground placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={() => setCustomMode(false)}
            aria-label="Use a preset duration instead"
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-input bg-card text-muted-foreground transition hover:bg-accent"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <select
          name="presetMin"
          defaultValue="0"
          aria-label="Auto-close session after"
          onChange={(e) => {
            if (e.target.value === "custom") setCustomMode(true);
          }}
          className="rounded-lg border border-input bg-card px-1.5 py-1.5 text-xs font-medium text-foreground"
        >
          <option value="0">No limit</option>
          <option value="1">1 min</option>
          <option value="5">5 min</option>
          <option value="10">10 min</option>
          <option value="15">15 min</option>
          <option value="20">20 min</option>
          <option value="30">30 min</option>
          <option value="60">60 min</option>
          <option value="custom">Custom…</option>
        </select>
      )}

      <button
        type="button"
        onClick={start}
        disabled={busy}
        className={
          variant === "secondary"
            ? "inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent active:scale-[0.98] disabled:opacity-50"
            : "inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
        }
      >
        {busy ? <Loader2 className={variant === "secondary" ? "h-3.5 w-3.5 animate-spin" : "h-4 w-4 animate-spin"} /> : <KeyRound className={variant === "secondary" ? "h-3.5 w-3.5" : "h-4 w-4"} />}
        {busy ? "Opening…" : label}
      </button>
    </form>
  );
}
