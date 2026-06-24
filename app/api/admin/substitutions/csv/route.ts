import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function csvCell(v: string | number | null | undefined): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN")
    return new Response("forbidden", { status: 403 });

  const url = new URL(req.url);
  const filter = url.searchParams.get("filter") ?? "all";

  const statusFilter =
    filter === "pending"  ? ["TEACHER_ACCEPTED"]
    : filter === "history" ? ["APPROVED", "REJECTED", "CANCELLED", "TEACHER_DECLINED"]
    : ["PENDING_TEACHER", "TEACHER_ACCEPTED", "TEACHER_DECLINED", "APPROVED", "REJECTED", "CANCELLED"];

  const rows = await prisma.substitutionRequest.findMany({
    where: { status: { in: statusFilter as never[] } },
    include: {
      scheduledClass: { include: { offering: { include: { subject: true, classSection: true } } } },
      requestedBy: true,
      substituteTeacher: true,
      approvedBy: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const header = [
    "Date",
    "Subject",
    "Subject Code",
    "Section",
    "Day",
    "Time",
    "Requesting Teacher",
    "Substitute Teacher",
    "Status",
    "Reason",
    "Teacher Note",
    "Admin Note",
    "Approved By",
    "Requested On",
    "Last Updated",
  ];

  const lines = [header.join(",")];
  for (const r of rows) {
    const offering = r.scheduledClass.offering;
    lines.push(
      [
        r.date.toLocaleDateString("en-IN"),
        offering?.subject.name,
        offering?.subject.code,
        offering?.classSection.name,
        r.scheduledClass.day,
        `${r.scheduledClass.startTime}–${r.scheduledClass.endTime}`,
        r.requestedBy.name,
        r.substituteTeacher.name,
        r.status,
        r.reason,
        r.teacherNote,
        r.adminNote,
        r.approvedBy?.name,
        r.createdAt.toLocaleDateString("en-IN"),
        r.updatedAt.toLocaleDateString("en-IN"),
      ]
        .map(csvCell)
        .join(","),
    );
  }

  const filename = `substitutions-${filter}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
