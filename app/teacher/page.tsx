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

  const [today, offerings, scheduled] = await Promise.all([
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
  ]);

  const DAY_SHORT: Record<string, string> = { MON: "Mon", TUE: "Tue", WED: "Wed", THU: "Thu", FRI: "Fri" };
  const DAY_COLOR: Record<string, string> = {
    MON: "bg-blue-50 text-blue-700 ring-blue-200",
    TUE: "bg-violet-50 text-violet-700 ring-violet-200",
    WED: "bg-amber-50 text-amber-700 ring-amber-200",
    THU: "bg-teal-50 text-teal-700 ring-teal-200",
    FRI: "bg-rose-50 text-rose-700 ring-rose-200",
  };
  // Lab subjects can list multiple subgroups (e.g. A1/A2) at the same day/time,
  // each pointing at this offering — collapse those into a single slot chip.
  const scheduleByOffering = new Map<string, { day: string; time: string }[]>();
  const seenSlots = new Set<string>();
  for (const sc of scheduled) {
    if (!sc.offeringId) continue;
    const key = `${sc.offeringId}|${sc.day}|${sc.startTime}-${sc.endTime}`;
    if (seenSlots.has(key)) continue;
    seenSlots.add(key);
    if (!scheduleByOffering.has(sc.offeringId)) scheduleByOffering.set(sc.offeringId, []);
    scheduleByOffering.get(sc.offeringId)!.push({ day: sc.day, time: `${sc.startTime}–${sc.endTime}` });
  }

  const sessionsHeld = offerings.reduce((a, o) => a + o._count.sessions, 0);
  const upNext = today.find((t) => t.offering) ?? null;

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
        <div className="mb-6 flex flex-col gap-3 rounded-2xl bg-gradient-to-br from-orange-500 to-rose-500 p-5 text-white shadow-lg shadow-orange-500/25 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-white/80">
              <Clock className="h-3.5 w-3.5" /> Up next today
            </p>
            <p className="mt-1 text-lg font-semibold">{upNext.offering.subject.name}</p>
            <p className="text-sm text-white/85">
              {upNext.startTime}–{upNext.endTime} · {upNext.offering.classSection.name}
            </p>
          </div>
          <div className="[&_button]:!bg-white [&_button]:!text-orange-700 [&_button:hover]:!bg-white/90">
            <OpenSessionButton offeringId={upNext.offering.id} />
          </div>
        </div>
      )}

      <Card title="Today's classes" icon={<CalendarClock className="h-4 w-4" />}>
        {today.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="h-8 w-8" />}
            title={day ? "Nothing scheduled today" : "No classes on weekends"}
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {today.map((r) => (
              <ClassRow key={r.id} row={r} showSection>
                {r.offering &&
                  (r.id === upNext?.id ? (
                    <span className="text-xs text-slate-400">↑ Open from "Up next" above</span>
                  ) : (
                    <OpenSessionButton offeringId={r.offering.id} />
                  ))}
              </ClassRow>
            ))}
          </ul>
        )}
      </Card>

      <SectionHeader title="My courses" />
      <p className="-mt-3 mb-3 text-xs text-slate-400">
        Every subject/section you teach this trimester, with its weekly schedule. To take attendance, open a
        session from "Today's classes" above on the day it meets.
      </p>
      {offerings.length === 0 ? (
        <EmptyState icon={<BookOpen className="h-8 w-8" />} title="No classes assigned yet" />
      ) : (
        <>
          <FilterBar placeholder="Search subject or section…" />
          {subjectGroups.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No classes match.</p>
          ) : (
            subjectGroups.map(([name, items]) => (
              <CollapsibleGroup key={name} title={name} count={items.length} defaultOpen={subjectGroups.length <= 4}>
                <ul className="divide-y divide-slate-100">
                  {items.map((o) => {
                    const slots = scheduleByOffering.get(o.id) ?? [];
                    return (
                      <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-slate-800">{o.classSection.name}</p>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                              {o.subject.code}
                            </span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            {slots.length > 0 ? (
                              slots.map((s, i) => (
                                <span
                                  key={i}
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ring-1 ring-inset ${DAY_COLOR[s.day] ?? "bg-slate-50 text-slate-600 ring-slate-200"}`}
                                >
                                  {DAY_SHORT[s.day]} {s.time}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-slate-400">No weekly slot scheduled</span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-3">
                          <div className="hidden text-right sm:block">
                            <p className="text-sm font-semibold tabular-nums text-slate-700">{o._count.sessions}</p>
                            <p className="text-[10px] uppercase tracking-wide text-slate-400">sessions</p>
                          </div>
                          <div className="hidden h-8 w-px bg-slate-100 sm:block" />
                          <Link
                            href={`/reports/offering/${o.id}`}
                            className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
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
