import { auth } from "@/auth";
import { parseTimetableWorkbook, syncTimetable } from "@/lib/timetableSync";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN")
    return Response.json({ error: "forbidden" }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No file uploaded" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  let parsed;
  try {
    parsed = parseTimetableWorkbook(buffer);
  } catch {
    return Response.json({ error: "Could not parse this file — is it the timetable template with a \"Timetable\" sheet?" }, { status: 400 });
  }

  const result = await syncTimetable(parsed, false);
  return Response.json({
    subjectsCount: parsed.subjects.size,
    offeringsCount: parsed.offerings.size,
    scheduleCount: parsed.schedule.length,
    ...result,
  });
}
