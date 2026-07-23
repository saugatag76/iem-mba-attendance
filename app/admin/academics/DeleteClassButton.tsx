"use client";

import { Trash2 } from "lucide-react";
import type { deleteClass } from "../actions";

export function DeleteClassButton({
  id,
  offeringsCount,
  enrollmentsCount,
  sessionCount,
  action,
}: {
  id: string;
  offeringsCount: number;
  enrollmentsCount: number;
  sessionCount: number;
  action: typeof deleteClass;
}) {
  const hasImpact = offeringsCount > 0 || enrollmentsCount > 0 || sessionCount > 0;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (
      hasImpact &&
      !window.confirm(
        `This class has ${offeringsCount} offering${offeringsCount === 1 ? "" : "s"}` +
          `${sessionCount > 0 ? ` (${sessionCount} session${sessionCount === 1 ? "" : "s"} with attendance data)` : ""} ` +
          `and ${enrollmentsCount} enrolled student${enrollmentsCount === 1 ? "" : "s"}.\n\n` +
          `Deleting it will permanently remove all of these offerings, their attendance history, and the scheduled timetable for this class. ` +
          `Enrolled students' accounts are not deleted — they'll just be unenrolled.\n\nContinue?`,
      )
    ) {
      e.preventDefault();
    }
  }

  return (
    <form action={action} onSubmit={handleSubmit}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="inline-flex items-center gap-1 rounded-md border border-red-500/25 px-2 py-1 text-[11px] font-medium text-red-600 transition hover:bg-red-500/10 dark:text-red-400"
        title={hasImpact ? "Remove class — offerings, enrollments and schedule will also be deleted" : "Remove class"}
      >
        <Trash2 className="h-3 w-3" />
        Remove
      </button>
    </form>
  );
}
