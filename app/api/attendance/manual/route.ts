import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { peekUserId, verifyPersonalToken } from "@/lib/qrToken";
import { autoCloseExpired } from "@/lib/sessions";

/**
 * Manual fallback: a teacher scans a student's permanent personal QR to mark them present
 * (e.g. the student's own camera failed). No geofence — the teacher is physically scanning.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const sessionId = String(body.sessionId ?? "");
  const token = String(body.token ?? "");
  if (!sessionId || !token)
    return NextResponse.json({ error: "Missing data." }, { status: 400 });

  const cls = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { offering: true },
  });
  if (!cls) return NextResponse.json({ error: "Session not found." }, { status: 404 });
  if (cls.teacherId !== session.user.id && session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Not your session." }, { status: 403 });
  if ((await autoCloseExpired(cls)) !== "OPEN")
    return NextResponse.json({ error: "Session is closed." }, { status: 409 });

  // Resolve + verify the student's personal token.
  const userId = peekUserId(token);
  if (!userId) return NextResponse.json({ error: "Invalid student QR." }, { status: 400 });
  const student = await prisma.user.findUnique({ where: { id: userId } });
  if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });
  try {
    await verifyPersonalToken(token, student.personalQrSecret);
  } catch {
    return NextResponse.json({ error: "Invalid student QR." }, { status: 401 });
  }

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

  const record = await prisma.attendanceRecord.upsert({
    where: { sessionId_studentId: { sessionId, studentId: student.id } },
    update: {}, // already present → no-op
    create: { sessionId, studentId: student.id, status: "PRESENT", method: "MANUAL" },
  });

  return NextResponse.json({
    ok: true,
    message: `${student.name} marked present.`,
    alreadyPresent: record.method !== "MANUAL",
  });
}
