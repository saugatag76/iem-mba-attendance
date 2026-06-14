import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { requireRole } from "@/lib/session";
import { studentsForReports } from "@/lib/attendance";
import { rangeQuery } from "@/lib/dateRange";
import { PageHeader, EmptyState, Avatar, Badge } from "@/app/_components/ui";
import { RouteTabs } from "@/app/_components/layout-ui";
import { FilterBar } from "@/app/_components/FilterBar";
import { DateRangePicker } from "@/app/_components/DateRangePicker";

export const dynamic = "force-dynamic";

export default async function ReportsStudents({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; from?: string; to?: string }>;
}) {
  const user = await requireRole("TEACHER", "ADMIN");
  const isAdmin = user.role === "ADMIN";
  const { q = "", ...rangeParams } = await searchParams;
  const needle = q.trim().toLowerCase();
  const qs = rangeQuery(rangeParams);

  const students = await studentsForReports(isAdmin ? undefined : user.id);

  const filtered = needle
    ? students.filter((s) => `${s.name} ${s.email} ${s.className}`.toLowerCase().includes(needle))
    : students;

  return (
    <div>
      <PageHeader
        title="Attendance reports"
        subtitle={isAdmin ? "Look up any student's attendance across their subjects" : "Look up a student in your classes"}
        action={<DateRangePicker />}
      />

      <RouteTabs
        active={`/reports/students${qs}`}
        tabs={[
          { label: "Overview", href: `/reports${qs}` },
          { label: "By subject", href: `/reports/offerings${qs}` },
          { label: "By student", href: `/reports/students${qs}` },
        ]}
      />

      {students.length === 0 ? (
        <EmptyState icon={<Users className="h-8 w-8" />} title="No students yet" />
      ) : (
        <>
          <FilterBar placeholder="Search student or section…" />
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No students match.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <ul className="divide-y divide-slate-100">
                {filtered.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/reports/student/${s.id}${qs}`}
                      className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-slate-50"
                    >
                      <Avatar name={s.name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">{s.name}</p>
                        <p className="truncate text-xs text-slate-400">{s.email}</p>
                      </div>
                      <Badge tone="gray">{s.className}</Badge>
                      <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
