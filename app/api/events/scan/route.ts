import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { peekEventId, verifyEventToken } from "@/lib/qrToken";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "STUDENT")
    return NextResponse.json({ error: "Students only." }, { status: 403 });

  const studentId = session.user.id;
  const { token } = await req.json().catch(() => ({}));
  if (!token) return NextResponse.json({ error: "Missing token." }, { status: 400 });

  const eventId = peekEventId(token);
  if (!eventId) return NextResponse.json({ error: "Invalid QR." }, { status: 400 });

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { targetSections: { select: { classSectionId: true } } },
  });
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

  try {
    await verifyEventToken(token, event.qrSecret);
  } catch {
    return NextResponse.json({ error: "QR code is invalid or expired." }, { status: 401 });
  }

  if (event.status !== "OPEN")
    return NextResponse.json({ error: "This event is not currently open for scanning." }, { status: 409 });

  // If targetSections is set, student must be enrolled in one of them
  if (event.targetSections.length > 0) {
    const allowedIds = new Set(event.targetSections.map((s) => s.classSectionId));
    const enrollment = await prisma.enrollment.findFirst({
      where: { studentId, classSectionId: { in: [...allowedIds] } },
    });
    if (!enrollment)
      return NextResponse.json(
        { error: "Your class is not invited to this event." },
        { status: 403 },
      );
  }

  // Idempotent upsert
  const existing = await prisma.eventAttendance.findUnique({
    where: { eventId_studentId: { eventId, studentId } },
  });
  if (existing)
    return NextResponse.json({ ok: true, already: true, message: "Already marked present for this event." });

  await prisma.eventAttendance.create({ data: { eventId, studentId } });
  return NextResponse.json({ ok: true, message: `Attendance recorded for "${event.title}". ✓` });
}
