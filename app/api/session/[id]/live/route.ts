import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ROTATION_TTL_SECONDS, signSessionToken } from "@/lib/qrToken";
import { autoCloseExpired } from "@/lib/sessions";

/**
 * Teacher-only polling endpoint for the live QR screen.
 * Returns a freshly-signed rotating token plus the current present roster.
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
      records: { include: { student: true }, orderBy: { scannedAt: "desc" } },
    },
  });
  if (!s) return NextResponse.json({ error: "not found" }, { status: 404 });

  const isOwner = s.teacherId === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  if (!isOwner && !isAdmin)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const status = await autoCloseExpired(s);

  // Total enrolled in this class (denominator for the live counter).
  const total = await prisma.enrollment.count({
    where: { classSectionId: s.offering.classSectionId },
  });

  const token =
    status === "OPEN" ? await signSessionToken(s.id, s.qrSecret) : null;

  return NextResponse.json({
    status,
    ttl: ROTATION_TTL_SECONDS,
    token,
    expiresAt: s.expiresAt,
    total,
    present: s.records.map((r) => ({
      name: r.student.name,
      method: r.method,
      flagged: r.flagged,
      flagReason: r.flagReason,
      scannedAt: r.scannedAt,
    })),
  });
}
