import Link from "next/link";
import { Plus, Calendar, MapPin, Users2, CheckCircle2, XCircle } from "lucide-react";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Badge, Avatar } from "@/app/_components/ui";
import { approveEvent, rejectEvent } from "./actions";
import type { EventStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<EventStatus, { tone: "gray"|"amber"|"green"|"red"|"brand"; label: string }> = {
  PENDING_APPROVAL: { tone: "amber",  label: "Pending approval" },
  APPROVED:         { tone: "brand",  label: "Approved" },
  REJECTED:         { tone: "red",    label: "Rejected" },
  OPEN:             { tone: "green",  label: "Open" },
  CLOSED:           { tone: "gray",   label: "Closed" },
  CANCELLED:        { tone: "gray",   label: "Cancelled" },
};

function targetLabel(sections: { classSection: { name: string } }[]): string {
  if (sections.length === 0) return "All students";
  if (sections.length <= 3) return sections.map((s) => s.classSection.name).join(", ");
  return `${sections.slice(0, 2).map((s) => s.classSection.name).join(", ")} +${sections.length - 2} more`;
}

export default async function EventsPage() {
  const user = await requireRole("TEACHER", "ADMIN");
  const isAdmin = user.role === "ADMIN";

  const events = await prisma.event.findMany({
    where: isAdmin ? {} : { createdById: user.id },
    include: {
      createdBy: true,
      targetSections: { include: { classSection: true } },
      _count: { select: { attendances: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const pending = events.filter((e) => e.status === "PENDING_APPROVAL");

  return (
    <div>
      <PageHeader
        title="Events"
        subtitle={isAdmin ? "Manage all events and approve teacher requests" : "Events you've created"}
        action={
          <Link
            href="/events/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New event
          </Link>
        }
      />

      {/* Pending approvals — admin only */}
      {isAdmin && pending.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="mb-3 text-sm font-semibold text-amber-700 dark:text-amber-400">
            {pending.length} event{pending.length > 1 ? "s" : ""} awaiting your approval
          </p>
          <div className="space-y-3">
            {pending.map((e) => (
              <div key={e.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-card p-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{e.title}</p>
                  <p className="text-xs text-muted-foreground">
                    By {e.createdBy.name} · {e.eventDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} · {targetLabel(e.targetSections)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={approveEvent}>
                    <input type="hidden" name="id" value={e.id} />
                    <button className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                    </button>
                  </form>
                  <form action={rejectEvent}>
                    <input type="hidden" name="id" value={e.id} />
                    <button className="inline-flex items-center gap-1 rounded-md border border-red-500/25 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-500/10 dark:text-red-400">
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All events */}
      {events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <Calendar className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">No events yet</p>
          <Link href="/events/new" className="mt-2 inline-block text-xs text-primary hover:underline">Create the first one</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((e) => {
            const { tone, label } = STATUS_BADGE[e.status];
            return (
              <Link key={e.id} href={`/events/${e.id}`} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3 shadow-sm transition hover:border-primary/30 hover:bg-accent">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{e.title}</p>
                    <Badge tone={tone}>{label}</Badge>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{e.eventDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
                    {e.venue && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{e.venue}</span>}
                    <span className="flex items-center gap-1"><Users2 className="h-3 w-3" />{targetLabel(e.targetSections)}</span>
                    <span className="font-medium text-foreground">{e._count.attendances} attended</span>
                  </div>
                  {isAdmin && <p className="mt-0.5 text-[10px] text-muted-foreground">By {e.createdBy.name}</p>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
