import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** How long after a session a teacher may still correct its attendance. Admins have no limit. */
const TEACHER_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * After-the-fact correction: mark a student present on a session that has already closed
 * (e.g. the 5-minute window lapsed before they could scan). Requires a note; no geofence.
 * Admins: any session. Teachers: their own sessions, within 24h of the session start.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const role = session.user.role;
  if (role !== "TEACHER" && role !== "ADMIN")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const sessionId = String(body.sessionId ?? "");
  const studentId = String(body.studentId ?? "");
  const note = String(body.note ?? "").trim().slice(0, 500);
  if (!sessionId || !studentId)
    return NextResponse.json({ error: "Missing session or student." }, { status: 400 });
  if (!note)
    return NextResponse.json({ error: "A reason is required." }, { status: 400 });

  const cls = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { offering: true },
  });
  if (!cls) return NextResponse.json({ error: "Session not found." }, { status: 404 });

  if (role === "TEACHER") {
    if (cls.teacherId !== session.user.id)
      return NextResponse.json({ error: "Not your session." }, { status: 403 });
    if (Date.now() - cls.date.getTime() > TEACHER_WINDOW_MS)
      return NextResponse.json(
        { error: "The 24-hour correction window has passed. Ask an admin to mark this student present." },
        { status: 403 },
      );
  }

  const student = await prisma.user.findUnique({ where: { id: studentId } });
  if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });

  const enrolled = await prisma.enrollment.findUnique({
    where: {
      studentId_classSectionId: { studentId: student.id, classSectionId: cls.offering.classSectionId },
    },
  });
  if (!enrolled)
    return NextResponse.json({ error: `${student.name} is not enrolled in this class.` }, { status: 403 });

  const who = role === "ADMIN" ? "admin" : "teacher";
  const flagReason = `Manual override (after close) by ${who} ${session.user.name ?? ""}: ${note}`.replace(/\s+:/, ":");
  await prisma.attendanceRecord.upsert({
    where: { sessionId_studentId: { sessionId, studentId: student.id } },
    update: { status: "PRESENT", method: "MANUAL", flagged: true, flagReason },
    create: { sessionId, studentId: student.id, status: "PRESENT", method: "MANUAL", flagged: true, flagReason },
  });

  return NextResponse.json({ ok: true, message: `${student.name} marked present.` });
}
