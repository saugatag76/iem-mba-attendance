import Link from "next/link";
import { ArrowLeft, CalendarRange } from "lucide-react";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/app/_components/ui";
import { createEvent } from "../actions";
import { SectionPicker } from "./SectionPicker";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20";

export default async function NewEventPage() {
  const user = await requireRole("TEACHER", "ADMIN");
  const isAdmin = user.role === "ADMIN";
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 16);

  const sections = await prisma.classSection.findMany({
    orderBy: [{ year: "asc" }, { name: "asc" }],
  });
  const year1 = sections.filter((s) => s.year === 1).map((s) => ({ id: s.id, name: s.name }));
  const year2 = sections.filter((s) => s.year === 2).map((s) => ({ id: s.id, name: s.name }));

  return (
    <div className="mx-auto max-w-xl">
      <Link
        href="/events"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back to events
      </Link>

      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-sm shadow-primary/30">
          <CalendarRange className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold text-foreground">Create event</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Event will be approved immediately." : "Will be sent to admin for approval."}
          </p>
        </div>
      </div>

      <form action={createEvent} className="space-y-5">
        {/* Title */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-foreground">
            Event title <span className="text-destructive">*</span>
          </label>
          <input
            name="title"
            required
            placeholder="Annual Sports Day, Guest Lecture on AI…"
            className={inputCls}
          />
        </div>

        {/* Description */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-foreground">
            Description
            <span className="ml-1 text-xs font-normal text-muted-foreground">optional</span>
          </label>
          <textarea
            name="description"
            rows={3}
            placeholder="Brief description of the event…"
            className={inputCls}
          />
        </div>

        {/* Date + Venue */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-foreground">
              Date &amp; time <span className="text-destructive">*</span>
            </label>
            <input
              name="eventDate"
              type="datetime-local"
              required
              defaultValue={tomorrow}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-foreground">
              Venue
              <span className="ml-1 text-xs font-normal text-muted-foreground">optional</span>
            </label>
            <input
              name="venue"
              placeholder="Auditorium, Ground…"
              className={inputCls}
            />
          </div>
        </div>

        {/* Class picker */}
        <SectionPicker year1={year1} year2={year2} />

        {/* Submit */}
        <button
          type="submit"
          className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white shadow-sm shadow-primary/25 transition hover:bg-primary/90"
        >
          {isAdmin ? "Create event" : "Submit for approval"}
        </button>
      </form>
    </div>
  );
}
