import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { studentSubjectStats } from "@/lib/attendance";
import { parseDateRange } from "@/lib/dateRange";
import { toCsv } from "@/lib/csv";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "TEACHER" && session.user.role !== "ADMIN"))
    return new Response("forbidden", { status: 403 });

  const isAdmin = session.user.role === "ADMIN";
  const { id } = await params;

  const student = await prisma.user.findUnique({ where: { id }, select: { name: true, role: true } });
  if (!student || student.role !== "STUDENT") return new Response("not found", { status: 404 });

  if (!isAdmin) {
    const allowed = await prisma.enrollment.findFirst({
      where: { studentId: id, classSection: { offerings: { some: { teacherId: session.user.id } } } },
    });
    if (!allowed) return new Response("forbidden", { status: 403 });
  }

  const url = new URL(req.url);
  const range = parseDateRange({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });

  const stats = await studentSubjectStats(id, isAdmin ? undefined : session.user.id, range);

  const csv = toCsv(
    ["Subject Code", "Subject", "Section", "Attended", "Total", "Percent"],
    stats.map((s) => [s.subjectCode, s.subjectName, s.className, s.attended, s.totalSessions, s.percent]),
  );

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${student.name.replace(/[^a-z0-9]+/gi, "-")}-attendance.csv"`,
    },
  });
}
