import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { requireRole } from "@/lib/session";
import { teacherWeekly } from "@/lib/schedule";
import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState } from "@/app/_components/ui";
import { TimetableGrid, type SubstitutedInfo, type CoveringInfo } from "./TimetableGrid";

export const dynamic = "force-dynamic";

export default async function TeacherTimetablePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const teacher = await requireRole("TEACHER", "ADMIN");
  const { week: weekParam } = await searchParams;
  const week = Number.isFinite(Number(weekParam)) ? Math.trunc(Number(weekParam)) : 0;
  const byDay = await teacherWeekly(teacher.id);
  const hasAny = Object.values(byDay).some((d) => d.length > 0);

  // Selected week's Mon–Fri range (IST calendar dates, stored as midnight-UTC —
  // same convention as SubstitutionRequest.date elsewhere in the app). `week` is
  // an offset in weeks from the current one (0 = this week, -1 = last, +1 = next).
  const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const dow = nowIST.getDay(); // 0=Sun … 6=Sat
  const mondayOffset = (dow === 0 ? -6 : 1 - dow) + week * 7;
  const monday = new Date(nowIST.getFullYear(), nowIST.getMonth(), nowIST.getDate() + mondayOffset);
  const saturday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 5);
  const friday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 4);
  const rangeLabel = `${monday.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${friday.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;

  const [substitutedAway, covering] = await Promise.all([
    // This teacher's own classes that someone else is covering this week.
    prisma.substitutionRequest.findMany({
      where: { requestedById: teacher.id, status: "APPROVED", date: { gte: monday, lt: saturday } },
      include: { scheduledClass: true, substituteTeacher: true },
    }),
    // Classes this teacher is covering for someone else this week.
    prisma.substitutionRequest.findMany({
      where: { substituteTeacherId: teacher.id, status: "APPROVED", date: { gte: monday, lt: saturday } },
      include: {
        scheduledClass: { include: { offering: { include: { subject: true, classSection: true } } } },
        requestedBy: true,
      },
    }),
  ]);

  const substituted = new Map<string, SubstitutedInfo>();
  for (const s of substitutedAway) {
    substituted.set(`${s.scheduledClass.day}-${s.scheduledClass.slotIndex}`, {
      by: s.substituteTeacher.name,
      date: s.date.toISOString().slice(0, 10),
    });
  }
  const coveringMap = new Map<string, CoveringInfo>();
  for (const s of covering) {
    if (!s.scheduledClass.offering) continue;
    coveringMap.set(`${s.scheduledClass.day}-${s.scheduledClass.slotIndex}`, {
      subjectName: s.scheduledClass.offering.subject.name,
      subjectCode: s.scheduledClass.offering.subject.code,
      sectionName: s.scheduledClass.offering.classSection.name,
      forName: s.requestedBy.name,
      date: s.date.toISOString().slice(0, 10),
    });
  }

  return (
    <div>
      <PageHeader
        title="My Timetable"
        subtitle="Your full weekly schedule across all subjects and sections"
        action={
          <div className="flex items-center gap-1.5">
            <Link
              href={`/teacher/timetable?week=${week - 1}`}
              aria-label="Previous week"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-[170px] rounded-lg border border-border bg-card px-3 py-2 text-center text-sm font-medium text-foreground">
              {rangeLabel}
              {week === 0 && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(this week)</span>}
            </div>
            <Link
              href={`/teacher/timetable?week=${week + 1}`}
              aria-label="Next week"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
            {week !== 0 && (
              <Link
                href="/teacher/timetable"
                className="ml-1 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
              >
                Today
              </Link>
            )}
          </div>
        }
      />
      {!hasAny && coveringMap.size === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-8 w-8" />}
          title="No schedule assigned yet"
          hint="Ask your admin to set up your timetable in the Routine editor."
        />
      ) : (
        <>
          {(substituted.size > 0 || coveringMap.size > 0) && (
            <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" /> Handed off
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500/70" /> You're covering
              </span>
            </div>
          )}
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <TimetableGrid byDay={byDay} substituted={substituted} covering={coveringMap} />
          </div>
        </>
      )}
    </div>
  );
}
