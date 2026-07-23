"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/session";
import { parseTimetableWorkbook, syncTimetable } from "@/lib/timetableSync";

/** Re-parses the uploaded file and writes the same diff the preview showed.
 *  Note: unlike the CLI script, this does NOT regenerate
 *  prisma/timetable-data.json — that file is a committed seed snapshot for
 *  reproducible local setup, and a serverless request has no reliable place
 *  to persist a file write. Run `npx tsx scripts/sync-timetable.ts <file>
 *  --apply` locally afterward if you want that snapshot kept in sync. */
export async function applyRoutineImport(formData: FormData) {
  await requireRole("ADMIN");

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("No file uploaded");

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = parseTimetableWorkbook(buffer);
  const result = await syncTimetable(parsed, true);

  revalidatePath("/admin/routine");

  return {
    added: result.added,
    updated: result.updated,
    unchanged: result.unchanged,
    removedKept: result.removedKept,
    removedDeleted: result.removedDeleted,
  };
}
