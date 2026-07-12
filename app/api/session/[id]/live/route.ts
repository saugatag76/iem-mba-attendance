import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { autoCloseExpired } from "@/lib/sessions";

/**
 * Teacher-only polling endpoint for the live session screen.
 * Returns the static check-in code, who's present, who's flagged for a
 * location non-compliance, and who in the class hasn't been marked at all yet.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const s = await prisma.session.findUnique({
    where: { id },
    include: {
      offering: { include: { subject: true, classSection: true } },
      records: {
        include: { student: true },
        orderBy: { scannedAt: "desc" },
      },
    },
  });
  if (!s) return NextResponse.json({ error: "not found" }, { status: 404 });

  const isOwner = s.teacherId === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  if (!isOwner && !isAdmin)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const status = await autoCloseExpired(s);

  // Full enrolled roster for this class — also the denominator for the live counter,
  // and the source for the "not yet marked" list (so a teacher can mark someone
  // present directly from the roster, no personal code required).
  const enrollments = await prisma.enrollment.findMany({
    where: { classSectionId: s.offering.classSectionId },
    include: { student: true },
    orderBy: { student: { name: "asc" } },
  });

  const presentRecords = s.records.filter((r) => r.status === "PRESENT" || r.status === "LATE");
  const nonCompliantRecords = s.records.filter((r) => r.status === "ABSENT" && r.flagged);

  const markedIds = new Set(s.records.map((r) => r.studentId));
  const notMarked = enrollments
    .filter((e) => !markedIds.has(e.studentId))
    .map((e) => ({ studentId: e.studentId, name: e.student.name }));

  return NextResponse.json({
    status,
    code: status === "OPEN" ? s.code : null,
    expiresAt: s.expiresAt,
    total: enrollments.length,
    geoLat: s.geoLat,
    geoLng: s.geoLng,
    geoRadiusM: s.geoRadiusM,
    present: presentRecords.map((r) => ({
      name: r.student.name,
      method: r.method,
      flagged: r.flagged,
      flagReason: r.flagReason,
      scannedAt: r.scannedAt,
    })),
    nonCompliant: nonCompliantRecords.map((r) => ({
      studentId: r.studentId,
      name: r.student.name,
      email: r.student.email,
      flagReason: r.flagReason,
      scannedAt: r.scannedAt,
    })),
    notMarked,
  });
}
