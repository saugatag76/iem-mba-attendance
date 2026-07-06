import Link from "next/link";
import { ArrowLeft, Clock, CheckCircle2, XCircle, Ban, AlertTriangle } from "lucide-react";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Avatar, Badge } from "@/app/_components/ui";
import { cancelSubstitutionRequest, respondToSubstitutionRequest } from "./actions";
import type { SubstitutionStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<SubstitutionStatus, { tone: "gray" | "amber" | "green" | "red" | "brand"; label: string }> = {
  PENDING_TEACHER:  { tone: "amber", label: "Awaiting teacher" },
  TEACHER_ACCEPTED: { tone: "brand", label: "Awaiting admin" },
  TEACHER_DECLINED: { tone: "red",   label: "Declined" },
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

export default async function TeacherSubstitutionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const teacher = await requireRole("TEACHER", "ADMIN");
  const { tab = "sent" } = await searchParams;

  const [sent, received] = await Promise.all([
    prisma.substitutionRequest.findMany({
      where: { requestedById: teacher.id },
      include: {
        scheduledClass: { include: { offering: { include: { subject: true, classSection: true } } } },
        substituteTeacher: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.substitutionRequest.findMany({
      where: { substituteTeacherId: teacher.id },
      include: {
        scheduledClass: { include: { offering: { include: { subject: true, classSection: true } } } },
        requestedBy: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const pendingReceived = received.filter((r) => r.status === "PENDING_TEACHER").length;

  return (
    <div>
      <PageHeader
        title="Substitutions"
        subtitle="Track your substitution requests sent and received"
        action={
          <div className="flex items-center gap-2">
            <a
              href="/teacher/substitutions/leave"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
            >
              Plan leave
            </a>
            <a
              href="/teacher/substitutions/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
            >
              + Single class
            </a>
          </div>
        }
      />

      {/* Tabs */}
      <div className="mb-6 inline-flex rounded-xl border border-border bg-card p-1 shadow-sm">
        {[
          { key: "sent", label: `Sent (${sent.length})` },
          { key: "received", label: `Received${pendingReceived > 0 ? ` · ${pendingReceived} pending` : ` (${received.length})`}` },
        ].map((t) => (
          <Link
            key={t.key}
            href={`/teacher/substitutions?tab=${t.key}`}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
              tab === t.key
                ? "bg-primary text-white shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "sent" ? (
        <div className="space-y-3">
          {sent.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              You haven&apos;t sent any substitution requests yet.
            </p>
          ) : (
            sent.map((req) => {
              const { tone, label } = STATUS_BADGE[req.status];
              const canCancel = req.status === "PENDING_TEACHER" || req.status === "TEACHER_ACCEPTED";
              return (
                <div key={req.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground">
                          {req.scheduledClass.offering?.subject.name ?? "Unknown subject"}
                        </p>
                        <span className="font-mono text-[10px] text-muted-foreground/60">#{shortId(req.id)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {req.scheduledClass.offering?.classSection.name} · {req.scheduledClass.day} {req.scheduledClass.startTime}–{req.scheduledClass.endTime}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Date: <span className="font-medium text-foreground">{formatDate(req.date)}</span>
                      </p>
                    </div>
                    <Badge tone={tone as "gray" | "green" | "red" | "amber" | "brand"}>{label}</Badge>
                  </div>

                  <div className="mt-3 space-y-1 text-sm">
                    <p><span className="text-muted-foreground">Substitute:</span> <span className="font-medium text-foreground">{req.substituteTeacher.name}</span></p>
                    <p><span className="text-muted-foreground">Reason:</span> {req.reason}</p>
                    {req.teacherNote && <p><span className="text-muted-foreground">Teacher note:</span> {req.teacherNote}</p>}
                  </div>

                  {canCancel && (
                    <form action={cancelSubstitutionRequest} className="mt-3">
                      <input type="hidden" name="id" value={req.id} />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/25 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-500/10 dark:text-red-400"
                      >
                        <Ban className="h-3.5 w-3.5" /> Cancel request
                      </button>
                    </form>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {received.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              No substitution requests have been sent to you.
            </p>
          ) : (
            received.map((req) => {
              const { tone, label } = STATUS_BADGE[req.status];
              const isPending = req.status === "PENDING_TEACHER";
              return (
                <div key={req.id} className={`rounded-xl border bg-card p-4 shadow-sm ${isPending ? "border-primary/40" : "border-border"}`}>
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground">
                          {req.scheduledClass.offering?.subject.name ?? "Unknown subject"}
                        </p>
                        <span className="font-mono text-[10px] text-muted-foreground/60">#{shortId(req.id)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {req.scheduledClass.offering?.classSection.name} · {req.scheduledClass.day} {req.scheduledClass.startTime}–{req.scheduledClass.endTime}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Date: <span className="font-medium text-foreground">{formatDate(req.date)}</span>
                      </p>
                    </div>
                    <Badge tone={tone as "gray" | "green" | "red" | "amber" | "brand"}>{label}</Badge>
                  </div>

                  <div className="mt-3 space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Requested by:</span>
                      <Avatar name={req.requestedBy.name} className="h-5 w-5 text-[9px]" />
                      <span className="font-medium text-foreground">{req.requestedBy.name}</span>
                    </div>
                    <p><span className="text-muted-foreground">Reason:</span> {req.reason}</p>
                  </div>

                  {isPending && (
                    <div className="mt-4 space-y-3">
                      <div>
                        <label htmlFor={`note-${req.id}`} className="mb-1 block text-xs font-medium text-muted-foreground">
                          Optional note (visible to admin and requester)
                        </label>
                        <textarea
                          id={`note-${req.id}`}
                          form={`accept-${req.id}`}
                          name="teacherNote"
                          rows={2}
                          placeholder="Add a note if needed…"
                          className="w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                        />
                      </div>
                      <div className="flex gap-2">
                        {/* Accept — dedicated form with hidden response=accept */}
                        <form id={`accept-${req.id}`} action={respondToSubstitutionRequest}>
                          <input type="hidden" name="id" value={req.id} />
                          <input type="hidden" name="response" value="accept" />
                          <button
                            type="submit"
                            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-primary/90"
                          >
                            <CheckCircle2 className="h-4 w-4" /> Accept
                          </button>
                        </form>
                        {/* Decline — separate form with hidden response=decline */}
                        <form action={respondToSubstitutionRequest}>
                          <input type="hidden" name="id" value={req.id} />
                          <input type="hidden" name="response" value="decline" />
                          <button
                            type="submit"
                            className="flex items-center gap-1.5 rounded-lg border border-red-500/25 px-4 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-500/10 dark:text-red-400"
                          >
                            <XCircle className="h-4 w-4" /> Decline
                          </button>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
