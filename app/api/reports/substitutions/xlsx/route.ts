import * as XLSX from "xlsx";
import { auth } from "@/auth";
import { parseDateRange } from "@/lib/dateRange";
import { fetchSubstitutionReportRows, ADMIN_APPROVAL_LABEL, fmtReportDate } from "@/lib/substitutionReport";

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

  const data = rows.map((r) => ({
    Date: fmtReportDate(r.date),
    Day: r.scheduledClass.day,
    Time: `${r.scheduledClass.startTime}–${r.scheduledClass.endTime}`,
    Subject: r.scheduledClass.offering?.subject.name ?? "",
    "Subject Code": r.scheduledClass.offering?.subject.code ?? "",
    Semester: r.scheduledClass.offering?.term ?? "",
    Section: r.scheduledClass.offering?.classSection.name ?? "",
    "Original Teacher": r.requestedBy.name,
    ...(isAdmin ? { "Substitute Teacher": r.substituteTeacher.name } : {}),
    Status: r.classStatus,
    "Admin Approval": ADMIN_APPROVAL_LABEL[r.status],
    Remarks: r.adminNote || r.teacherNote || "",
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 12 }, { wch: 6 }, { wch: 14 }, { wch: 24 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 20 },
    ...(isAdmin ? [{ wch: 20 }] : []),
    { wch: 12 }, { wch: 20 }, { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Substitution Report");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="substitution-report-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
