import { auth } from "@/auth";
import { offeringReport } from "@/lib/attendance";
import { toCsv } from "@/lib/csv";

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

  const csv = toCsv(
    ["Name", "Email", "Attended", "Total", "Percent"],
    report.rows.map((r) => [r.name, r.email, r.attended, r.total, r.percent]),
  );
  const filename = `${report.offering.subject.code}-${report.offering.classSection.name}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
