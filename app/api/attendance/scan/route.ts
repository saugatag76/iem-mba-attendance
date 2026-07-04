import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { withinGeofence } from "@/lib/geo";
import { autoCloseExpired } from "@/lib/sessions";

/**
 * Student self check-in endpoint — the anti-proxy gate. Validates, in order:
 *   1. authenticated student
 *   2. code matches a session (reverse lookup)
 *   3. session is OPEN
 *   4. student enrolled in the class
 *   5. not already marked (idempotent via unique constraint)
 *   6. device binding (one account ↔ one device)
 *   7. geofence (student within radius of class anchor)
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.role !== "STUDENT")
    return NextResponse.json({ error: "Only students can check in." }, { status: 403 });

  const studentId = session.user.id;
  const body = await req.json().catch(() => ({}));
  const code = String(body.code ?? "").trim();
  const deviceId = String(body.deviceId ?? "");
  const lat = body.lat != null ? Number(body.lat) : null;
  const lng = body.lng != null ? Number(body.lng) : null;

  if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: "Enter the 6-digit code." }, { status: 400 });

  // 2. Reverse-lookup the OPEN session by its code.
  const cls = await prisma.session.findFirst({
    where: { code, status: "OPEN" },
    include: { offering: true },
  });
  if (!cls) return NextResponse.json({ error: "Invalid or expired code." }, { status: 404 });

  const sessionId = cls.id;

  // 3. Session must be open (and not past its auto-close deadline).
  const status = await autoCloseExpired(cls);
  if (status !== "OPEN")
    return NextResponse.json({ error: "This session is closed." }, { status: 409 });

  // 4. Enrollment check.
  const enrolled = await prisma.enrollment.findUnique({
    where: {
      studentId_classSectionId: {
        studentId,
        classSectionId: cls.offering.classSectionId,
      },
    },
  });
  if (!enrolled)
    return NextResponse.json(
      { error: "You are not enrolled in this class." },
      { status: 403 },
    );

  // 5. Already marked?
  const existing = await prisma.attendanceRecord.findUnique({
    where: { sessionId_studentId: { sessionId, studentId } },
  });
  if (existing)
    return NextResponse.json({ ok: true, already: true, message: "Already marked present." });

  // 6. Device binding — cross-ownership check first, then per-account binding.
  let flagged = false;
  let flagReason: string | null = null;
  if (deviceId) {
    // ANTI-PROXY: check if this device is already bound to a DIFFERENT student.
    // This blocks "Student A hands their phone to Student B to scan as Student B" —
    // the phone is bound to A, so when B tries to scan with it, this fires.
    const deviceOwner = await prisma.user.findFirst({
      where: { deviceId, id: { not: studentId } },
      select: { id: true },
    });
    if (deviceOwner) {
      return NextResponse.json(
        { error: "This device is registered to another student account. Proxy attendance is not allowed." },
        { status: 403 },
      );
    }

    const student = await prisma.user.findUnique({ where: { id: studentId } });
    if (student && !student.deviceId) {
      // First scan — bind this device permanently.
      await prisma.user.update({ where: { id: studentId }, data: { deviceId } });
    } else if (student && student.deviceId !== deviceId) {
      // Device changed — hard block. Teacher must reset the binding before a new device is accepted.
      return NextResponse.json(
        {
          error:
            "This account is locked to a different device. " +
            "If you have a new phone, ask your teacher to reset your device binding.",
        },
        { status: 403 },
      );
    }
  }

  // 7. Geofence — only enforced when the session has an anchor.
  if (cls.geoLat != null && cls.geoLng != null) {
    if (lat == null || lng == null) {
      // No GPS — create an ABSENT record so the teacher can see the non-compliance
      // in the live roster and session report, and manually override if warranted.
      await prisma.attendanceRecord.create({
        data: {
          sessionId,
          studentId,
          status: "ABSENT",
          method: "CODE",
          flagged: true,
          flagReason: "Location not provided — student checked in without location access",
        },
      });
      return NextResponse.json({
        ok: false,
        absent: true,
        reason: "location_noncompliance",
        message: "Marked absent: your location was not available. Speak to your teacher if this is a device issue.",
      });
    }
    if (!withinGeofence(cls.geoLat, cls.geoLng, lat, lng, cls.geoRadiusM)) {
      return NextResponse.json(
        { error: "You appear to be outside the classroom. Move closer and try again." },
        { status: 403 },
      );
    }
  }

  await prisma.attendanceRecord.create({
    data: {
      sessionId,
      studentId,
      status: "PRESENT",
      method: "CODE",
      geoLat: lat,
      geoLng: lng,
      flagged,
      flagReason,
    },
  });

  return NextResponse.json({
    ok: true,
    message: flagged ? "Marked present (flagged for review)." : "Marked present!",
    flagged,
  });
}
