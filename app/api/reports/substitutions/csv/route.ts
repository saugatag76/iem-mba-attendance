import { auth } from "@/auth";
import { parseDateRange } from "@/lib/dateRange";
import { fetchSubstitutionReportRows, ADMIN_APPROVAL_LABEL, fmtReportDate } from "@/lib/substitutionReport";

function csvCell(v: string | number | null | undefined): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "TEACHER" && session.user.role !== "ADMIN"))
    return new Response("forbidden", { status: 403 });

  const isAdmin = session.user.role === "ADMIN";
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? undefined;
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const term = url.searchParams.get("term") ?? undefined;
  const teacherId = url.searchParams.get("teacherId") ?? undefined;
  const sort = url.searchParams.get("sort") ?? undefined;
  const range = parseDateRange({ from, to });

  const rows = await fetchSubstitutionReportRows({
    userId: session.user.id,
    isAdmin,
    q,
    from: range?.from,
    to: range?.to,
    term,
    teacherId,
    sort,
  });

  const header = [
    "Date",
    "Day",
    "Time",
    "Subject",
    "Subject Code",
    "Semester",
    "Section",
    "Original Teacher",
    ...(isAdmin ? ["Substitute Teacher"] : []),
    "Status",
    "Admin Approval",
    "Remarks",
  ];

  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        fmtReportDate(r.date),
        r.scheduledClass.day,
        `${r.scheduledClass.startTime}–${r.scheduledClass.endTime}`,
        r.scheduledClass.offering?.subject.name,
        r.scheduledClass.offering?.subject.code,
        r.scheduledClass.offering?.term,
        r.scheduledClass.offering?.classSection.name,
        r.requestedBy.name,
        ...(isAdmin ? [r.substituteTeacher.name] : []),
        r.classStatus,
        ADMIN_APPROVAL_LABEL[r.status],
        r.adminNote || r.teacherNote || "",
      ]
        .map(csvCell)
        .join(","),
    );
  }

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="substitution-report-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
