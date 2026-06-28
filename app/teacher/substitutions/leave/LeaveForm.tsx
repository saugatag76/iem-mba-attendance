"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search, ChevronDown, ChevronUp, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import type { createLeaveSubstitutions } from "../actions";

type Teacher = { id: string; name: string; email: string };

type AffectedEntry = {
  slotId: string;
  dateISO: string;
  day: string;
  startTime: string;
  endTime: string;
  subjectName: string;
  subjectCode: string;
  className: string;
  subgroup: string | null;
};

function TeacherSelect({
  teachers,
  value,
  onChange,
}: {
  teachers: Teacher[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = teachers.find((t) => t.id === value);
  const filtered = query.trim()
    ? teachers.filter((t) =>
        `${t.name} ${t.email}`.toLowerCase().includes(query.toLowerCase()),
      )
    : teachers;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition",
          selected ? "border-primary/40 bg-primary/5 text-foreground" : "border-input bg-card text-muted-foreground hover:bg-accent",
        )}
      >
        <span className="truncate">{selected ? selected.name : "Select substitute teacher…"}</span>
        {open ? <ChevronUp className="h-3.5 w-3.5 flex-shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card shadow-lg">
          <div className="p-1.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-3 text-sm outline-none focus:border-ring"
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto border-t border-border">
            {filtered.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => { onChange(t.id); setOpen(false); setQuery(""); }}
                className={cn(
                  "flex w-full flex-col px-3 py-2 text-left text-sm transition hover:bg-accent",
                  t.id === value && "bg-primary/8",
                )}
              >
                <span className={cn("font-medium", t.id === value ? "text-primary" : "text-foreground")}>
                  {t.name}
                </span>
                <span className="text-xs text-muted-foreground">{t.email}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-3 text-center text-sm text-muted-foreground">No teachers found.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function LeaveForm({
  fromStr,
  toStr,
  affected,
  teachers,
  action,
}: {
  fromStr: string;
  toStr: string;
  affected: AffectedEntry[];
  teachers: Teacher[];
  action: typeof createLeaveSubstitutions;
}) {
  const router = useRouter();
  const [from, setFrom] = useState(fromStr);
  const [to, setTo] = useState(toStr);

  // substitutes[i] = substituteTeacherId for affected[i] (empty = skip this class)
  const [substitutes, setSubstitutes] = useState<string[]>(() => affected.map(() => ""));
  const [skipped, setSkipped] = useState<boolean[]>(() => affected.map(() => false));

  function applyDates() {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    router.push(`/teacher/substitutions/leave?${params.toString()}`);
  }

  const assignedCount = substitutes.filter((s, i) => s && !skipped[i]).length;
  const totalActive = affected.filter((_, i) => !skipped[i]).length;

  // Group affected entries by date for display
  const byDate = new Map<string, { entry: AffectedEntry; index: number }[]>();
  affected.forEach((e, i) => {
    if (!byDate.has(e.dateISO)) byDate.set(e.dateISO, []);
    byDate.get(e.dateISO)!.push({ entry: e, index: i });
  });

  return (
    <div className="space-y-6">
      {/* Date range picker */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-foreground">Select your leave period</p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">From</label>
            <input
              type="date"
              value={from}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">To</label>
            <input
              type="date"
              value={to}
              min={from || new Date().toISOString().slice(0, 10)}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <button
            type="button"
            onClick={applyDates}
            disabled={!from || !to}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-40"
          >
            Show classes
          </button>
        </div>
      </div>

      {/* Affected classes — grouped by date */}
      {from && to && affected.length === 0 && (
        <div className="rounded-xl border border-dashed border-border py-10 text-center">
          <CalendarDays className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm font-medium text-muted-foreground">No classes scheduled in this period</p>
          <p className="text-xs text-muted-foreground">Weekends and days you have no classes are automatically excluded.</p>
        </div>
      )}

      {affected.length > 0 && (
        <form action={action}>
          {/* Hidden entries for server action */}
          {affected.map((e, i) => (
            <input
              key={i}
              type="hidden"
              name={`entry_${i}`}
              value={
                substitutes[i] && !skipped[i]
                  ? JSON.stringify({ scheduledClassId: e.slotId, date: e.dateISO, substituteTeacherId: substitutes[i] })
                  : ""
              }
            />
          ))}

          {/* Progress */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-2.5">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{assignedCount}</span> of{" "}
              <span className="font-semibold text-foreground">{totalActive}</span> classes assigned
            </p>
            {assignedCount < totalActive && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {totalActive - assignedCount} still need a substitute
              </p>
            )}
          </div>

          {/* Classes by date */}
          <div className="space-y-4">
            {[...byDate.entries()].map(([dateISO, items]) => {
              const d = new Date(dateISO + "T00:00:00");
              const dateLabel = d.toLocaleDateString("en-IN", {
                weekday: "long", day: "2-digit", month: "short", year: "numeric",
              });
              return (
                <div key={dateISO} className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                  {/* Date header */}
                  <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold text-foreground">{dateLabel}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {items.filter(({ index: i }) => !skipped[i]).length} class{items.filter(({ index: i }) => !skipped[i]).length !== 1 ? "es" : ""}
                    </span>
                  </div>

                  {/* Classes on this date */}
                  <div className="divide-y divide-border">
                    {items.map(({ entry: e, index: i }) => (
                      <div key={i} className={cn("px-4 py-3", skipped[i] && "opacity-50")}>
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold text-foreground">{e.subjectName}</span>
                              {e.subgroup && (
                                <span className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
                                  {e.subgroup}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {e.className} · {e.startTime}–{e.endTime}
                            </p>
                          </div>
                          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={skipped[i]}
                              onChange={(ev) => {
                                const next = [...skipped];
                                next[i] = ev.target.checked;
                                setSkipped(next);
                              }}
                              className="accent-primary"
                            />
                            Skip
                          </label>
                        </div>
                        {!skipped[i] && (
                          <TeacherSelect
                            teachers={teachers}
                            value={substitutes[i]}
                            onChange={(id) => {
                              const next = [...substitutes];
                              next[i] = id;
                              setSubstitutes(next);
                            }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Shared reason */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Reason for leave <span className="text-destructive">*</span>
            </label>
            <textarea
              name="reason"
              required
              minLength={5}
              rows={3}
              placeholder="e.g. Medical leave, family emergency, conference…"
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </div>

          {/* Submit */}
          <div className="flex items-center gap-3 border-t border-border pt-4">
            <button
              type="submit"
              disabled={assignedCount === 0}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-40"
            >
              Send {assignedCount > 0 ? `${assignedCount} request${assignedCount > 1 ? "s" : ""}` : "requests"}
            </button>
            <a
              href="/teacher/substitutions"
              className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-accent"
            >
              Cancel
            </a>
          </div>
        </form>
      )}
    </div>
  );
}
