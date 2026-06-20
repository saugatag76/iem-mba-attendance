import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { sectionWeekly } from "@/lib/schedule";
import { PageHeader, EmptyState } from "@/app/_components/ui";
import { WeeklyView } from "@/app/_components/schedule-ui";
import { CalendarDays } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StudentTimetable() {
  const user = await requireRole("STUDENT", "ADMIN");

  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: user.id },
    include: { classSection: true },
    orderBy: { classSection: { name: "asc" } },
  });

  return (
    <div>
      <PageHeader title="Your timetable" subtitle="Weekly routine for your class." />

      {enrollments.length === 0 && (
        <EmptyState icon={<CalendarDays className="h-8 w-8" />} title="You're not enrolled in a class yet" />
      )}

      {await Promise.all(
        enrollments.map(async (e) => {
          const byDay = await sectionWeekly(e.classSectionId);
          return (
            <section key={e.id} className="mb-6">
              <h2 className="mb-3 text-sm font-semibold text-foreground">{e.classSection.name}</h2>
              <WeeklyView byDay={byDay} />
            </section>
          );
        }),
      )}
    </div>
  );
}
