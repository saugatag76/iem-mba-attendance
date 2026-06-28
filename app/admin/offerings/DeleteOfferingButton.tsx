"use client";

import { Trash2 } from "lucide-react";
import type { deleteOffering } from "../actions";

export function DeleteOfferingButton({
  id,
  sessionCount,
  action,
}: {
  id: string;
  sessionCount: number;
  action: typeof deleteOffering;
}) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (
      sessionCount > 0 &&
      !window.confirm(
        `This offering has ${sessionCount} session${sessionCount > 1 ? "s" : ""} with attendance data.\n\nDeleting it will permanently remove all attendance records. Continue?`,
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
        title={
          sessionCount > 0
            ? `Remove offering — ${sessionCount} session${sessionCount > 1 ? "s" : ""} will also be deleted`
            : "Remove offering"
        }
      >
        <Trash2 className="h-3 w-3" />
        {sessionCount > 0 ? `Remove (${sessionCount})` : "Remove"}
      </button>
    </form>
  );
}
