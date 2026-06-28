"use client";

import { useRouter } from "next/navigation";
import { useTransition, useState, useMemo } from "react";
import { Pencil, Plus, Trash2, Check, X, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateSlotOffering, addSlotEntry, removeSlotEntry } from "./actions";
import type { Weekday } from "@prisma/client";

const DAYS: Weekday[] = ["MON", "TUE", "WED", "THU", "FRI"];
const DAY_LABEL: Record<Weekday, string> = {
  MON: "Monday", TUE: "Tuesday", WED: "Wednesday", THU: "Thursday", FRI: "Friday",
};
const DAY_SHORT: Record<Weekday, string> = {
  MON: "Mon", TUE: "Tue", WED: "Wed", THU: "Thu", FRI: "Fri",
};

const SLOT_TIMES: Record<number, { start: string; end: string }> = {
  1: { start: "09:30", end: "10:20" },
  2: { start: "10:20", end: "11:10" },
  3: { start: "11:10", end: "12:00" },
  4: { start: "12:00", end: "12:50" },
  5: { start: "13:40", end: "14:30" },
  6: { start: "14:30", end: "15:20" },
  7: { start: "15:20", end: "16:10" },
  8: { start: "16:10", end: "17:00" },
};

/** Shorten a subject code for display inside a tiny cell. Long ACT-* slugs get trimmed. */
function shortCode(code: string): string {
  if (code.length <= 7) return code;
  // ACT-soft-skill-and-grooming... → just show last meaningful segment
  const parts = code.split("-");
  return parts[0] === "ACT" ? "ACT" : code.slice(0, 7);
}

export type SlotEntry = {
  id: string;
  offeringId: string | null;
  subgroup: string | null;
  offering: {
    id: string;
    subject: { name: string; code: string };
    teacher: { name: string };
  } | null;
};

export type GridCell = {
  day: Weekday;
  slotIndex: number;
  startTime: string;
  endTime: string;
  entries: SlotEntry[];
};

export type OfferingOption = {
  id: string;
  subject: { name: string; code: string };
  teacher: { name: string };
};

type EditTarget = { type: "existing"; entry: SlotEntry } | { type: "new" };

/* ───────────────────────────── Dialog editor ───────────────────────────── */

function SlotDialog({
  open,
  onOpenChange,
  target,
  cell,
  classSectionId,
  offerings,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target: EditTarget;
  cell: GridCell;
  classSectionId: string;
  offerings: OfferingOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const entry = target.type === "existing" ? target.entry : null;

  // Two-step: pick subject first, then pick teacher for that subject.
  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string | null>(
    entry?.offering?.subject.code ?? null,
  );
  const [selectedId, setSelectedId] = useState<string | null>(entry?.offeringId ?? null);
  const [subgroup, setSubgroup] = useState(entry?.subgroup ?? "");
  const [subjectQuery, setSubjectQuery] = useState("");

  // Unique subjects from offerings, sorted alphabetically.
  const subjects = useMemo(() => {
    const seen = new Set<string>();
    const result: { name: string; code: string }[] = [];
    for (const o of offerings) {
      if (!seen.has(o.subject.code)) {
        seen.add(o.subject.code);
        result.push(o.subject);
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [offerings]);

  // Teachers available for the selected subject.
  const teachersForSubject = useMemo(
    () => offerings.filter((o) => o.subject.code === selectedSubjectCode),
    [offerings, selectedSubjectCode],
  );

  const filteredSubjects = subjectQuery.trim()
    ? subjects.filter((s) =>
        `${s.code} ${s.name}`.toLowerCase().includes(subjectQuery.toLowerCase()),
      )
    : subjects;

  const selectedOffering = offerings.find((o) => o.id === selectedId) ?? null;

  function close() { onOpenChange(false); }

  function selectSubject(code: string) {
    setSelectedSubjectCode(code);
    setSelectedId(null); // reset teacher when subject changes
    setSubjectQuery("");
  }

  function save() {
    startTransition(async () => {
      if (entry) {
        await updateSlotOffering(entry.id, selectedId, subgroup || null);
      } else {
        await addSlotEntry(
          classSectionId, cell.day, cell.slotIndex,
          cell.startTime, cell.endTime,
          selectedId, subgroup || null,
        );
      }
      router.refresh();
      close();
    });
  }

  function clear() {
    if (!entry) return;
    startTransition(async () => {
      await updateSlotOffering(entry.id, null, null);
      router.refresh();
      close();
    });
  }

  function remove() {
    if (!entry) return;
    startTransition(async () => {
      await removeSlotEntry(entry.id);
      router.refresh();
      close();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">
            {entry ? "Edit slot" : "Assign slot"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {DAY_LABEL[cell.day]} · Slot {cell.slotIndex} · {cell.startTime}–{cell.endTime}
          </p>
        </DialogHeader>

        <div className="flex flex-col gap-4">

          {/* ── Step 1: Subject picker ── */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                1. Subject
              </label>
              {selectedSubjectCode && (
                <button
                  onClick={() => { setSelectedSubjectCode(null); setSelectedId(null); }}
                  className="text-[11px] text-primary hover:underline"
                >
                  Change
                </button>
              )}
            </div>

            {selectedSubjectCode ? (
              /* Selected subject chip */
              <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/8 px-3 py-2 dark:bg-primary/12">
                <Check className="h-4 w-4 flex-shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {subjects.find((s) => s.code === selectedSubjectCode)?.name}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">{selectedSubjectCode}</p>
                </div>
              </div>
            ) : (
              /* Subject search + list */
              <>
                <div className="relative mb-2">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    autoFocus
                    value={subjectQuery}
                    onChange={(e) => setSubjectQuery(e.target.value)}
                    placeholder="Search subject…"
                    className="w-full rounded-md border border-input bg-card py-1.5 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                  />
                </div>
                <div className="max-h-44 overflow-y-auto rounded-md border border-border">
                  {filteredSubjects.length === 0 ? (
                    <p className="px-3 py-4 text-center text-sm text-muted-foreground">No subjects found.</p>
                  ) : (
                    filteredSubjects.map((s) => (
                      <button
                        key={s.code}
                        onClick={() => selectSubject(s.code)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-accent"
                      >
                        <span className="font-mono text-xs text-muted-foreground w-16 flex-shrink-0">{s.code}</span>
                        <span className="font-medium text-foreground">{s.name}</span>
                        <span className="ml-auto text-[10px] text-muted-foreground">
                          {offerings.filter((o) => o.subject.code === s.code).length} teacher{offerings.filter((o) => o.subject.code === s.code).length !== 1 ? "s" : ""}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {/* ── Step 2: Teacher picker (only after subject selected) ── */}
          {selectedSubjectCode && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                2. Teacher
              </label>
              <div className="space-y-1.5">
                {teachersForSubject.map((o) => {
                  const isSelected = selectedId === o.id;
                  return (
                    <button
                      key={o.id}
                      onClick={() => setSelectedId(isSelected ? null : o.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition",
                        isSelected
                          ? "border-primary bg-primary/8 dark:bg-primary/12"
                          : "border-border hover:bg-accent",
                      )}
                    >
                      <span className={cn(
                        "flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2",
                        isSelected ? "border-primary bg-primary" : "border-border",
                      )}>
                        {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </span>
                      <span className={cn("font-medium", isSelected ? "text-primary" : "text-foreground")}>
                        {o.teacher.name}
                      </span>
                    </button>
                  );
                })}
                {teachersForSubject.length === 0 && (
                  <p className="py-3 text-center text-sm text-muted-foreground">No teachers mapped to this subject.</p>
                )}
              </div>
            </div>
          )}

          {/* Subgroup */}
          {selectedSubjectCode && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Subgroup <span className="font-normal opacity-70">(optional — e.g. A1 for lab splits)</span>
              </label>
              <input
                value={subgroup}
                onChange={(e) => setSubgroup(e.target.value)}
                placeholder="A1, B2, F1…"
                className="w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
            </div>
          )}

          {/* Actions */}
          {selectedSubjectCode && (
            <div className="flex items-center gap-2 border-t border-border pt-3">
              <button
                onClick={save}
                disabled={pending || !selectedId}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-40"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {entry ? "Update" : "Assign"}
              </button>
              {entry?.offeringId && (
                <button onClick={clear} disabled={pending}
                  className="rounded-md border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent disabled:opacity-40">
                  Clear
                </button>
              )}
              {entry && (
                <button onClick={remove} disabled={pending} title="Remove row"
                  className="rounded-md border border-red-500/25 px-2.5 py-2 text-red-600 transition hover:bg-red-500/10 disabled:opacity-40 dark:text-red-400">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button onClick={close}
                className="rounded-md border border-border px-2.5 py-2 text-muted-foreground transition hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Cancel when on subject step */}
          {!selectedSubjectCode && (
            <button onClick={close}
              className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground transition hover:bg-accent">
              Cancel
            </button>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────────────── Cell ───────────────────────────── */

function GridCellView({
  cell,
  classSectionId,
  offerings,
}: {
  cell: GridCell;
  classSectionId: string;
  offerings: OfferingOption[];
}) {
  const [dialogTarget, setDialogTarget] = useState<EditTarget | null>(null);

  return (
    <div className="group/cell flex min-h-[88px] flex-col gap-1 p-1.5">
      {cell.entries.map((entry) => (
        <button
          key={entry.id}
          onClick={() => setDialogTarget({ type: "existing", entry })}
          className={cn(
            "group/btn flex w-full flex-col rounded-md px-2 py-1.5 text-left transition",
            entry.offering
              ? "bg-primary/8 ring-1 ring-inset ring-primary/20 hover:bg-primary/15 dark:bg-primary/10"
              : "bg-muted hover:bg-muted/70",
          )}
        >
          {entry.offering ? (
            <>
              {/* Subject name — primary info */}
              <span className="flex w-full items-start gap-1">
                <span className="min-w-0 flex-1 text-xs font-semibold leading-tight text-foreground line-clamp-2">
                  {entry.offering.subject.name}
                </span>
                <Pencil className="mt-0.5 h-2.5 w-2.5 flex-shrink-0 text-muted-foreground opacity-0 transition group-hover/btn:opacity-100" />
              </span>
              {/* Teacher + code + subgroup */}
              <span className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className="min-w-0 flex-1 truncate">{entry.offering.teacher.name}</span>
                <span className="flex-shrink-0 font-mono text-[9px] text-muted-foreground/60">
                  {shortCode(entry.offering.subject.code)}
                </span>
                {entry.subgroup && (
                  <span className="flex-shrink-0 rounded bg-primary/15 px-1 font-semibold text-primary">
                    {entry.subgroup}
                  </span>
                )}
              </span>
            </>
          ) : (
            <span className="text-[10px] italic text-muted-foreground/50">
              unassigned{entry.subgroup ? ` · ${entry.subgroup}` : ""}
            </span>
          )}
        </button>
      ))}

      {/* Add / Assign button — visible on cell hover */}
      <button
        onClick={() => setDialogTarget({ type: "new" })}
        className={cn(
          "flex w-full items-center justify-center gap-1 rounded-md border border-dashed py-1 text-[10px] transition",
          cell.entries.length === 0
            ? "border-border/60 text-muted-foreground/50 group-hover/cell:border-primary/40 group-hover/cell:text-primary"
            : "border-transparent text-transparent group-hover/cell:border-border/60 group-hover/cell:text-muted-foreground/50 hover:!border-primary/40 hover:!text-primary",
        )}
      >
        <Plus className="h-3 w-3" />
        {cell.entries.length === 0 ? "Assign" : "Add split"}
      </button>

      {dialogTarget && (
        <SlotDialog
          open
          onOpenChange={(v) => { if (!v) setDialogTarget(null); }}
          target={dialogTarget}
          cell={cell}
          classSectionId={classSectionId}
          offerings={offerings}
        />
      )}
    </div>
  );
}

/* ───────────────────────────── Full grid ───────────────────────────── */

export function RoutineGrid({
  classSectionId,
  cells,
  offerings,
}: {
  classSectionId: string;
  cells: GridCell[];
  offerings: OfferingOption[];
}) {
  const slotNums = [1, 2, 3, 4, 5, 6, 7, 8];
  const cellMap = new Map<string, GridCell>();
  for (const c of cells) cellMap.set(`${c.day}|${c.slotIndex}`, c);

  function getCell(day: Weekday, slot: number): GridCell {
    return cellMap.get(`${day}|${slot}`) ?? {
      day, slotIndex: slot,
      startTime: SLOT_TIMES[slot].start,
      endTime: SLOT_TIMES[slot].end,
      entries: [],
    };
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px] border-collapse">
        <thead>
          <tr>
            {/* Slot header */}
            <th className="w-[90px] border-b border-r border-border bg-muted/60 px-3 py-3 text-left">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Slot</span>
            </th>
            {DAYS.map((d) => (
              <th key={d} className="border-b border-r border-border bg-muted/60 px-3 py-3 text-center last:border-r-0">
                <span className="block text-sm font-bold text-foreground">{DAY_SHORT[d]}</span>
                <span className="block text-[10px] font-normal text-muted-foreground">{DAY_LABEL[d]}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slotNums.map((slot) => {
            const times = SLOT_TIMES[slot];
            return (
              <tr key={`slot-${slot}`} className="group/row">
                <td className={cn(
                  "border-b border-r border-border bg-muted/30 px-3 py-2 align-middle",
                  slot === 5 && "border-t-2 border-t-amber-500/30",
                )}>
                  <div className="flex flex-col items-start gap-0.5">
                    <span className="text-xs font-bold text-foreground">Slot {slot}</span>
                    <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                      {times.start}
                    </span>
                    <span className="font-mono text-[10px] tabular-nums text-muted-foreground/60">
                      {times.end}
                    </span>
                    {slot === 5 && (
                      <span className="mt-1 rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                        Post lunch
                      </span>
                    )}
                  </div>
                </td>
                {DAYS.map((day) => (
                  <td
                    key={day}
                    className={cn(
                      "border-b border-r border-border align-top p-0 last:border-r-0",
                      "transition-colors group-hover/row:bg-muted/20",
                      slot === 5 && "border-t-2 border-t-amber-500/30",
                    )}
                  >
                    <GridCellView
                      cell={getCell(day, slot)}
                      classSectionId={classSectionId}
                      offerings={offerings}
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
