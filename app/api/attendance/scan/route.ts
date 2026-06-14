import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { peekSessionId, verifySessionToken } from "@/lib/qrToken";
import { withinGeofence } from "@/lib/geo";

/**
 * Student scan endpoint — the anti-proxy gate. Validates, in order:
 *   1. authenticated student
 *   2. token signature valid + not expired (kills shared screenshots)
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
    return NextResponse.json({ error: "Only students can scan in." }, { status: 403 });

  const studentId = session.user.id;
  const body = await req.json().catch(() => ({}));
  const token = String(body.token ?? "");
  const deviceId = String(body.deviceId ?? "");
  const lat = body.lat != null ? Number(body.lat) : null;
  const lng = body.lng != null ? Number(body.lng) : null;

  if (!token) return NextResponse.json({ error: "Missing QR token." }, { status: 400 });

  // 2. Verify token (need the session's secret first).
  const sessionId = peekSessionId(token);
  if (!sessionId) return NextResponse.json({ error: "Invalid QR." }, { status: 400 });

  const cls = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { offering: true },
  });
  if (!cls) return NextResponse.json({ error: "Session not found." }, { status: 404 });

  try {
    await verifySessionToken(token, cls.qrSecret);
  } catch {
    return NextResponse.json(
      { error: "QR expired — point your camera at the live code." },
      { status: 401 },
    );
  }

  // 3. Session must be open.
  if (cls.status !== "OPEN")
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

  // 6. Device binding — bind on first scan, flag (do not silently block) on mismatch.
  let flagged = false;
  let flagReason: string | null = null;
  if (deviceId) {
    const student = await prisma.user.findUnique({ where: { id: studentId } });
    if (student && !student.deviceId) {
      await prisma.user.update({ where: { id: studentId }, data: { deviceId } });
    } else if (student && student.deviceId !== deviceId) {
      flagged = true;
      flagReason = "Device mismatch (account used on a different device).";
    }
  }

  // 7. Geofence — only enforced when the session has an anchor and the student shared GPS.
  if (cls.geoLat != null && cls.geoLng != null) {
    if (lat == null || lng == null) {
      return NextResponse.json(
        { error: "Location required — enable location and try again." },
        { status: 403 },
      );
    }
    if (!withinGeofence(cls.geoLat, cls.geoLng, lat, lng, cls.geoRadiusM)) {
      return NextResponse.json(
        { error: "You appear to be outside the classroom." },
        { status: 403 },
      );
    }
  }

  await prisma.attendanceRecord.create({
    data: {
      sessionId,
      studentId,
      status: "PRESENT",
      method: "QR",
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
