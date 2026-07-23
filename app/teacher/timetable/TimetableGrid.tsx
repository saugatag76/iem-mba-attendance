import { cn } from "@/lib/utils";
import type { ScheduleRow } from "@/lib/schedule";
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

function shortCode(code: string): string {
  if (code.length <= 7) return code;
  const parts = code.split("-");
  return parts[0] === "ACT" ? "ACT" : code.slice(0, 7);
}

export type SubstitutedInfo = { by: string; date: string };
export type CoveringInfo = {
  subjectName: string;
  subjectCode: string;
  sectionName: string;
  forName: string;
  date: string;
};

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function TimetableGrid({
  byDay,
  substituted,
  covering,
}: {
  byDay: Record<Weekday, ScheduleRow[]>;
  substituted?: Map<string, SubstitutedInfo>;
  covering?: Map<string, CoveringInfo>;
}) {
  const slotNums = [1, 2, 3, 4, 5, 6, 7, 8];

  // Build a lookup: day → slotIndex → rows
  function getSlotRows(day: Weekday, slot: number): ScheduleRow[] {
    return byDay[day].filter((r) => r.slotIndex === slot);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr>
            <th className="w-24 border-b border-r border-border bg-muted/60 px-3 py-2.5 text-left">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Day</span>
            </th>
            {slotNums.map((slot) => {
              const times = SLOT_TIMES[slot];
              return (
                <th
                  key={slot}
                  className={cn(
                    "border-b border-r border-border bg-muted/60 px-2 py-2.5 text-center last:border-r-0",
                    slot === 5 && "border-l-2 border-l-amber-500/30",
                  )}
                >
                  <span className="block text-xs font-bold text-foreground">Slot {slot}</span>
                  <span className="block font-mono text-[9px] tabular-nums text-muted-foreground">
                    {times.start}–{times.end}
                  </span>
                  {slot === 5 && (
                    <span className="mt-1 inline-block rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                      Post lunch
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {DAYS.map((day) => {
            return (
              <tr key={day} className="group/row">
                <td className="border-b border-r border-border bg-muted/30 px-3 py-2 align-middle">
                  <div className="flex flex-col items-start gap-0.5">
                    <span className="text-sm font-bold text-foreground">{DAY_SHORT[day]}</span>
                    <span className="text-[10px] font-normal text-muted-foreground">{DAY_LABEL[day]}</span>
                  </div>
                </td>
                {slotNums.map((slot) => {
                  const rows = getSlotRows(day, slot);
                  const key = `${day}-${slot}`;
                  const coverInfo = covering?.get(key);
                  const isEmpty = rows.length === 0 && !coverInfo;
                  return (
                    <td
                      key={slot}
                      className={cn(
                        "border-b border-r border-border align-top p-1.5 last:border-r-0",
                        "transition-colors group-hover/row:bg-muted/20",
                        slot === 5 && "border-l-2 border-l-amber-500/30",
                      )}
                    >
                      <div className="flex min-h-[80px] flex-col gap-1">
                        {isEmpty ? (
                          <div className="flex flex-1 items-center justify-center">
                            <span className="text-[10px] text-muted-foreground/30">—</span>
                          </div>
                        ) : (
                          <>
                            {rows.map((r) => {
                              if (!r.offering) return null;
                              const subInfo = substituted?.get(key);
                              return (
                                <div
                                  key={r.id}
                                  className={cn(
                                    "flex flex-col rounded-md px-2 py-1.5 ring-1 ring-inset",
                                    subInfo
                                      ? "bg-amber-500/8 ring-amber-500/25 dark:bg-amber-500/10"
                                      : "bg-primary/8 ring-primary/20 dark:bg-primary/10",
                                  )}
                                >
                                  <span className="min-w-0 text-xs font-semibold leading-tight text-foreground line-clamp-2">
                                    {r.offering.subject.name}
                                  </span>
                                  <span className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                                    <span className="min-w-0 flex-1 truncate">{r.offering.classSection.name}</span>
                                    <span className="flex-shrink-0 font-mono text-[9px] text-muted-foreground/60">
                                      {shortCode(r.offering.subject.code)}
                                    </span>
                                    {r.subgroup && (
                                      <span className="flex-shrink-0 rounded bg-primary/15 px-1 font-semibold text-primary">
                                        {r.subgroup}
                                      </span>
                                    )}
                                  </span>
                                  {subInfo && (
                                    <span className="mt-1 truncate rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:text-amber-400">
                                      {fmtDate(subInfo.date)} · Covered by {subInfo.by}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                            {coverInfo && (
                              <div className="flex flex-col rounded-md bg-brand-100/60 px-2 py-1.5 ring-1 ring-inset ring-blue-500/25 dark:bg-blue-500/10">
                                <span className="min-w-0 text-xs font-semibold leading-tight text-foreground line-clamp-2">
                                  {coverInfo.subjectName}
                                </span>
                                <span className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                                  <span className="min-w-0 flex-1 truncate">{coverInfo.sectionName}</span>
                                  <span className="flex-shrink-0 font-mono text-[9px] text-muted-foreground/60">
                                    {shortCode(coverInfo.subjectCode)}
                                  </span>
                                </span>
                                <span className="mt-1 truncate rounded bg-blue-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-blue-700 dark:text-blue-400">
                                  {fmtDate(coverInfo.date)} · Covering for {coverInfo.forName}
                                </span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
