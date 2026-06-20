import Link from "next/link";
import {
  Building2,
  Layers,
  BookOpen,
  Users,
  GraduationCap,
  UserCog,
  Link2,
  Upload,
  AlertTriangle,
  ArrowLeftRight,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, StatCard, PageHeader, Badge } from "@/app/_components/ui";
import { SectionHeader } from "@/app/_components/layout-ui";
import { QuickActions } from "@/app/_components/QuickActions";
import { DonutChart, Legend, SimpleBar, CHART_COLORS } from "@/app/_components/charts";
import { STREAM_LABEL } from "@/lib/streams";

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  const [counts, byDay, byStream, sections, deptCount, pendingSubs, subsNeedingApproval] = await Promise.all([
    prisma.user.groupBy({ by: ["role"], _count: true }),
    prisma.scheduledClass.groupBy({ by: ["day"], _count: true }),
    prisma.subject.groupBy({ by: ["stream"], _count: true }),
    prisma.classSection.findMany({
      include: { _count: { select: { offerings: true, enrollments: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.department.count(),
    prisma.substitutionRequest.count({ where: { status: "TEACHER_ACCEPTED" } }),
    prisma.substitutionRequest.findMany({
      where: { status: "TEACHER_ACCEPTED" },
      include: {
        scheduledClass: { include: { offering: { include: { subject: true, classSection: true } } } },
        requestedBy: true,
        substituteTeacher: true,
      },
      orderBy: { createdAt: "asc" },
      take: 5,
    }),
  ]);

  const countOf = (r: string) => counts.find((c) => c.role === r)?._count ?? 0;
  const subjectCount = byStream.reduce((a, s) => a + s._count, 0);

  const dayOrder = ["MON", "TUE", "WED", "THU", "FRI"];
  const dayLabels: Record<string, string> = { MON: "Mon", TUE: "Tue", WED: "Wed", THU: "Thu", FRI: "Fri" };
  const classesPerDay = dayOrder.map((d) => ({
    label: dayLabels[d],
    value: byDay.find((x) => x.day === d)?._count ?? 0,
  }));
  const subjectsByStream = byStream
    .map((s, i) => ({
      name: STREAM_LABEL[s.stream] ?? s.stream,
      value: s._count,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }))
    .filter((s) => s.value > 0);

  const noOffering = sections.filter((s) => s._count.offerings === 0);

  return (
    <div>
      <PageHeader title="Overview" subtitle="Department at a glance." />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={<Building2 className="h-4 w-4" />} label="Departments" value={deptCount} />
        <StatCard icon={<Layers className="h-4 w-4" />} label="Classes" value={sections.length} />
        <StatCard icon={<BookOpen className="h-4 w-4" />} label="Subjects" value={subjectCount} />
        <StatCard icon={<UserCog className="h-4 w-4" />} label="Teachers" value={countOf("TEACHER")} />
        <StatCard icon={<GraduationCap className="h-4 w-4" />} label="Students" value={countOf("STUDENT")} />
      </div>

      <SectionHeader title="Quick actions" />
      <QuickActions
        actions={[
          { href: "/admin/offerings", label: "Create offering", icon: <Link2 className="h-5 w-5" />, desc: "Subject → class → teacher" },
          { href: "/admin/import", label: "Import students", icon: <Upload className="h-5 w-5" />, desc: "Bulk CSV + enroll" },
          { href: "/admin/academics?tab=subjects", label: "Add subject", icon: <BookOpen className="h-5 w-5" />, desc: "New course" },
          { href: "/admin/people", label: "Add user", icon: <Users className="h-5 w-5" />, desc: "Teacher / admin" },
        ]}
      />

      <SectionHeader title="Activity" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Classes per day" className="mb-0 lg:col-span-2">
          <SimpleBar data={classesPerDay} />
        </Card>
        <Card title="Subjects by stream" className="mb-0">
          <DonutChart data={subjectsByStream} centerValue={String(subjectCount)} centerLabel="subjects" />
          <Legend data={subjectsByStream} />
        </Card>
      </div>

      <SectionHeader title="Needs attention" />

      {/* Substitutions awaiting approval */}
      {pendingSubs > 0 && (
        <Card className="mb-3 border-primary/30 bg-primary/5 dark:bg-primary/8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium text-foreground">
                {pendingSubs} substitution request{pendingSubs > 1 ? "s" : ""} awaiting your approval
              </p>
            </div>
            <Link
              href="/admin/substitutions"
              className="flex-shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary/90"
            >
              Review now
            </Link>
          </div>
          {subsNeedingApproval.length > 0 && (
            <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
              {subsNeedingApproval.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-foreground">
                    <span className="font-medium">{r.requestedBy.name}</span>
                    {" → "}
                    <span className="text-muted-foreground">{r.scheduledClass.offering?.subject.name}</span>
                    {" · "}
                    <span className="text-muted-foreground">sub: {r.substituteTeacher.name}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{new Date(r.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card className="mb-0">
        {noOffering.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">All sections have at least one offering. 🎉</p>
        ) : (
          <>
            <p className="mb-2 flex items-center gap-1.5 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              {noOffering.length} section{noOffering.length > 1 ? "s" : ""} with no offerings yet
            </p>
            <div className="flex flex-wrap gap-2">
              {noOffering.map((s) => (
                <Link key={s.id} href="/admin/offerings">
                  <Badge tone="amber">{s.name}</Badge>
                </Link>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
