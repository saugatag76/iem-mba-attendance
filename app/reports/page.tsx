import Link from "next/link";
import { TrendingUp, BookOpen, AlertTriangle, ChevronRight } from "lucide-react";
import { requireRole } from "@/lib/session";
import { reportsOverview } from "@/lib/attendance";
import { parseDateRange, rangeQuery } from "@/lib/dateRange";
import { PageHeader, EmptyState, StatCard, Badge } from "@/app/_components/ui";
import { SectionHeader, RouteTabs } from "@/app/_components/layout-ui";
import { FilterBar } from "@/app/_components/FilterBar";
import { TrendLineChart } from "@/app/_components/charts";
import { DateRangePicker } from "@/app/_components/DateRangePicker";

export const dynamic = "force-dynamic";

export default async function ReportsOverview({
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

  const { summaries, trend } = await reportsOverview(isAdmin ? {} : { teacherId: user.id }, range);

  const active = summaries.filter((s) => s.totalSessions > 0 && s.totalStudents > 0);
  const overallAvg = active.length > 0 ? Math.round(active.reduce((a, s) => a + s.avgPercent, 0) / active.length) : 0;
  const totalDefaulters = summaries.reduce((a, s) => a + s.defaulters, 0);

  const trendData = trend.map((t) => ({
    label: new Date(t.date).toLocaleDateString(undefined, { day: "2-digit", month: "short" }),
    value: t.percent,
  }));

  const notStarted = summaries.filter((s) => s.totalSessions === 0);
  let ranked = active.sort((a, b) => a.avgPercent - b.avgPercent);
  if (needle) {
    ranked = ranked.filter((s) =>
      `${s.subjectCode} ${s.subjectName} ${s.className} ${s.teacherName}`.toLowerCase().includes(needle),
    );
  }

  return (
    <div>
      <PageHeader
        title="Attendance reports"
        subtitle={isAdmin ? "Macro view across every subject and section" : "Macro view across your classes"}
        action={<DateRangePicker />}
      />

      <RouteTabs
        active={`/reports${qs}`}
        tabs={[
          { label: "Overview", href: `/reports${qs}` },
          { label: "By subject", href: `/reports/offerings${qs}` },
          { label: "By student", href: `/reports/students${qs}` },
        ]}
      />

      {summaries.length === 0 ? (
        <EmptyState icon={<BookOpen className="h-8 w-8" />} title="Nothing to report yet" />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-3 gap-3">
            <StatCard icon={<BookOpen className="h-4 w-4" />} label="Subjects" value={summaries.length} href={`/reports/offerings${qs}`} />
            <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Avg attendance" value={`${overallAvg}%`} />
            <StatCard
              icon={<AlertTriangle className="h-4 w-4" />}
              label="Below 75%"
              value={totalDefaulters}
              hint="student–subject combos"
              href={totalDefaulters > 0 ? `/reports/defaulters${qs}` : undefined}
            />
          </div>

          <SectionHeader title="Attendance trend" />
          {trendData.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white py-6 text-center text-sm text-slate-400 shadow-sm">
              No sessions held yet — the trend will fill in once attendance is taken.
            </p>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <TrendLineChart data={trendData} />
            </div>
          )}

          <SectionHeader title="Per-subject health" action={<span className="text-xs text-slate-400">Lowest attendance first</span>} />
          <FilterBar placeholder="Search subject, section or teacher…" />
          {active.length === 0 ? (
            <EmptyState icon={<BookOpen className="h-8 w-8" />} title="No sessions held yet" hint="Per-subject health will appear once attendance is taken." />
          ) : ranked.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No subjects match your search.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Subject</th>
                    {isAdmin && <th className="px-4 py-2.5 font-medium">Teacher</th>}
                    <th className="px-4 py-2.5 text-center font-medium">Sessions</th>
                    <th className="px-4 py-2.5 text-center font-medium">
                      <span className="flex items-center justify-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" /> Below 75%
                      </span>
                    </th>
                    <th className="px-4 py-2.5 text-right font-medium">Avg attendance</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ranked.map((s) => (
                    <tr key={s.offeringId} className={s.avgPercent < 75 ? "bg-red-50/40" : undefined}>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-slate-800">
                          <span className="font-mono text-xs text-slate-500">{s.subjectCode}</span> {s.subjectName}
                        </p>
                        <p className="text-xs text-slate-400">{s.className}</p>
                      </td>
                      {isAdmin && <td className="px-4 py-2.5 text-slate-600">{s.teacherName}</td>}
                      <td className="px-4 py-2.5 text-center tabular-nums text-slate-600">{s.totalSessions}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums text-slate-600">{s.defaulters}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Badge tone={s.avgPercent >= 75 ? "green" : s.avgPercent >= 60 ? "amber" : "red"}>
                          {s.avgPercent}%
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Link href={`/reports/offering/${s.offeringId}${qs}`} className="text-slate-300 hover:text-brand-700">
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {notStarted.length > 0 && (
            <p className="mt-3 text-center text-xs text-slate-400">
              {notStarted.length} more subject{notStarted.length > 1 ? "s" : ""} with no sessions yet —{" "}
              <Link href={`/reports/offerings${qs}`} className="font-medium text-brand-700 hover:underline">
                view all subjects
              </Link>
            </p>
          )}
        </>
      )}
    </div>
  );
}
