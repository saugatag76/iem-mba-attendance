import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, CalendarClock, Users, AlertTriangle, Check, Minus } from "lucide-react";
import { requireRole } from "@/lib/session";
import { offeringReport } from "@/lib/attendance";
import { parseDateRange, rangeQuery } from "@/lib/dateRange";
import { Badge, Avatar, StatCard } from "@/app/_components/ui";
import { FilterBar } from "@/app/_components/FilterBar";
import { SectionHeader } from "@/app/_components/layout-ui";
import { DateRangePicker } from "@/app/_components/DateRangePicker";
import { GlobalExportButton } from "@/app/_components/GlobalExportButton";

const THRESHOLD = 75;

export default async function OfferingReport({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; sort?: string; from?: string; to?: string }>;
}) {
  const user = await requireRole("TEACHER", "ADMIN");
  const { id } = await params;
  const { q = "", sort = "percent", ...rangeParams } = await searchParams;
  const range = parseDateRange(rangeParams);
  const qs = rangeQuery(rangeParams);
  const report = await offeringReport(id, range);
  if (!report) notFound();
  if (user.role !== "ADMIN" && report.offering.teacherId !== user.id) notFound();

  const { offering, total, rows, sessions } = report;
  const defaulters = rows.filter((r) => r.percent < THRESHOLD).length;

  const needle = q.trim().toLowerCase();
  let view = needle
    ? rows.filter((r) => r.name.toLowerCase().includes(needle) || r.email.toLowerCase().includes(needle))
    : [...rows];
  if (sort === "percent_desc") view.sort((a, b) => b.percent - a.percent);
  else if (sort === "name") view.sort((a, b) => a.name.localeCompare(b.name));
  else view.sort((a, b) => a.percent - b.percent); // lowest first (default)

  return (
    <div>
      <Link
        href={`/reports/offerings${qs}`}
        className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back to subjects
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">{offering.subject.name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {offering.subject.code} · {offering.classSection.name}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker />
          <a
            href={`/api/reports/offering/${id}/csv`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
          >
            <Download className="h-4 w-4" /> Export CSV
          </a>
          <GlobalExportButton qs={qs} />
        </div>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <StatCard icon={<CalendarClock className="h-4 w-4" />} label="Sessions" value={total} />
        <StatCard icon={<Users className="h-4 w-4" />} label="Students" value={rows.length} />
        <StatCard icon={<AlertTriangle className="h-4 w-4" />} label={`Below ${THRESHOLD}%`} value={defaulters} />
      </div>

      <FilterBar
        placeholder="Search student…"
        filters={[
          {
            name: "sort",
            label: "Sort",
            defaultLabel: "Lowest % first",
            options: [
              { value: "percent_desc", label: "Highest % first" },
              { value: "name", label: "Name A–Z" },
            ],
          },
        ]}
      />

      <SectionHeader title="Attendance register" />
      {sessions.length === 0 ? (
        <p className="rounded-xl border border-border bg-card py-6 text-center text-sm text-muted-foreground shadow-sm">
          No sessions held yet — this will fill in once you open attendance sessions for this class.
        </p>
      ) : (
        <>
          <div className="mb-2 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Check className="h-3.5 w-3.5 text-green-600" /> Present
            </span>
            <span className="flex items-center gap-1">
              <Minus className="h-3.5 w-3.5 text-muted-foreground/60" /> Absent
            </span>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th
                      className="sticky left-0 z-10 bg-muted px-4 py-2.5 font-medium"
                      aria-sort={sort === "name" ? "ascending" : "none"}
                    >
                      Student
                    </th>
                    <th
                      className="px-4 py-2.5 text-center font-medium"
                      aria-sort={sort === "percent_desc" ? "descending" : sort === "name" ? "none" : "ascending"}
                    >
                      Attendance
                    </th>
                    {sessions.map((s) => {
                      const d = new Date(s.date);
                      return (
                        <th key={s.id} className="whitespace-nowrap px-2 py-2.5 text-center font-medium">
                          <Link href={`/reports/session/${s.id}`} className="hover:text-primary" title={d.toLocaleString()}>
                            <div>{d.toLocaleDateString(undefined, { weekday: "short" })}</div>
                            <div className="tabular-nums text-muted-foreground">{d.toLocaleDateString(undefined, { day: "2-digit", month: "short" })}</div>
                            <div className="tabular-nums">{d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>
                          </Link>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {view.map((r) => {
                    const rowBg = r.percent < THRESHOLD ? "bg-red-500/5 dark:bg-red-500/10" : "bg-card";
                    return (
                      <tr key={r.studentId} className={rowBg}>
                        <td className={`sticky left-0 z-10 px-4 py-2 ${rowBg}`}>
                          <div className="flex items-center gap-2.5">
                            <Avatar name={r.name} />
                            <div className="min-w-0">
                              <div className="truncate font-medium text-foreground">{r.name}</div>
                              <div className="truncate text-xs text-muted-foreground">{r.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Badge tone={r.percent >= THRESHOLD ? "green" : r.percent >= 60 ? "amber" : "red"}>
                              {r.percent}%
                            </Badge>
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {r.attended}/{r.total}
                            </span>
                          </div>
                        </td>
                        {sessions.map((s) => (
                          <td key={s.id} className="px-2 py-2 text-center">
                            {r.bySession[s.id] ? (
                              <Check className="mx-auto h-4 w-4 text-green-600" aria-label="Present" />
                            ) : (
                              <Minus className="mx-auto h-4 w-4 text-muted-foreground/60" aria-label="Absent" />
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                  {view.length === 0 && (
                    <tr>
                      <td colSpan={sessions.length + 2} className="px-4 py-6 text-center text-sm text-muted-foreground">
                        No students match.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
