import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Badge, EmptyState } from "@/app/_components/ui";
import { Calendar, MapPin } from "lucide-react";
import { EventCodeEntry } from "./EventCodeEntry";

export const dynamic = "force-dynamic";

export default async function StudentEventsPage() {
  const student = await requireRole("STUDENT");

  // Student's enrolled sections
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: student.id },
    select: { classSectionId: true },
  });
  const sectionIds = enrollments.map((e) => e.classSectionId);

  // Events the student is eligible for: no targetSections OR one of their sections is targeted
  const events = await prisma.event.findMany({
    where: {
      status: { in: ["OPEN", "CLOSED", "APPROVED"] },
      OR: [
        { targetSections: { none: {} } },           // no restriction = all students
        { targetSections: { some: { classSectionId: { in: sectionIds } } } },
      ],
    },
    include: {
      createdBy: true,
      attendances: { where: { studentId: student.id }, select: { id: true } },
    },
    orderBy: { eventDate: "desc" },
  });

  const openEvents = events.filter((e) => e.status === "OPEN");
  const pastEvents = events.filter((e) => e.status !== "OPEN");

  return (
    <div>
      <PageHeader title="Events" subtitle="Enter the code shown at the event to mark your attendance." />

      <EventCodeEntry />

      {openEvents.length > 0 && (
        <>
          <p className="mb-3 text-sm font-semibold text-foreground">Live now</p>
          <div className="mb-6 space-y-3">
            {openEvents.map((e) => {
              const attended = e.attendances.length > 0;
              return (
                <div key={e.id} className="rounded-xl border border-primary/30 bg-primary/5 p-4 shadow-sm dark:bg-primary/8">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{e.title}</p>
                      <div className="mt-0.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{e.eventDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
                        {e.venue && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{e.venue}</span>}
                      </div>
                    </div>
                    <Badge tone={attended ? "green" : "amber"}>{attended ? "Attended ✓" : "Enter code above"}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {pastEvents.length > 0 && (
        <>
          <p className="mb-3 text-sm font-semibold text-foreground">Past events</p>
          <div className="space-y-2">
            {pastEvents.map((e) => {
              const attended = e.attendances.length > 0;
              return (
                <div key={e.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 opacity-80">
                  <div>
                    <p className="text-sm font-medium text-foreground">{e.title}</p>
                    <p className="text-xs text-muted-foreground">{e.eventDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>
                  </div>
                  <Badge tone={attended ? "green" : "gray"}>{attended ? "Attended" : "Not attended"}</Badge>
                </div>
              );
            })}
          </div>
        </>
      )}

      {events.length === 0 && (
        <EmptyState icon={<Calendar className="h-8 w-8" />} title="No events right now" hint="Check back when your institution announces an event." />
      )}
    </div>
  );
}
