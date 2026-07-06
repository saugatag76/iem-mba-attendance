import { CheckCircle2, XCircle, ArrowLeftRight, Clock, TrendingUp, Download, CalendarClock, CalendarRange } from "lucide-react";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Avatar, Badge, StatCard } from "@/app/_components/ui";
import { SectionHeader } from "@/app/_components/layout-ui";
import { approveSubstitution, rejectSubstitution } from "./actions";
import type { SubstitutionStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<SubstitutionStatus, { tone: "gray" | "amber" | "green" | "red" | "brand"; label: string }> = {
  PENDING_TEACHER:  { tone: "amber", label: "Awaiting teacher" },
  TEACHER_ACCEPTED: { tone: "brand", label: "Awaiting admin" },
  TEACHER_DECLINED: { tone: "red",   label: "Teacher declined" },
  APPROVED:         { tone: "green", label: "Approved" },
  REJECTED:         { tone: "red",   label: "Rejected" },
  CANCELLED:        { tone: "gray",  label: "Cancelled" },
};

function formatDate(d: Date) {
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}

function shortId(id: string) {
  return id.slice(-6).toUpperCase();
}

export default async function AdminSubstitutionsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  await requireRole("ADMIN");
  const { filter = "pending" } = await searchParams;

  const statusFilter: SubstitutionStatus[] =
    filter === "all"
      ? ["PENDING_TEACHER", "TEACHER_ACCEPTED", "TEACHER_DECLINED", "APPROVED", "REJECTED", "CANCELLED"]
      : filter === "history"
      ? ["APPROVED", "REJECTED", "CANCELLED", "TEACHER_DECLINED"]
      : ["TEACHER_ACCEPTED"];

  // Today / this week (Mon–Fri) ranges in IST calendar terms — same convention
  // used for SubstitutionRequest.date across the app.
  const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const todayStart = new Date(nowIST.getFullYear(), nowIST.getMonth(), nowIST.getDate());
  const todayEnd = new Date(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate() + 1);
  const dow = nowIST.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const weekStart = new Date(nowIST.getFullYear(), nowIST.getMonth(), nowIST.getDate() + mondayOffset);
  const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6);

  const [requests, stats, topRequesters, topSubstitutes, todaySubCount, weekSubCount] = await Promise.all([
    prisma.substitutionRequest.findMany({
      where: { status: { in: statusFilter } },
      include: {
        scheduledClass: { include: { offering: { include: { subject: true, classSection: true } } } },
        requestedBy: true,
        substituteTeacher: true,
        approvedBy: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    // Counts per status
    prisma.substitutionRequest.groupBy({
      by: ["status"],
      _count: true,
    }),
    // Top 3 teachers who requested substitutions most
    prisma.substitutionRequest.groupBy({
      by: ["requestedById"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 3,
    }),
    // Top 3 teachers who substituted most
    prisma.substitutionRequest.groupBy({
      by: ["substituteTeacherId"],
      where: { status: "APPROVED" },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 3,
    }),
    prisma.substitutionRequest.count({
      where: { status: "APPROVED", date: { gte: todayStart, lt: todayEnd } },
    }),
    prisma.substitutionRequest.count({
      where: { status: "APPROVED", date: { gte: weekStart, lt: weekEnd } },
    }),
  ]);

  // Resolve top teacher names
  const topRequesterIds = topRequesters.map((r) => r.requestedById);
  const topSubstituteIds = topSubstitutes.map((r) => r.substituteTeacherId);
  const allTopIds = [...new Set([...topRequesterIds, ...topSubstituteIds])];
  const topTeachers = allTopIds.length
    ? await prisma.user.findMany({ where: { id: { in: allTopIds } }, select: { id: true, name: true } })
    : [];
  const nameOf = (id: string) => topTeachers.find((t) => t.id === id)?.name ?? id;

  const countOf = (s: SubstitutionStatus) => stats.find((x) => x.status === s)?._count ?? 0;
  const pendingCount = countOf("TEACHER_ACCEPTED");
  const approvedCount = countOf("APPROVED");
  const totalCount = stats.reduce((a, s) => a + s._count, 0);

  return (
    <div>
      <PageHeader
        title="Substitution requests"
        subtitle="Track, approve and audit all teacher substitution requests"
        action={
          <a
            href={`/api/admin/substitutions/csv?filter=${filter}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
          >
            <Download className="h-4 w-4" /> Export CSV
          </a>
        }
      />

      {/* Stats */}
      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<ArrowLeftRight className="h-4 w-4" />} label="Total requests" value={totalCount} />
        <StatCard icon={<Clock className="h-4 w-4" />} label="Awaiting approval" value={pendingCount}
          href={pendingCount > 0 ? "/admin/substitutions?filter=pending" : undefined} />
        <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Approved" value={approvedCount} />
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Declined / Rejected"
          value={countOf("TEACHER_DECLINED") + countOf("REJECTED")} />
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3">
        <StatCard icon={<CalendarClock className="h-4 w-4" />} label="Today's substitute classes" value={todaySubCount} hint="approved" />
        <StatCard icon={<CalendarRange className="h-4 w-4" />} label="This week's substitute classes" value={weekSubCount} hint="approved" />
      </div>

      {/* Top teachers */}
      {(topRequesters.length > 0 || topSubstitutes.length > 0) && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          {topRequesters.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Most requests sent</p>
              <ul className="space-y-2">
                {topRequesters.map((r) => (
                  <li key={r.requestedById} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Avatar name={nameOf(r.requestedById)} />
                      <span className="text-sm font-medium text-foreground">{nameOf(r.requestedById)}</span>
                    </div>
                    <Badge tone="amber">{r._count.id} request{r._count.id > 1 ? "s" : ""}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {topSubstitutes.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Most classes covered</p>
              <ul className="space-y-2">
                {topSubstitutes.map((r) => (
                  <li key={r.substituteTeacherId} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Avatar name={nameOf(r.substituteTeacherId)} />
                      <span className="text-sm font-medium text-foreground">{nameOf(r.substituteTeacherId)}</span>
                    </div>
                    <Badge tone="green">{r._count.id} class{r._count.id > 1 ? "es" : ""}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <SectionHeader title="Requests" />

      {/* Filter tabs */}
      <div className="mb-5 inline-flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1 shadow-sm">
        {[
          { key: "pending", label: `Needs approval${pendingCount > 0 ? ` (${pendingCount})` : ""}` },
          { key: "history", label: "History" },
          { key: "all",     label: "All" },
        ].map((t) => (
          <a
            key={t.key}
            href={`/admin/substitutions?filter=${t.key}`}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
              filter === t.key
                ? "bg-primary text-white shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            {t.label}
          </a>
        ))}
      </div>

      <div className="space-y-4">
        {requests.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            No requests found for this filter.
          </p>
        ) : (
          requests.map((req) => {
            const { tone, label } = STATUS_BADGE[req.status];
            const needsAction = req.status === "TEACHER_ACCEPTED";
            return (
              <div
                key={req.id}
                className={`rounded-xl border bg-card p-5 shadow-sm ${
                  needsAction ? "border-primary/40 ring-1 ring-primary/20" : "border-border"
                }`}
              >
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-base font-semibold text-foreground">
                        {req.scheduledClass.offering?.subject.name ?? "Unknown subject"}
                      </p>
                      <span className="font-mono text-[10px] text-muted-foreground/60">#{shortId(req.id)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {req.scheduledClass.offering?.classSection.name} · {req.scheduledClass.day}{" "}
                      {req.scheduledClass.startTime}–{req.scheduledClass.endTime} · {formatDate(req.date)}
                    </p>
                  </div>
                  <Badge tone={tone}>{label}</Badge>
                </div>

                {/* Participants */}
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 px-3 py-2">
                    <Avatar name={req.requestedBy.name} />
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Requesting teacher</p>
                      <p className="text-sm font-medium text-foreground">{req.requestedBy.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 px-3 py-2">
                    <Avatar name={req.substituteTeacher.name} />
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Proposed substitute</p>
                      <p className="text-sm font-medium text-foreground">{req.substituteTeacher.name}</p>
                    </div>
                  </div>
                </div>

                {/* Timeline / notes */}
                <div className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
                  <p><span className="text-muted-foreground">Reason:</span> {req.reason}</p>
                  {req.teacherNote && (
                    <p><span className="text-muted-foreground">Substitute&apos;s note:</span> {req.teacherNote}</p>
                  )}
                  {req.adminNote && (
                    <p><span className="text-muted-foreground">Admin note:</span> {req.adminNote}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Requested {formatDate(req.createdAt)}
                    {req.approvedBy && ` · Decided by ${req.approvedBy.name} on ${formatDate(req.updatedAt)}`}
                  </p>
                </div>

                {/* Approve / Reject actions */}
                {needsAction && (
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <form action={approveSubstitution}>
                      <input type="hidden" name="id" value={req.id} />
                      <div className="flex flex-col gap-2">
                        <textarea name="adminNote" rows={2} placeholder="Optional approval note…"
                          className="w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30" />
                        <button type="submit"
                          className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90">
                          <CheckCircle2 className="h-4 w-4" /> Approve substitution
                        </button>
                      </div>
                    </form>
                    <form action={rejectSubstitution}>
                      <input type="hidden" name="id" value={req.id} />
                      <div className="flex flex-col gap-2">
                        <textarea name="adminNote" rows={2} placeholder="Optional rejection reason…"
                          className="w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30" />
                        <button type="submit"
                          className="flex items-center justify-center gap-1.5 rounded-lg border border-red-500/25 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-500/10 dark:text-red-400">
                          <XCircle className="h-4 w-4" /> Reject
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
