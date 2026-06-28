import { requireRole } from "@/lib/session";
import { teacherWeekly } from "@/lib/schedule";
import { PageHeader, EmptyState } from "@/app/_components/ui";
import { TimetableGrid } from "./TimetableGrid";
import { CalendarDays } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TeacherTimetablePage() {
  const teacher = await requireRole("TEACHER", "ADMIN");
  const byDay = await teacherWeekly(teacher.id);
  const hasAny = Object.values(byDay).some((d) => d.length > 0);

  return (
    <div>
      <PageHeader
        title="My Timetable"
        subtitle="Your full weekly schedule across all subjects and sections"
      />
      {!hasAny ? (
        <EmptyState
          icon={<CalendarDays className="h-8 w-8" />}
          title="No schedule assigned yet"
          hint="Ask your admin to set up your timetable in the Routine editor."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <TimetableGrid byDay={byDay} />
        </div>
      )}
    </div>
  );
}
