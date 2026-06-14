import Link from "next/link";
import { BookOpen, CalendarClock, ChevronRight, CalendarDays } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { teacherClassesForDay, todayWeekday, WEEKDAY_LABEL } from "@/lib/schedule";
import { Card, Badge, PageHeader, EmptyState } from "@/app/_components/ui";
import { ClassRow } from "@/app/_components/schedule-ui";
import { OpenSessionButton } from "./_components/OpenSessionButton";

export const dynamic = "force-dynamic";

export default async function TeacherHome() {
  const teacher = await requireRole("TEACHER", "ADMIN");
  const day = todayWeekday();

  const [today, offerings] = await Promise.all([
    teacherClassesForDay(teacher.id, day),
    prisma.offering.findMany({
      where: { teacherId: teacher.id },
      include: {
        subject: true,
        classSection: true,
        _count: { select: { sessions: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Your day"
        subtitle={day ? `Today is ${WEEKDAY_LABEL[day]}` : "It's the weekend — no scheduled classes."}
      />

      <Card title="Today's classes" icon={<CalendarClock className="h-4 w-4" />}>
        {today.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="h-8 w-8" />}
            title={day ? "Nothing scheduled today" : "No classes on weekends"}
            hint="You can still open an ad-hoc session from a class below."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {today.map((r) => (
              <ClassRow key={r.id} row={r} showSection>
                {r.offering && <OpenSessionButton offeringId={r.offering.id} />}
              </ClassRow>
            ))}
          </ul>
        )}
      </Card>

      <h2 className="mb-3 mt-6 text-sm font-semibold text-slate-700">All your classes</h2>
      {offerings.length === 0 && (
        <EmptyState icon={<BookOpen className="h-8 w-8" />} title="No classes assigned yet" />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {offerings.map((o) => (
          <Card key={o.id} className="mb-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <BookOpen className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-slate-900">{o.subject.name}</p>
                  <p className="text-xs text-slate-500">
                    {o.subject.code} · {o.classSection.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{o._count.sessions} sessions held</p>
                </div>
              </div>
              <OpenSessionButton offeringId={o.id} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
