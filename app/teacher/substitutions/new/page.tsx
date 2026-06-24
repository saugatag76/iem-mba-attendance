import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/app/_components/ui";
import { createSubstitutionRequest } from "../actions";
import { TeacherPicker, type TeacherOption } from "./TeacherPicker";
import type { Weekday } from "@prisma/client";

export const dynamic = "force-dynamic";

function nextOccurrence(weekday: Weekday): string {
  const dayMap: Record<Weekday, number> = { MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5 };
  const target = dayMap[weekday];
  const today = new Date();
  const todayDay = today.getDay() === 0 ? 7 : today.getDay();
  let diff = target - todayDay;
  if (diff <= 0) diff += 7;
  const d = new Date(today);
  d.setDate(today.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export default async function NewSubstitutionPage({
  searchParams,
}: {
  searchParams: Promise<{ slotId?: string; date?: string }>;
}) {
  const teacher = await requireRole("TEACHER", "ADMIN");
  const { slotId, date: dateParam } = await searchParams;

  // Pre-filled slot (from "sub?" links)
  const slot = slotId
    ? await prisma.scheduledClass.findUnique({
        where: { id: slotId },
        include: { offering: { include: { subject: true, classSection: true } } },
      })
    : null;

  if (slotId && (!slot || slot.offering?.teacherId !== teacher.id)) notFound();

  const defaultDate = slot
    ? (dateParam ?? nextOccurrence(slot.day))
    : (dateParam ?? new Date(Date.now() + 86400000).toISOString().slice(0, 10));

  // All ScheduledClasses for this teacher (class picker when no slot pre-selected)
  const mySlots = slot
    ? []
    : await prisma.scheduledClass.findMany({
        where: { offering: { teacherId: teacher.id } },
        include: { offering: { include: { subject: true, classSection: true } } },
        orderBy: [{ day: "asc" }, { slotIndex: "asc" }],
      });

  // All other teachers + conflict check (only meaningful when slot is known)
  const allTeachers = await prisma.user.findMany({
    where: { role: "TEACHER", id: { not: teacher.id } },
    include: slot
      ? {
          taughtOfferings: {
            include: {
              schedule: {
                where: {
                  day: slot.day,
                  startTime: { lte: slot.endTime },
                  endTime: { gte: slot.startTime },
                },
              },
            },
          },
        }
      : { taughtOfferings: false },
    orderBy: { name: "asc" },
  });

  const teacherOptions: TeacherOption[] = allTeachers.map((t) => ({
    id: t.id,
    name: t.name,
    email: t.email,
    hasConflict:
      Array.isArray(t.taughtOfferings) &&
      t.taughtOfferings.some(
        (o) => "schedule" in o && Array.isArray(o.schedule) && o.schedule.length > 0,
      ),
  }));

  return (
    <div>
      <Link
        href="/teacher/substitutions"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back to substitutions
      </Link>

      <PageHeader
        title="Request a substitute"
        subtitle="Send a cover request to a colleague for admin approval"
      />

      {/* Everything inside one form */}
      <form action={createSubstitutionRequest} className="space-y-6">

        {/* Class selection */}
        {slot ? (
          <>
            <input type="hidden" name="scheduledClassId" value={slotId} />
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Class to be covered
              </p>
              <p className="text-base font-semibold text-foreground">
                {slot.offering?.subject.name}
              </p>
              <p className="text-sm text-muted-foreground">
                {slot.offering?.classSection.name} · {slot.day} {slot.startTime}–{slot.endTime}
              </p>
            </div>
          </>
        ) : (
          <div>
            <label
              htmlFor="scheduledClassId"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Which class needs covering? <span className="text-destructive">*</span>
            </label>
            <select
              id="scheduledClassId"
              name="scheduledClassId"
              required
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            >
              <option value="">Select a class…</option>
              {mySlots.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.offering?.subject.name} — {sc.offering?.classSection.name} · {sc.day}{" "}
                  {sc.startTime}–{sc.endTime}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">All your scheduled weekly classes.</p>
          </div>
        )}

        {/* Date */}
        <div>
          <label htmlFor="date" className="mb-1.5 block text-sm font-medium text-foreground">
            Date of class to substitute <span className="text-destructive">*</span>
          </label>
          <input
            id="date"
            name="date"
            type="date"
            defaultValue={defaultDate}
            min={new Date().toISOString().slice(0, 10)}
            required
            className="w-full max-w-xs rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {slot
              ? `Defaults to the next ${slot.day} — change if you need a different date.`
              : "Pick the specific date you need covered."}
          </p>
        </div>

        {/* Reason */}
        <div>
          <label htmlFor="reason" className="mb-1.5 block text-sm font-medium text-foreground">
            Reason for absence <span className="text-destructive">*</span>
          </label>
          <textarea
            id="reason"
            name="reason"
            required
            minLength={5}
            rows={3}
            placeholder="e.g. Medical appointment, official duty, conference attendance…"
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
        </div>

        {/* Teacher picker (client component for search) */}
        <div>
          <p className="mb-1.5 text-sm font-medium text-foreground">
            Select a substitute teacher <span className="text-destructive">*</span>
          </p>
          {slot && (
            <p className="mb-3 text-xs text-muted-foreground">
              Teachers with a conflict on{" "}
              <strong>
                {slot.day} {slot.startTime}–{slot.endTime}
              </strong>{" "}
              are flagged — they can still accept if available.
            </p>
          )}
          <TeacherPicker teachers={teacherOptions} showConflict={!!slot} />
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3 border-t border-border pt-4">
          <button
            type="submit"
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90"
          >
            Send request
          </button>
          <Link
            href="/teacher/substitutions"
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-accent"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
