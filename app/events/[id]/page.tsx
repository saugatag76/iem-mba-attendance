import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Calendar, Users2 } from "lucide-react";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Badge, Avatar } from "@/app/_components/ui";
import { openEvent, closeEvent, cancelEvent } from "../actions";
import { EventQr } from "./EventQr";
import type { EventStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<EventStatus, { tone: "gray"|"amber"|"green"|"red"|"brand"; label: string }> = {
  PENDING_APPROVAL: { tone: "amber",  label: "Pending approval" },
  APPROVED:         { tone: "brand",  label: "Approved" },
  REJECTED:         { tone: "red",    label: "Rejected" },
  OPEN:             { tone: "green",  label: "Open — scanning active" },
  CLOSED:           { tone: "gray",   label: "Closed" },
  CANCELLED:        { tone: "gray",   label: "Cancelled" },
};


export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("TEACHER", "ADMIN");
  const { id } = await params;

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      createdBy: true,
      approvedBy: true,
      targetSections: { include: { classSection: true } },
      attendances: { include: { student: true }, orderBy: { scannedAt: "asc" } },
    },
  });
  if (!event) notFound();

  // Teachers can only see their own events
  if (user.role === "TEACHER" && event.createdById !== user.id) notFound();

  const { tone, label } = STATUS_BADGE[event.status];
  const isOwnerOrAdmin = event.createdById === user.id || user.role === "ADMIN";

  return (
    <div>
      <Link href="/events" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> Back to events
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title={event.title} subtitle={event.description ?? undefined} />
        <Badge tone={tone}>{label}</Badge>
      </div>

      {/* Event info */}
      <div className="mb-6 flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4" />
          {event.eventDate.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
        </span>
        {event.venue && (
          <span className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4" /> {event.venue}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <Users2 className="h-4 w-4" />
          {event.targetSections.length === 0
            ? "All students"
            : event.targetSections.map((s) => s.classSection.name).join(", ")}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* QR + actions */}
        <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-6 shadow-sm">
          {event.status === "OPEN" ? (
            <>
              <EventQr eventId={event.id} qrSecret={event.qrSecret} />
              <p className="text-xs text-muted-foreground">Students scan this QR to mark event attendance</p>
              {isOwnerOrAdmin && (
                <form action={closeEvent}>
                  <input type="hidden" name="id" value={event.id} />
                  <button className="rounded-lg border border-red-500/25 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-500/10 dark:text-red-400">
                    Close event
                  </button>
                </form>
              )}
            </>
          ) : event.status === "APPROVED" && isOwnerOrAdmin ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">Event is approved. Open it to display the QR code for students to scan.</p>
              <form action={openEvent}>
                <input type="hidden" name="id" value={event.id} />
                <button className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90">
                  Open event &amp; show QR
                </button>
              </form>
            </div>
          ) : event.status === "PENDING_APPROVAL" ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Waiting for admin approval before the QR can be shown.</p>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">QR is not active.</p>
          )}

          {isOwnerOrAdmin && (event.status === "PENDING_APPROVAL" || event.status === "APPROVED") && (
            <form action={cancelEvent}>
              <input type="hidden" name="id" value={event.id} />
              <button className="text-xs text-muted-foreground hover:text-red-600">Cancel event</button>
            </form>
          )}
        </div>

        {/* Attendance */}
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Attendance</p>
            <span className="tabular-nums text-sm font-bold text-primary">{event.attendances.length}</span>
          </div>
          {event.attendances.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">No one has scanned yet.</p>
          ) : (
            <ul className="divide-y divide-border max-h-96 overflow-y-auto">
              {event.attendances.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                  <Avatar name={a.student.name} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{a.student.name}</p>
                    <p className="text-xs text-muted-foreground">{a.student.email}</p>
                  </div>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {a.scannedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
