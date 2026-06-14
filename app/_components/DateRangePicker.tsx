"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRange, ChevronDown } from "lucide-react";
import { cn } from "./ui";

const PRESETS = [
  { label: "Today", days: 0 },
  { label: "Last 7 days", days: 6 },
  { label: "Last 14 days", days: 13 },
  { label: "Last 30 days", days: 29 },
  { label: "Last 3 months", days: 89 },
  { label: "Last 6 months", days: 179 },
];

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatLabel(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-500/30";

/**
 * Date range filter for the Reports section. Writes `from`/`to` (yyyy-mm-dd) to the
 * URL so server pages can filter sessions; "All time" means both are absent.
 */
export function DateRangePicker() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"absolute" | "relative">("absolute");
  const ref = useRef<HTMLDivElement>(null);

  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);

  useEffect(() => {
    setDraftFrom(from);
    setDraftTo(to);
  }, [from, to]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function apply(nextFrom: string, nextTo: string) {
    const next = new URLSearchParams(params.toString());
    if (nextFrom) next.set("from", nextFrom);
    else next.delete("from");
    if (nextTo) next.set("to", nextTo);
    else next.delete("to");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    setOpen(false);
  }

  function applyPreset(days: number) {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    apply(toISODate(start), toISODate(end));
  }

  const label = from && to ? `${formatLabel(from)} – ${formatLabel(to)}` : "All time";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        <CalendarRange className="h-4 w-4 text-slate-400" />
        {label}
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-lg shadow-slate-900/10">
          <div className="mb-3 flex items-center gap-1 border-b border-slate-100 text-sm">
            <button
              type="button"
              onClick={() => setTab("absolute")}
              className={cn(
                "border-b-2 px-2 py-1.5 font-medium transition",
                tab === "absolute" ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700",
              )}
            >
              Absolute
            </button>
            <button
              type="button"
              onClick={() => setTab("relative")}
              className={cn(
                "border-b-2 px-2 py-1.5 font-medium transition",
                tab === "relative" ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700",
              )}
            >
              Relative
            </button>
          </div>

          {tab === "absolute" ? (
            <div className="space-y-2.5">
              <label className="block text-xs font-medium text-slate-600">
                From
                <input
                  type="date"
                  value={draftFrom}
                  max={draftTo || undefined}
                  onChange={(e) => setDraftFrom(e.target.value)}
                  className={cn(inputClass, "mt-1")}
                />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                To
                <input
                  type="date"
                  value={draftTo}
                  min={draftFrom || undefined}
                  onChange={(e) => setDraftTo(e.target.value)}
                  className={cn(inputClass, "mt-1")}
                />
              </label>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => apply("", "")}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  All time
                </button>
                <button
                  type="button"
                  onClick={() => apply(draftFrom, draftTo)}
                  disabled={!draftFrom || !draftTo}
                  className="rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-800 disabled:opacity-50"
                >
                  Apply
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p.days)}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
                >
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => apply("", "")}
                className="col-span-2 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50"
              >
                All time
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
