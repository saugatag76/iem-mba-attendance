"use client";

import { Trash2 } from "lucide-react";
import { deleteStudent } from "./actions";

export function DeleteStudentButton({
  id,
  name,
  attendanceCount,
}: {
  id: string;
  name: string;
  attendanceCount: number;
}) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const warning =
      attendanceCount > 0
        ? `${name} has ${attendanceCount} attendance record${attendanceCount > 1 ? "s" : ""}.\n\nDeleting this student permanently removes them and all their attendance history. Continue?`
        : `Remove ${name}? This cannot be undone.`;
    if (!window.confirm(warning)) e.preventDefault();
  }

  return (
    <form action={deleteStudent} onSubmit={handleSubmit}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        title={attendanceCount > 0 ? `Delete — ${attendanceCount} attendance record(s) will also be removed` : "Delete student"}
        className="inline-flex items-center gap-1 rounded-md border border-red-500/25 px-2 py-1 text-[11px] font-medium text-red-600 transition hover:bg-red-500/10 dark:text-red-400"
      >
        <Trash2 className="h-3 w-3" /> Delete
      </button>
    </form>
  );
}
