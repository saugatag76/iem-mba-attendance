"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

function flash(redirectTo: string, message: string, type?: "error") {
  const sep = redirectTo.includes("?") ? "&" : "?";
  const extra = type ? `&toastType=${type}` : "";
  redirect(`${redirectTo}${sep}toast=${encodeURIComponent(message)}${extra}`);
}

/** Teacher X creates a substitution request for a specific slot + date. */
export async function createSubstitutionRequest(formData: FormData) {
  const teacher = await requireRole("TEACHER", "ADMIN");

  const scheduledClassId = String(formData.get("scheduledClassId") ?? "").trim();
  const dateStr = String(formData.get("date") ?? "").trim();
  const substituteTeacherId = String(formData.get("substituteTeacherId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!scheduledClassId || !dateStr || !substituteTeacherId || reason.length < 5) {
    flash("/teacher/substitutions/new", "Please fill in all fields (reason min 5 chars).", "error");
  }
  if (substituteTeacherId === teacher.id) {
    flash("/teacher/substitutions/new", "You cannot request yourself as a substitute.", "error");
  }

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) flash("/teacher/substitutions/new", "Invalid date.", "error");

  await prisma.substitutionRequest.create({
    data: {
      scheduledClassId,
      date,
      requestedById: teacher.id,
      substituteTeacherId,
      reason,
      status: "PENDING_TEACHER",
    },
  });
  revalidatePath("/teacher/substitutions");
  flash("/teacher/substitutions", "Substitution request sent. Waiting for the substitute teacher to respond.");
}

/** Teacher X cancels their own pending or accepted request. */
export async function cancelSubstitutionRequest(formData: FormData) {
  const teacher = await requireRole("TEACHER", "ADMIN");
  const id = String(formData.get("id") ?? "");

  const req = await prisma.substitutionRequest.findUnique({ where: { id } });
  if (!req || req.requestedById !== teacher.id) {
    flash("/teacher/substitutions", "Request not found.", "error");
  }
  if (req!.status !== "PENDING_TEACHER" && req!.status !== "TEACHER_ACCEPTED") {
    flash("/teacher/substitutions", "This request can no longer be cancelled.", "error");
  }

  await prisma.substitutionRequest.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
  revalidatePath("/teacher/substitutions");
  flash("/teacher/substitutions", "Request cancelled.");
}

/** Teacher Y accepts or declines a substitution request. */
export async function respondToSubstitutionRequest(formData: FormData) {
  const teacher = await requireRole("TEACHER", "ADMIN");
  const id = String(formData.get("id") ?? "");
  const action = String(formData.get("action") ?? ""); // "accept" | "decline"
  const teacherNote = String(formData.get("teacherNote") ?? "").trim();

  const req = await prisma.substitutionRequest.findUnique({ where: { id } });
  if (!req || req.substituteTeacherId !== teacher.id) {
    flash("/teacher/substitutions", "Request not found.", "error");
  }
  if (req!.status !== "PENDING_TEACHER") {
    flash("/teacher/substitutions", "This request has already been responded to.", "error");
  }

  const newStatus = action === "accept" ? "TEACHER_ACCEPTED" : "TEACHER_DECLINED";
  await prisma.substitutionRequest.update({
    where: { id },
    data: { status: newStatus, teacherNote: teacherNote || null },
  });
  revalidatePath("/teacher/substitutions");

  const msg = action === "accept"
    ? "You accepted the substitution. Awaiting admin approval."
    : "You declined the substitution request.";
  flash("/teacher/substitutions", msg);
}
