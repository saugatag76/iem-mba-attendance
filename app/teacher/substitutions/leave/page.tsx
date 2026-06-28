import Link from "next/link";
import { ArrowLeft, CalendarRange } from "lucide-react";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/app/_components/ui";
import { createLeaveSubstitutions } from "../actions";
import { LeaveForm } from "./LeaveForm";
import type { Weekday } from "@prisma/client";

export const dynamic = "force-dynamic";

const WEEKDAY_NUM: Record<Weekday, number> = {
  MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5,
};

/** All calendar dates (ISO yyyy-mm-dd) in [from, to] that fall on `weekday`. */
function datesForWeekday(weekday: Weekday, from: Date, to: Date): Date[] {
  const target = WEEKDAY_NUM[weekday];
  const dates: Date[] = [];
  const cur = new Date(from);
  cur.setHours(0, 0, 0, 0);
  while (cur <= to) {
    if (cur.getDay() === target) dates.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

export default async function LeavePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const teacher = await requireRole("TEACHER", "ADMIN");
  const { from: fromStr, to: toStr } = await searchParams;

  // Parse as local date — new Date("yyyy-mm-dd") parses as UTC midnight
  // which shifts the day backward in IST (+5:30). Use explicit local constructor instead.
  function parseLocal(s: string): Date {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const fromDate = fromStr ? parseLocal(fromStr) : null;
  const toDate   = toStr   ? parseLocal(toStr)   : null;

  // All scheduled classes for this teacher
  const slots = await prisma.scheduledClass.findMany({
    where: { offering: { teacherId: teacher.id } },
    include: {
      offering: { include: { subject: true, classSection: true, teacher: true } },
    },
    orderBy: [{ day: "asc" }, { slotIndex: "asc" }],
  });

  // All other teachers (for the substitute picker)
  const allTeachers = await prisma.user.findMany({
    where: { role: "TEACHER", id: { not: teacher.id } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });

  // Compute affected (slot, date) pairs when date range is selected
  type AffectedEntry = {
    slot: (typeof slots)[number];
    date: Date;
    dateISO: string;
  };
  let affected: AffectedEntry[] = [];
  if (fromDate && toDate && fromDate <= toDate) {
    for (const slot of slots) {
      const dates = datesForWeekday(slot.day as Weekday, fromDate, toDate);
      for (const date of dates) {
        // Format as local yyyy-mm-dd — toISOString() shifts to UTC which can change the date in IST
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        affected.push({ slot, date, dateISO: `${y}-${m}-${d}` });
      }
    }
    // Sort by date then slotIndex
    affected.sort((a, b) =>
      a.dateISO.localeCompare(b.dateISO) || a.slot.slotIndex - b.slot.slotIndex,
    );
  }

  const dayLabel: Record<string, string> = {
    MON: "Monday", TUE: "Tuesday", WED: "Wednesday", THU: "Thursday", FRI: "Friday",
  };

  return (
    <div>
      <Link
        href="/teacher/substitutions"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back to substitutions
      </Link>

      <PageHeader
        title="Leave substitution planner"
        subtitle="Select your leave dates — all affected classes are listed with a substitute picker for each"
        action={<CalendarRange className="h-5 w-5 text-muted-foreground" />}
      />

      <LeaveForm
        fromStr={fromStr ?? ""}
        toStr={toStr ?? ""}
        affected={affected.map((e) => ({
          slotId: e.slot.id,
          dateISO: e.dateISO,
          day: dayLabel[e.slot.day] ?? e.slot.day,
          startTime: e.slot.startTime,
          endTime: e.slot.endTime,
          subjectName: e.slot.offering?.subject.name ?? e.slot.rawLabel,
          subjectCode: e.slot.offering?.subject.code ?? "",
          className: e.slot.offering?.classSection.name ?? "",
          subgroup: e.slot.subgroup,
        }))}
        teachers={allTeachers}
        action={createLeaveSubstitutions}
      />
    </div>
  );
}
