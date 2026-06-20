import { CheckCircle2, XCircle } from "lucide-react";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Avatar, Badge } from "@/app/_components/ui";
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

  const requests = await prisma.substitutionRequest.findMany({
    where: { status: { in: statusFilter } },
    include: {
      scheduledClass: { include: { offering: { include: { subject: true, classSection: true } } } },
      requestedBy: true,
      substituteTeacher: true,
      approvedBy: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const pendingCount = await prisma.substitutionRequest.count({ where: { status: "TEACHER_ACCEPTED" } });

  return (
    <div>
      <PageHeader
        title="Substitution requests"
        subtitle={`${pendingCount} request${pendingCount === 1 ? "" : "s"} awaiting your approval`}
      />

      {/* Filter tabs */}
      <div className="mb-6 inline-flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1 shadow-sm">
        {[
          { key: "pending", label: `Needs approval (${pendingCount})` },
          { key: "history", label: "History" },
          { key: "all", label: "All" },
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
                className={`rounded-xl border bg-card p-5 shadow-sm ${needsAction ? "border-primary/40 ring-1 ring-primary/20" : "border-border"}`}
              >
                {/* Header row */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-foreground">
                      {req.scheduledClass.offering?.subject.name ?? "Unknown subject"}
                    </p>
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
                      <p className="text-xs text-muted-foreground">{req.requestedBy.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 px-3 py-2">
                    <Avatar name={req.substituteTeacher.name} />
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Proposed substitute</p>
                      <p className="text-sm font-medium text-foreground">{req.substituteTeacher.name}</p>
                      <p className="text-xs text-muted-foreground">{req.substituteTeacher.email}</p>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="mt-3 space-y-1 text-sm">
                  <p><span className="text-muted-foreground">Reason:</span> {req.reason}</p>
                  {req.teacherNote && (
                    <p><span className="text-muted-foreground">Substitute&apos;s note:</span> {req.teacherNote}</p>
                  )}
                  {req.adminNote && (
                    <p><span className="text-muted-foreground">Admin note:</span> {req.adminNote}</p>
                  )}
                  {req.approvedBy && (
                    <p className="text-xs text-muted-foreground">
                      Decided by {req.approvedBy.name} · {req.updatedAt.toLocaleDateString()}
                    </p>
                  )}
                </div>

                {/* Approve / Reject */}
                {needsAction && (
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <form action={approveSubstitution}>
                      <input type="hidden" name="id" value={req.id} />
                      <div className="flex flex-col gap-2">
                        <textarea
                          name="adminNote"
                          rows={2}
                          placeholder="Optional approval note…"
                          className="w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                        />
                        <button
                          type="submit"
                          className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
                        >
                          <CheckCircle2 className="h-4 w-4" /> Approve substitution
                        </button>
                      </div>
                    </form>
                    <form action={rejectSubstitution}>
                      <input type="hidden" name="id" value={req.id} />
                      <div className="flex flex-col gap-2">
                        <textarea
                          name="adminNote"
                          rows={2}
                          placeholder="Optional rejection reason…"
                          className="w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                        />
                        <button
                          type="submit"
                          className="flex items-center justify-center gap-1.5 rounded-lg border border-red-500/25 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-500/10 dark:text-red-400"
                        >
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
