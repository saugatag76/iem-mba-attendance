"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

/** Open a new attendance session for an offering, anchoring the geofence at the teacher's location. */
export async function openSession(formData: FormData) {
  const teacher = await requireRole("TEACHER", "ADMIN");
  const offeringId = String(formData.get("offeringId") ?? "");
  const lat = formData.get("lat") ? Number(formData.get("lat")) : null;
  const lng = formData.get("lng") ? Number(formData.get("lng")) : null;
  const radius = Number(formData.get("radius") ?? 75) || 75;
  const customMin = Number(formData.get("customMin") ?? 0) || 0;
  const presetMin = Number(formData.get("presetMin") ?? 0) || 0;
  const durationMin = customMin > 0 ? customMin : presetMin;
  if (!offeringId) return;

  const offering = await prisma.offering.findUnique({ where: { id: offeringId } });
  if (!offering) return;

  const session = await prisma.session.create({
    data: {
      offeringId,
      teacherId: teacher.id,
      geoLat: lat,
      geoLng: lng,
      geoRadiusM: radius,
      expiresAt: durationMin > 0 ? new Date(Date.now() + durationMin * 60_000) : null,
    },
  });
  redirect(`/teacher/session/${session.id}`);
}

/**
 * Reset a student's device binding so their next scan registers the new device.
 * Only teachers (who teach this student) or admins can call this.
 */
export async function resetStudentDevice(formData: FormData) {
  await requireRole("TEACHER", "ADMIN");
  const studentId = String(formData.get("studentId") ?? "");
  if (!studentId) return;
  await prisma.user.update({
    where: { id: studentId },
    data: { deviceId: null },
  });
  const redirectTo = String(formData.get("redirectTo") ?? "/teacher");
  revalidatePath(redirectTo);
  redirect(`${redirectTo}?toast=${encodeURIComponent("Device binding reset — student can now scan from a new device.")}`);
}

export async function closeSession(formData: FormData) {
  await requireRole("TEACHER", "ADMIN");
  const sessionId = String(formData.get("sessionId") ?? "");
  if (!sessionId) return;
  await prisma.session.update({
    where: { id: sessionId },
    data: { status: "CLOSED", endTime: new Date() },
  });
  revalidatePath(`/teacher/session/${sessionId}`);
  redirect(`/reports/session/${sessionId}`);
}
