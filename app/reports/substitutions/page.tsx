import { Download, ArrowLeftRight, CalendarClock, CalendarDays, CalendarRange } from "lucide-react";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { parseDateRange, rangeQuery } from "@/lib/dateRange";
import { fetchSubstitutionReportRows, ADMIN_APPROVAL_LABEL, REPORT_STATUSES, fmtReportDate, type ClassStatus } from "@/lib/substitutionReport";
import { PageHeader, StatCard, Badge, EmptyState } from "@/app/_components/ui";
import { RouteTabs } from "@/app/_components/layout-ui";
import { FilterBar } from "@/app/_components/FilterBar";
import { DateRangePicker } from "@/app/_components/DateRangePicker";
import { GlobalExportButton } from "@/app/_components/GlobalExportButton";
import { PrintButton } from "@/app/_components/PrintButton";

export const dynamic = "force-dynamic";

export default async function SubstitutionReportPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; from?: string; to?: string; term?: string; teacherId?: string; sort?: string }>;
}) {
  const user = await requireRole("TEACHER", "ADMIN");
  const isAdmin = user.role === "ADMIN";
  const { q = "", term = "", teacherId = "", sort = "date_desc", ...rangeParams } = await searchParams;
  const range = parseDateRange(rangeParams);
  const qs = rangeQuery(rangeParams);

  const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const todayStart = new Date(nowIST.getFullYear(), nowIST.getMonth(), nowIST.getDate());
  const todayEnd = new Date(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate() + 1);
  const dow = nowIST.getDay();
  const weekStart = new Date(nowIST.getFullYear(), nowIST.getMonth(), nowIST.getDate() + (dow === 0 ? -6 : 1 - dow));
  const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7);
  const monthStart = new Date(nowIST.getFullYear(), nowIST.getMonth(), 1);
  const monthEnd = new Date(nowIST.getFullYear(), nowIST.getMonth() + 1, 1);

  const scopeWhere = isAdmin && teacherId ? { substituteTeacherId: teacherId } : isAdmin ? {} : { substituteTeacherId: user.id };

  const [filtered, admins, summaryTotal, summaryMonth, summaryWeek, summaryToday] = await Promise.all([
    fetchSubstitutionReportRows({ userId: user.id, isAdmin, q, from: range?.from, to: range?.to, term, teacherId, sort }),
    isAdmin
      ? prisma.user.findMany({
          where: { role: "TEACHER", substitutionRequestsAssigned: { some: { status: { in: REPORT_STATUSES } } } },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    prisma.substitutionRequest.count({ where: { ...scopeWhere, status: { in: REPORT_STATUSES } } }),
    prisma.substitutionRequest.count({ where: { ...scopeWhere, status: { in: REPORT_STATUSES }, date: { gte: monthStart, lt: monthEnd } } }),
    prisma.substitutionRequest.count({ where: { ...scopeWhere, status: { in: REPORT_STATUSES }, date: { gte: weekStart, lt: weekEnd } } }),
    prisma.substitutionRequest.count({ where: { ...scopeWhere, status: { in: REPORT_STATUSES }, date: { gte: todayStart, lt: todayEnd } } }),
  ]);

  // Distinct semesters across this scope (unfiltered by term, so the option list is stable).
  const allForTerms = await fetchSubstitutionReportRows({ userId: user.id, isAdmin, teacherId });
  const terms = [...new Set(allForTerms.map((r) => r.scheduledClass.offering?.term).filter((t): t is string => !!t))].sort();

  const CLASS_STATUS_TONE: Record<ClassStatus, "amber" | "green" | "gray"> = {
    Upcoming: "amber",
    Completed: "green",
    Cancelled: "gray",
  };

  const exportQs = new URLSearchParams();
  if (q) exportQs.set("q", q);
  if (rangeParams.from) exportQs.set("from", rangeParams.from);
  if (rangeParams.to) exportQs.set("to", rangeParams.to);
  if (term) exportQs.set("term", term);
  if (isAdmin && teacherId) exportQs.set("teacherId", teacherId);
  if (sort) exportQs.set("sort", sort);
  const exportQsString = exportQs.toString();

  return (
    <div>
      <PageHeader
        title="Substitution report"
        subtitle={isAdmin ? "Every substitute class taken, across all faculty" : "Every substitute class you've taken — a permanent record"}
        action={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <DateRangePicker />
            <GlobalExportButton qs={qs} />
          </div>
        }
      />

      <RouteTabs
        active={`/reports/substitutions${qs}`}
        tabs={[
          { label: "Overview", href: `/reports${qs}` },
          { label: "By subject", href: `/reports/offerings${qs}` },
          { label: "By student", href: `/reports/students${qs}` },
          { label: "Substitutions", href: `/reports/substitutions${qs}` },
        ]}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<ArrowLeftRight className="h-4 w-4" />} label="Total classes" value={summaryTotal} />
        <StatCard icon={<CalendarRange className="h-4 w-4" />} label="This month" value={summaryMonth} />
        <StatCard icon={<CalendarDays className="h-4 w-4" />} label="This week" value={summaryWeek} />
        <StatCard icon={<CalendarClock className="h-4 w-4" />} label="Today" value={summaryToday} />
      </div>

      <div className="print:hidden">
        <FilterBar
          placeholder="Search by subject, section, semester or original teacher…"
          filters={[
            { name: "term", label: "Semester", options: terms.map((t) => ({ value: t, label: t })) },
            ...(isAdmin
              ? [{ name: "teacherId", label: "Teacher", options: admins.map((a) => ({ value: a.id, label: a.name })) }]
              : []),
            {
              name: "sort",
              label: "Sort",
              defaultLabel: "Sort: Date (latest first)",
              options: [
                { value: "date_desc", label: "Date — latest first" },
                { value: "date_asc", label: "Date — oldest first" },
                { value: "subject_asc", label: "Subject — A to Z" },
                { value: "section_asc", label: "Section — A to Z" },
                { value: "semester_asc", label: "Semester — A to Z" },
              ],
            },
          ]}
        />
      </div>

      <div className="mb-4 flex items-center justify-between print:hidden">
        <p className="text-xs text-muted-foreground">{filtered.length} record{filtered.length === 1 ? "" : "s"}</p>
        <div className="flex items-center gap-2">
          <a
            href={`/api/reports/substitutions/csv${exportQsString ? `?${exportQsString}` : ""}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
          >
            <Download className="h-4 w-4" /> CSV
          </a>
          <a
            href={`/api/reports/substitutions/xlsx${exportQsString ? `?${exportQsString}` : ""}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
          >
            <Download className="h-4 w-4" /> Excel
          </a>
          <PrintButton />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<ArrowLeftRight className="h-8 w-8" />} title="No substitution classes found" hint="Approved substitutions you've accepted will automatically appear here." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Day</th>
                <th className="px-4 py-2.5 font-medium">Time</th>
                <th className="px-4 py-2.5 font-medium">Subject</th>
                <th className="px-4 py-2.5 font-medium">Semester</th>
                <th className="px-4 py-2.5 font-medium">Section</th>
                <th className="px-4 py-2.5 font-medium">Original teacher</th>
                {isAdmin && <th className="px-4 py-2.5 font-medium">Substitute teacher</th>}
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Admin approval</th>
                <th className="px-4 py-2.5 font-medium">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-4 py-2.5 text-foreground">{fmtReportDate(r.date)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.scheduledClass.day}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-muted-foreground">
                    {r.scheduledClass.startTime}–{r.scheduledClass.endTime}
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-foreground">{r.scheduledClass.offering?.subject.name ?? "Unknown"}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">{r.scheduledClass.offering?.subject.code}</p>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.scheduledClass.offering?.term ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.scheduledClass.offering?.classSection.name ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.requestedBy.name}</td>
                  {isAdmin && <td className="px-4 py-2.5 text-muted-foreground">{r.substituteTeacher.name}</td>}
                  <td className="px-4 py-2.5"><Badge tone={CLASS_STATUS_TONE[r.classStatus]}>{r.classStatus}</Badge></td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{ADMIN_APPROVAL_LABEL[r.status]}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.adminNote || r.teacherNote || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
