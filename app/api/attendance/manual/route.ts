import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { autoCloseExpired } from "@/lib/sessions";

/**
 * Manual fallback: a teacher enters a student's permanent personal code to mark them present
 * (e.g. the student's own device failed). No geofence — the teacher is physically present.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const sessionId = String(body.sessionId ?? "");
  const personalCode = String(body.personalCode ?? "").trim();
  const note = body.note ? String(body.note).slice(0, 500) : null;
  if (!sessionId || !/^\d{6}$/.test(personalCode))
    return NextResponse.json({ error: "Enter the student's 6-digit personal code." }, { status: 400 });

  const cls = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { offering: true },
  });
  if (!cls) return NextResponse.json({ error: "Session not found." }, { status: 404 });
  if (cls.teacherId !== session.user.id && session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Not your session." }, { status: 403 });
  if ((await autoCloseExpired(cls)) !== "OPEN")
    return NextResponse.json({ error: "Session is closed." }, { status: 409 });

  // Resolve the student by their personal code.
  const student = await prisma.user.findUnique({ where: { personalCode } });
  if (!student) return NextResponse.json({ error: "No student found with that code." }, { status: 404 });

  // Must be enrolled in this class.
  const enrolled = await prisma.enrollment.findUnique({
    where: {
      studentId_classSectionId: {
        studentId: student.id,
        classSectionId: cls.offering.classSectionId,
      },
    },
  });
  if (!enrolled)
    return NextResponse.json(
      { error: `${student.name} is not enrolled in this class.` },
      { status: 403 },
    );

  const flagReason = note ? `Manual override — teacher note: ${note}` : "Manual override by teacher";
  const record = await prisma.attendanceRecord.upsert({
    where: { sessionId_studentId: { sessionId, studentId: student.id } },
    // If there was a prior ABSENT (location non-compliance), upgrade to PRESENT with consent log.
    update: { status: "PRESENT", method: "MANUAL", flagged: true, flagReason },
    create: { sessionId, studentId: student.id, status: "PRESENT", method: "MANUAL", flagged: true, flagReason },
  });

  return NextResponse.json({
    ok: true,
    message: `${student.name} marked present.`,
    alreadyPresent: record.method !== "MANUAL",
  });
}
