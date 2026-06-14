import { auth } from "@/auth";
import { sessionRegister } from "@/lib/attendance";

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
  const data = await sessionRegister(id);
  if (!data) return new Response("not found", { status: 404 });
  if (session.user.role !== "ADMIN" && data.session.teacherId !== session.user.id)
    return new Response("forbidden", { status: 403 });

  const header = [
    "Name",
    "Email",
    "Status",
    "Method",
    "Flagged",
    "ScannedAt",
    "Lat",
    "Lng",
    "DistanceM",
    "OutOfRange",
  ];
  const lines = [header.join(",")];
  for (const r of data.rows) {
    lines.push(
      [
        r.name,
        r.email,
        r.present ? "Present" : "Absent",
        r.method ?? "",
        r.flagged ? "YES" : "",
        r.scannedAt ? new Date(r.scannedAt).toISOString() : "",
        r.lat ?? "",
        r.lng ?? "",
        r.distanceM ?? "",
        r.outOfRange ? "YES" : "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  const d = new Date(data.session.date).toISOString().slice(0, 10);
  const filename = `${data.session.offering.subject.code}-${d}.csv`;

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
