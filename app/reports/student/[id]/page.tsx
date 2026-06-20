import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AlertTriangle, BookOpen, Check, Minus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { studentSubjectStats, studentDayWiseReport } from "@/lib/attendance";
import type { SubjectStat } from "@/lib/attendance";
import { parseDateRange, rangeQuery } from "@/lib/dateRange";
import { PageHeader, Card, Badge, ProgressRing, EmptyState } from "@/app/_components/ui";
import { SectionHeader } from "@/app/_components/layout-ui";
import { DonutChart, Legend } from "@/app/_components/charts";
import { DateRangePicker } from "@/app/_components/DateRangePicker";

export const dynamic = "force-dynamic";

export default async function StudentReport({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await requireRole("TEACHER", "ADMIN");
  const isAdmin = user.role === "ADMIN";
  const { id } = await params;
  const rangeParams = await searchParams;
  const range = parseDateRange(rangeParams);
  const qs = rangeQuery(rangeParams);

  const student = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!student || student.role !== "STUDENT") notFound();

  if (!isAdmin) {
    const allowed = await prisma.enrollment.findFirst({
      where: { studentId: id, classSection: { offerings: { some: { teacherId: user.id } } } },
    });
    if (!allowed) notFound();
  }

  const [stats, dayWise] = await Promise.all([
    studentSubjectStats(id, isAdmin ? undefined : user.id, range),
    studentDayWiseReport(id, isAdmin ? undefined : user.id, range),
  ]);

  const overall = stats.length > 0 ? Math.round(stats.reduce((a, s) => a + s.percent, 0) / stats.length) : 0;
  const attended = stats.reduce((a, s) => a + s.attended, 0);
  const totalClasses = stats.reduce((a, s) => a + s.totalSessions, 0);
  const attendanceDonut = [
    { name: "Present", value: attended, color: "#f97316" },
    { name: "Missed", value: Math.max(0, totalClasses - attended), color: "#f43f5e" },
  ];
  const sortedStats = [...stats].sort((a, b) => a.percent - b.percent);
  const below75 = sortedStats.filter((s) => s.percent < 75);

  return (
    <div>
      <Link href={`/reports/students${qs}`} className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> Back to students
      </Link>
      <PageHeader title={student.name} subtitle={student.email} action={<DateRangePicker />} />

      {stats.length === 0 ? (
        <EmptyState icon={<BookOpen className="h-8 w-8" />} title="No subjects to report" />
      ) : (
        <>
          <Card title="Attendance overview" className="mb-5">
            <div className="grid gap-4 sm:grid-cols-2 sm:items-center">
              <div>
                <DonutChart data={attendanceDonut} centerValue={`${overall}%`} centerLabel="overall" />
                <Legend data={attendanceDonut} />
              </div>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-1">
                <Stat label="Subjects" value={stats.length} />
                <Stat label="Sessions held" value={totalClasses} />
                <Stat label="Classes attended" value={attended} />
              </div>
            </div>
          </Card>

          <Card
            title="Subjects"
            icon={<BookOpen className="h-4 w-4" />}
            action={<Badge tone={overall >= 75 ? "green" : overall >= 60 ? "amber" : "red"}>{overall}% overall</Badge>}
          >
            {below75.length > 0 && (
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2 text-sm text-red-600 dark:border-red-500/25 dark:bg-red-500/12 dark:text-red-400">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                {below75.length} subject{below75.length > 1 ? "s" : ""} below 75% — shown first.
              </div>
            )}
            <ul className="divide-y divide-border">
              {sortedStats.map((s) => (
                <SubjectRow key={s.offeringId} s={s} />
              ))}
            </ul>
          </Card>

          {dayWise.length > 0 && (
            <>
              <SectionHeader title="Day-by-day" action={
                <span className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Check className="h-3.5 w-3.5 text-green-600" /> Present</span>
                  <span className="flex items-center gap-1"><Minus className="h-3.5 w-3.5 text-muted-foreground/60" /> Absent</span>
                </span>
              } />
              <div className="space-y-3">
                {dayWise.map((d) => (
                  <div key={d.offeringId} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
                      <p className="truncate text-sm font-medium text-foreground">
                        <span className="font-mono text-xs text-muted-foreground">{d.subjectCode}</span> {d.subjectName}
                      </p>
                      <Badge tone={d.percent >= 75 ? "green" : d.percent >= 60 ? "amber" : "red"}>
                        {d.percent}% · {d.attended}/{d.total}
                      </Badge>
                    </div>
                    <div className="overflow-x-auto p-3">
                      <div className="flex gap-2">
                        {d.sessions.map((s) => {
                          const date = new Date(s.date);
                          const present = d.bySession[s.id];
                          return (
                            <Link
                              key={s.id}
                              href={`/reports/session/${s.id}`}
                              className={`flex min-w-[58px] flex-col items-center gap-1 rounded-lg border px-2 py-1.5 text-center transition hover:border-primary/40 ${
                                present ? "border-emerald-500/20 bg-emerald-500/8 dark:border-emerald-500/25 dark:bg-emerald-500/12" : "border-border bg-muted"
                              }`}
                              title={date.toLocaleString()}
                            >
                              <span className="text-[10px] uppercase text-muted-foreground">
                                {date.toLocaleDateString(undefined, { weekday: "short" })}
                              </span>
                              <span className="text-xs font-medium tabular-nums text-foreground">
                                {date.toLocaleDateString(undefined, { day: "2-digit", month: "short" })}
                              </span>
                              {present ? (
                                <Check className="h-4 w-4 text-green-600" aria-label="Present" />
                              ) : (
                                <Minus className="h-4 w-4 text-muted-foreground/60" aria-label="Absent" />
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted px-3 py-2.5 text-center sm:text-left">
      <p className="text-xl font-bold tabular-nums text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function SubjectRow({ s }: { s: SubjectStat }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <ProgressRing percent={s.percent} size={48} />
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">{s.subjectName}</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {s.subjectCode} · {s.attended}/{s.totalSessions} classes attended
        </p>
      </div>
    </li>
  );
}
