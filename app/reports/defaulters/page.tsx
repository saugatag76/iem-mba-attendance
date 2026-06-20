import Link from "next/link";
import { ArrowLeft, AlertTriangle, Download, Users } from "lucide-react";
import { requireRole } from "@/lib/session";
import { defaultersList } from "@/lib/attendance";
import { parseDateRange, rangeQuery } from "@/lib/dateRange";
import { PageHeader, EmptyState, Avatar, Badge } from "@/app/_components/ui";
import { FilterBar } from "@/app/_components/FilterBar";
import { DateRangePicker } from "@/app/_components/DateRangePicker";

export const dynamic = "force-dynamic";

export default async function DefaultersReport({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; from?: string; to?: string }>;
}) {
  const user = await requireRole("TEACHER", "ADMIN");
  const isAdmin = user.role === "ADMIN";
  const { q = "", ...rangeParams } = await searchParams;
  const needle = q.trim().toLowerCase();
  const range = parseDateRange(rangeParams);
  const qs = rangeQuery(rangeParams);

  const rows = await defaultersList(isAdmin ? {} : { teacherId: user.id }, range);

  const filtered = needle
    ? rows.filter((r) =>
        `${r.studentName} ${r.studentEmail} ${r.subjectCode} ${r.subjectName} ${r.className} ${r.teacherName}`
          .toLowerCase()
          .includes(needle),
      )
    : rows;

  return (
    <div>
      <Link href={`/reports${qs}`} className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> Back to overview
      </Link>

      <PageHeader
        title="Below 75% attendance"
        subtitle={`${filtered.length} of ${rows.length} student–subject combinations below the 75% threshold`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker />
            <a
              href={`/api/reports/defaulters/csv${qs}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
            >
              <Download className="h-4 w-4" /> Export CSV
            </a>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={<Users className="h-8 w-8" />} title="No one is below 75% — nice work" />
      ) : (
        <>
          <FilterBar placeholder="Search student, subject or section…" />
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No rows match.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Student</th>
                    <th className="px-4 py-2.5 font-medium">Subject</th>
                    {isAdmin && <th className="px-4 py-2.5 font-medium">Teacher</th>}
                    <th className="px-4 py-2.5 text-center font-medium">Attended</th>
                    <th className="px-4 py-2.5 text-right font-medium">
                      <span className="flex items-center justify-end gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" /> Attendance
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((r) => (
                    <tr key={`${r.offeringId}:${r.studentId}`} className="bg-red-500/5 dark:bg-red-500/10">
                      <td className="px-4 py-2.5">
                        <Link href={`/reports/student/${r.studentId}${qs}`} className="flex items-center gap-2.5 hover:text-primary">
                          <Avatar name={r.studentName} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{r.studentName}</p>
                            <p className="truncate text-xs text-muted-foreground">{r.studentEmail}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">
                        <Link href={`/reports/offering/${r.offeringId}${qs}`} className="hover:text-primary">
                          <p className="font-medium text-foreground">
                            <span className="font-mono text-xs text-muted-foreground">{r.subjectCode}</span> {r.subjectName}
                          </p>
                          <p className="text-xs text-muted-foreground">{r.className}</p>
                        </Link>
                      </td>
                      {isAdmin && <td className="px-4 py-2.5 text-muted-foreground">{r.teacherName}</td>}
                      <td className="px-4 py-2.5 text-center tabular-nums text-muted-foreground">
                        {r.attended}/{r.total}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Badge tone={r.percent >= 60 ? "amber" : "red"}>{r.percent}%</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
