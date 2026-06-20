import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, Clock } from "lucide-react";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Avatar, Badge } from "@/app/_components/ui";
import { createSubstitutionRequest } from "../actions";
import type { Weekday } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function NewSubstitutionPage({
  searchParams,
}: {
  searchParams: Promise<{ slotId?: string; date?: string }>;
}) {
  const teacher = await requireRole("TEACHER", "ADMIN");
  const { slotId, date: dateParam } = await searchParams;

  if (!slotId) redirect("/teacher");

  const slot = await prisma.scheduledClass.findUnique({
    where: { id: slotId },
    include: { offering: { include: { subject: true, classSection: true } } },
  });
  if (!slot || slot.offering?.teacherId !== teacher.id) notFound();

  // Default date to the next occurrence of slot.day from today
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
  const defaultDate = dateParam ?? nextOccurrence(slot.day);

  // All other teachers with conflict check for this slot's day + time
  const teachers = await prisma.user.findMany({
    where: { role: "TEACHER", id: { not: teacher.id } },
    include: {
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
    },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <Link href="/teacher" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> Back to My Day
      </Link>

      <PageHeader title="Request a substitute" subtitle="Send a cover request to a colleague for admin approval" />

      {/* Class info card */}
      <div className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Class to be covered</p>
        <p className="text-base font-semibold text-foreground">{slot.offering?.subject.name}</p>
        <p className="text-sm text-muted-foreground">
          {slot.offering?.classSection.name} · {slot.day} {slot.startTime}–{slot.endTime}
        </p>
      </div>

      <form action={createSubstitutionRequest} className="space-y-6">
        <input type="hidden" name="scheduledClassId" value={slotId} />

        {/* Date picker */}
        <div>
          <label htmlFor="date" className="mb-1.5 block text-sm font-medium text-foreground">
            Date of class to substitute
          </label>
          <input
            id="date"
            name="date"
            type="date"
            defaultValue={defaultDate}
            required
            className="w-full max-w-xs rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
          <p className="mt-1 text-xs text-muted-foreground">Select the specific date you need covered.</p>
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

        {/* Teacher Y picker */}
        <div>
          <p className="mb-2 text-sm font-medium text-foreground">
            Select a substitute teacher <span className="text-destructive">*</span>
          </p>
          <p className="mb-3 text-xs text-muted-foreground">
            Teachers with a scheduling conflict on <strong>{slot.day} {slot.startTime}–{slot.endTime}</strong> are flagged below — they can still accept, but be aware of the overlap.
          </p>
          <div className="space-y-2">
            {teachers.map((t) => {
              const hasConflict = t.taughtOfferings.some((o) => o.schedule.length > 0);
              return (
                <label
                  key={t.id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition hover:border-primary/40 hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary/8"
                >
                  <input
                    type="radio"
                    name="substituteTeacherId"
                    value={t.id}
                    required
                    className="accent-primary"
                  />
                  <Avatar name={t.name} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.email}</p>
                  </div>
                  {hasConflict && (
                    <span className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-3 w-3" />
                      Has a class at this time
                    </span>
                  )}
                  {!hasConflict && (
                    <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                      <Clock className="h-3 w-3" /> Free
                    </span>
                  )}
                </label>
              );
            })}
            {teachers.length === 0 && (
              <p className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
                No other teachers found.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90"
          >
            Send request
          </button>
          <Link href="/teacher" className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-accent">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
