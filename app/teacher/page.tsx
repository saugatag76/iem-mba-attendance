import Link from "next/link";
import { CalendarClock, CalendarDays, BookOpen, Clock, FileBarChart } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { teacherClassesForDay, todayWeekday, WEEKDAY_LABEL } from "@/lib/schedule";
import { Card, PageHeader, EmptyState, StatCard, Badge } from "@/app/_components/ui";
import { SectionHeader, CollapsibleGroup } from "@/app/_components/layout-ui";
import { FilterBar } from "@/app/_components/FilterBar";
import { ClassRow } from "@/app/_components/schedule-ui";
import { OpenSessionButton } from "./_components/OpenSessionButton";

export const dynamic = "force-dynamic";

export default async function TeacherHome({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const teacher = await requireRole("TEACHER", "ADMIN");
  const day = todayWeekday();
  const { q = "" } = await searchParams;
  const needle = q.trim().toLowerCase();

  // "Today" in IST — convert to UTC bounds for the DB query.
  const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const midnightIST = new Date(nowIST);
  midnightIST.setHours(0, 0, 0, 0);
  const startUTC = new Date(midnightIST.getTime() - (5 * 60 + 30) * 60 * 1000);
  const endUTC   = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000);

  const [today, offerings, scheduled, substitutingToday, substitutedToday] = await Promise.all([
    teacherClassesForDay(teacher.id, day),
    prisma.offering.findMany({
      where: { teacherId: teacher.id },
      include: { subject: true, classSection: true, _count: { select: { sessions: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.scheduledClass.findMany({
      where: { offering: { teacherId: teacher.id } },
      orderBy: [{ day: "asc" }, { slotIndex: "asc" }],
    }),
    // Approved substitutions where this teacher IS the substitute (covering someone else).
    prisma.substitutionRequest.findMany({
      where: { substituteTeacherId: teacher.id, status: "APPROVED", date: { gte: startUTC, lt: endUTC } },
      include: {
        scheduledClass: {
          include: { offering: { include: { subject: true, classSection: true, teacher: true } } },
        },
        requestedBy: true,
      },
    }),
    // Approved substitutions where this teacher IS the requester (someone else is covering their class).
    prisma.substitutionRequest.findMany({
      where: { requestedById: teacher.id, status: "APPROVED", date: { gte: startUTC, lt: endUTC } },
      include: { scheduledClass: true, substituteTeacher: true },
    }),
  ]);

  const DAY_SHORT: Record<string, string> = { MON: "Mon", TUE: "Tue", WED: "Wed", THU: "Thu", FRI: "Fri" };
  const DAY_COLOR: Record<string, string> = {
    MON: "bg-blue-500/10 text-blue-700 ring-blue-500/20 dark:text-blue-400 dark:ring-blue-500/25",
    TUE: "bg-violet-500/10 text-violet-700 ring-violet-500/20 dark:text-violet-400 dark:ring-violet-500/25",
    WED: "bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-400 dark:ring-amber-500/25",
    THU: "bg-teal-500/10 text-teal-700 ring-teal-500/20 dark:text-teal-400 dark:ring-teal-500/25",
    FRI: "bg-rose-500/10 text-rose-700 ring-rose-500/20 dark:text-rose-400 dark:ring-rose-500/25",
  };
  // Lab subjects can list multiple subgroups (e.g. A1/A2) at the same day/time,
  // each pointing at this offering — collapse those into a single slot chip.
  // Keep one entry per (offering, day, time) — labs may duplicate with subgroups.
  const scheduleByOffering = new Map<string, { id: string; day: string; time: string }[]>();
  const seenSlots = new Set<string>();
  for (const sc of scheduled) {
    if (!sc.offeringId) continue;
    const key = `${sc.offeringId}|${sc.day}|${sc.startTime}-${sc.endTime}`;
    if (seenSlots.has(key)) continue;
    seenSlots.add(key);
    if (!scheduleByOffering.has(sc.offeringId)) scheduleByOffering.set(sc.offeringId, []);
    scheduleByOffering.get(sc.offeringId)!.push({ id: sc.id, day: sc.day, time: `${sc.startTime}–${sc.endTime}` });
  }

  const sessionsHeld = offerings.reduce((a, o) => a + o._count.sessions, 0);

  // Map of scheduledClassId → substitute teacher name (classes Teacher X handed off today).
  const substitutedSlotIds = new Map<string, string>(
    substitutedToday.map((s) => [s.scheduledClassId, s.substituteTeacher.name]),
  );

  // Merge regular classes + approved substitutions into one time-sorted list.
  type SubInfo = { coveringFor: string } | null;
  const allToday: { row: (typeof today)[number]; sub: SubInfo }[] = [
    ...today.map((r) => ({ row: r, sub: null })),
    ...substitutingToday
      .filter((s) => s.scheduledClass.offering)
      .map((s) => ({ row: s.scheduledClass as (typeof today)[number], sub: { coveringFor: s.requestedBy.name } })),
  ].sort((a, b) => a.row.slotIndex - b.row.slotIndex);

  // Current time in IST (timetable times are local India time; server runs UTC).
  function toMins(hhmm: string): number {
    const [h, m] = hhmm.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  }
  const nowMins = nowIST.getHours() * 60 + nowIST.getMinutes();
  // Find the first class (regular or sub) that is currently running or still upcoming.
  const upNext = allToday.find(({ row }) => row.offering && toMins(row.endTime) > nowMins)?.row ?? null;
  const upNextIsNow = upNext != null && toMins(upNext.startTime) <= nowMins;

  // After all today's classes end (or on weekends), show the next teaching day.

  // group offerings by subject
  const filteredOfferings = needle
    ? offerings.filter((o) =>
        `${o.subject.code} ${o.subject.name} ${o.classSection.name}`.toLowerCase().includes(needle),
      )
    : offerings;
  const bySubject = new Map<string, typeof filteredOfferings>();
  for (const o of filteredOfferings) {
    const k = o.subject.name;
    if (!bySubject.has(k)) bySubject.set(k, []);
    bySubject.get(k)!.push(o);
  }
  const subjectGroups = [...bySubject.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div>
      <PageHeader
        title="My Day"
        subtitle={day ? `Today is ${WEEKDAY_LABEL[day]}` : "It's the weekend — no scheduled classes."}
      />

      <div className="mb-6 grid grid-cols-3 gap-3">
        <StatCard icon={<CalendarClock className="h-4 w-4" />} label="Today" value={today.length} hint="scheduled" />
        <StatCard icon={<BookOpen className="h-4 w-4" />} label="Classes" value={offerings.length} hint="you teach" />
        <StatCard icon={<CalendarDays className="h-4 w-4" />} label="Sessions" value={sessionsHeld} hint="held" />
      </div>

      {/* Up next — primary action */}
      {upNext?.offering && (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl bg-primary p-5 text-white shadow-lg shadow-primary/25 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-white/80">
              <Clock className="h-3.5 w-3.5" /> {upNextIsNow ? "Now in session" : "Up next today"}
            </p>
            <p className="mt-1 text-lg font-semibold">{upNext.offering.subject.name}</p>
            <p className="text-sm text-white/85">
              {upNext.startTime}–{upNext.endTime} · {upNext.offering.classSection.name}
            </p>
          </div>
          <div className="[&_button]:!bg-white/15 [&_button]:!text-white [&_button:hover]:!bg-white/25">
            <OpenSessionButton offeringId={upNext.offering.id} />
          </div>
        </div>
      )}

      <Card title="Today's classes" icon={<CalendarClock className="h-4 w-4" />}>
        {allToday.length === 0 && offerings.length === 0 ? (
          <EmptyState icon={<CalendarDays className="h-8 w-8" />} title="No classes assigned yet" />
        ) : allToday.length === 0 && teacher.email === "demo.teacher@iem.edu" ? (
          /* Demo account only — show all offerings any day so demos work on weekends */
          <ul className="divide-y divide-border">
            {offerings.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{o.subject.name}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-mono">{o.subject.code}</span> · {o.classSection.name}
                  </p>
                </div>
                <OpenSessionButton offeringId={o.id} />
              </li>
            ))}
          </ul>
        ) : allToday.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="h-8 w-8" />}
            title={day ? "Nothing scheduled today" : "No classes on weekends"}
          />
        ) : (
          <ul className="divide-y divide-border">
            {allToday.map(({ row: r, sub }) => {
              const todayISO = new Date().toISOString().slice(0, 10);
              const isUpNext = r.id === upNext?.id;
              const coveredByName = !sub ? substitutedSlotIds.get(r.id) : undefined;
              const isSubstituted = !!coveredByName; // Teacher X handed this class off

              return (
                <ClassRow
                  key={`${r.id}-${sub ? "sub" : "own"}`}
                  row={r}
                  showSection
                  className={
                    sub ? "bg-primary/5 px-4 dark:bg-primary/8"
                    : isSubstituted ? "bg-amber-500/8 px-4 dark:bg-amber-500/10"
                    : "px-4"
                  }
                  badge={
                    sub ? <Badge tone="brand">Substituting</Badge>
                    : isSubstituted ? <Badge tone="amber">Substituted</Badge>
                    : undefined
                  }
                  subtitle={
                    sub ? `Covering for ${sub.coveringFor}`
                    : isSubstituted ? `Covered by ${coveredByName}`
                    : undefined
                  }
                >
                  {!isSubstituted && (
                    <div className="flex items-center gap-2">
                      {r.offering && !sub && (
                        <a
                          href={`/teacher/substitutions/new?slotId=${r.id}&date=${todayISO}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:text-primary"
                          title="Request a substitute for this class"
                        >
                          Sub
                        </a>
                      )}
                      {r.offering && (
                        isUpNext ? (
                          <span className="text-xs text-muted-foreground">↑ Up next</span>
                        ) : (
                          <OpenSessionButton offeringId={r.offering.id} />
                        )
                      )}
                    </div>
                  )}
                </ClassRow>
              );
            })}
          </ul>
        )}
      </Card>

      <SectionHeader title="My courses" />
      <p className="-mt-3 mb-3 text-xs text-muted-foreground">
        Every subject/section you teach this trimester, with its weekly schedule. To take attendance, open a
        session from "Today's classes" above on the day it meets.
      </p>
      {offerings.length === 0 ? (
        <EmptyState icon={<BookOpen className="h-8 w-8" />} title="No classes assigned yet" />
      ) : (
        <>
          <FilterBar placeholder="Search subject or section…" />
          {subjectGroups.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No classes match.</p>
          ) : (
            subjectGroups.map(([name, items]) => (
              <CollapsibleGroup key={name} title={name} count={items.length} defaultOpen={subjectGroups.length <= 4}>
                <ul className="divide-y divide-border">
                  {items.map((o) => {
                    const slots = scheduleByOffering.get(o.id) ?? [];
                    return (
                      <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground">{o.classSection.name}</p>
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {o.subject.code}
                            </span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            {slots.length > 0 ? (
                              slots.map((s) => (
                                <span key={s.id} className="flex items-center gap-1">
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ring-1 ring-inset ${DAY_COLOR[s.day] ?? "bg-muted text-muted-foreground ring-slate-200"}`}
                                  >
                                    {DAY_SHORT[s.day]} {s.time}
                                  </span>
                                  <a
                                    href={`/teacher/substitutions/new?slotId=${s.id}`}
                                    className="text-[10px] font-medium text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
                                    title="Request a substitute for this slot"
                                  >
                                    sub?
                                  </a>
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">No weekly slot scheduled</span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-3">
                          <div className="hidden text-right sm:block">
                            <p className="text-sm font-semibold tabular-nums text-foreground">{o._count.sessions}</p>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">sessions</p>
                          </div>
                          <div className="hidden h-8 w-px bg-muted sm:block" />
                          <OpenSessionButton offeringId={o.id} />
                          <Link
                            href={`/reports/offering/${o.id}`}
                            className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
                          >
                            <FileBarChart className="h-3.5 w-3.5" /> Report
                          </Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CollapsibleGroup>
            ))
          )}
        </>
      )}
    </div>
  );
}
