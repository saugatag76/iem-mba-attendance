import { auth } from "@/auth";
import { studentsOverallStats } from "@/lib/attendance";
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

  const stats = await studentsOverallStats(isAdmin ? undefined : session.user.id, range);

  const csv = toCsv(
    ["Name", "Email", "Section", "Sessions", "Attended", "Percent"],
    stats.map((s) => [s.name, s.email, s.className, s.totalSessions, s.attended, s.percent]),
  );

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="students-attendance.csv"`,
    },
  });
}
