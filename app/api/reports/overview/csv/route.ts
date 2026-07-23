import { auth } from "@/auth";
import { reportsOverview } from "@/lib/attendance";
import { parseDateRange } from "@/lib/dateRange";
import { toCsv } from "@/lib/csv";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "TEACHER" && session.user.role !== "ADMIN"))
    return new Response("forbidden", { status: 403 });

  const isAdmin = session.user.role === "ADMIN";
  const url = new URL(req.url);
  const range = parseDateRange({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });

  const { summaries } = await reportsOverview(isAdmin ? {} : { teacherId: session.user.id }, range);

  const header = isAdmin
    ? ["Subject Code", "Subject", "Section", "Teacher", "Sessions", "Below 75%", "Avg %"]
    : ["Subject Code", "Subject", "Section", "Sessions", "Below 75%", "Avg %"];
  const rows = summaries.map((s) =>
    isAdmin
      ? [s.subjectCode, s.subjectName, s.className, s.teacherName, s.totalSessions, s.defaulters, s.avgPercent]
      : [s.subjectCode, s.subjectName, s.className, s.totalSessions, s.defaulters, s.avgPercent],
  );

  return new Response(toCsv(header, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendance-overview.csv"`,
    },
  });
}
