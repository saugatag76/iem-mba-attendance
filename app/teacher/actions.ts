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
    },
  });
  redirect(`/teacher/session/${session.id}`);
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
}
