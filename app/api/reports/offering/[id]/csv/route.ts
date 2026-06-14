import { auth } from "@/auth";
import { offeringReport } from "@/lib/attendance";

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "TEACHER" && session.user.role !== "ADMIN"))
    return new Response("forbidden", { status: 403 });

  const { id } = await params;
  const report = await offeringReport(id);
  if (!report) return new Response("not found", { status: 404 });
  if (session.user.role !== "ADMIN" && report.offering.teacherId !== session.user.id)
    return new Response("forbidden", { status: 403 });

  const header = ["Name", "Email", "Attended", "Total", "Percent"];
  const lines = [header.join(",")];
  for (const r of report.rows) {
    lines.push([r.name, r.email, r.attended, r.total, r.percent].map(csvCell).join(","));
  }
  const filename = `${report.offering.subject.code}-${report.offering.classSection.name}.csv`;

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
