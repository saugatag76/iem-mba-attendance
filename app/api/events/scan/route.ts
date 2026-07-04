import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "STUDENT")
    return NextResponse.json({ error: "Students only." }, { status: 403 });

  const studentId = session.user.id;
  const code = String((await req.json().catch(() => ({}))).code ?? "").trim();
  if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: "Enter the 6-digit event code." }, { status: 400 });

  const event = await prisma.event.findFirst({
    where: { code, status: "OPEN" },
    include: { targetSections: { select: { classSectionId: true } } },
  });
  if (!event)
    return NextResponse.json({ error: "Invalid code or the event is not open." }, { status: 404 });

  const eventId = event.id;

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
