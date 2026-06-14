import { auth } from "@/auth";
import { defaultersList } from "@/lib/attendance";
import { parseDateRange } from "@/lib/dateRange";

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

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

  const rows = await defaultersList(isAdmin ? {} : { teacherId: session.user.id }, range);

  const header = ["Student", "Email", "Subject Code", "Subject", "Section", "Teacher", "Attended", "Total", "Percent"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [r.studentName, r.studentEmail, r.subjectCode, r.subjectName, r.className, r.teacherName, r.attended, r.total, r.percent]
        .map(csvCell)
        .join(","),
    );
  }

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="below-75-attendance.csv"`,
    },
  });
}
