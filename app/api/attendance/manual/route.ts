import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { autoCloseExpired } from "@/lib/sessions";

/**
 * Manual fallback: a teacher marks a student present without the student self-checking-in.
 * Two ways to identify the student:
 *   - `personalCode` — the student reads out their 6-digit personal code (their device failed).
 *   - `studentId` — the teacher picks the student directly from the live session's class roster
 *     (the student's phone is dead/lost/forgotten, so no code is available at all).
 * No geofence either way — the teacher is physically present and vouching for them.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const sessionId = String(body.sessionId ?? "");
  const studentId = body.studentId ? String(body.studentId) : null;
  const personalCode = body.personalCode ? String(body.personalCode).trim() : null;
  const note = body.note ? String(body.note).slice(0, 500) : null;
  if (!sessionId || (!studentId && !/^\d{6}$/.test(personalCode ?? "")))
    return NextResponse.json({ error: "Provide the student's 6-digit personal code, or pick them from the roster." }, { status: 400 });

  const cls = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { offering: true },
  });
  if (!cls) return NextResponse.json({ error: "Session not found." }, { status: 404 });
  if (cls.teacherId !== session.user.id && session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Not your session." }, { status: 403 });
  if ((await autoCloseExpired(cls)) !== "OPEN")
    return NextResponse.json({ error: "Session is closed." }, { status: 409 });

  // Resolve the student — by roster pick (studentId) or by their personal code.
  const student = studentId
    ? await prisma.user.findUnique({ where: { id: studentId } })
    : await prisma.user.findUnique({ where: { personalCode: personalCode! } });
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

  const flagReason = studentId
    ? "Manual override by teacher (from roster)"
    : note
      ? `Manual override — teacher note: ${note}`
      : "Manual override by teacher";
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
