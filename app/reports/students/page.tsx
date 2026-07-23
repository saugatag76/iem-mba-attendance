import Link from "next/link";
import { ChevronRight, Users, Download } from "lucide-react";
import { requireRole } from "@/lib/session";
import { studentsForReports } from "@/lib/attendance";
import { rangeQuery } from "@/lib/dateRange";
import { PageHeader, EmptyState, Avatar, Badge } from "@/app/_components/ui";
import { RouteTabs } from "@/app/_components/layout-ui";
import { FilterBar } from "@/app/_components/FilterBar";
import { DateRangePicker } from "@/app/_components/DateRangePicker";
import { GlobalExportButton } from "@/app/_components/GlobalExportButton";

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
        action={
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker />
            <a
              href={`/api/reports/students/csv${qs}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
            >
              <Download className="h-4 w-4" /> Export CSV
            </a>
            <GlobalExportButton qs={qs} />
          </div>
        }
      />

      <RouteTabs
        active={`/reports/students${qs}`}
        tabs={[
          { label: "Overview", href: `/reports${qs}` },
          { label: "By subject", href: `/reports/offerings${qs}` },
          { label: "By student", href: `/reports/students${qs}` },
          { label: "Substitutions", href: `/reports/substitutions${qs}` },
        ]}
      />

      {students.length === 0 ? (
        <EmptyState icon={<Users className="h-8 w-8" />} title="No students yet" />
      ) : (
        <>
          <FilterBar placeholder="Search student or section…" />
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No students match.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <ul className="divide-y divide-border">
                {filtered.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/reports/student/${s.id}${qs}`}
                      className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-accent"
                    >
                      <Avatar name={s.name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{s.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{s.email}</p>
                      </div>
                      <Badge tone="gray">{s.className}</Badge>
                      <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground/60" />
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
