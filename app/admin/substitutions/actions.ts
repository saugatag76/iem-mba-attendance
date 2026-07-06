"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { notify } from "@/lib/notify";

function flash(redirectTo: string, message: string, type?: "error") {
  const sep = redirectTo.includes("?") ? "&" : "?";
  const extra = type ? `&toastType=${type}` : "";
  redirect(`${redirectTo}${sep}toast=${encodeURIComponent(message)}${extra}`);
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export async function approveSubstitution(formData: FormData) {
  const admin = await requireRole("ADMIN");
  const id = String(formData.get("id") ?? "");
  const adminNote = String(formData.get("adminNote") ?? "").trim();

  const req = await prisma.substitutionRequest.findUnique({
    where: { id },
    include: {
      requestedBy: true,
      substituteTeacher: true,
      scheduledClass: { include: { offering: { include: { subject: true } } } },
    },
  });
  if (!req) flash("/admin/substitutions", "Request not found.", "error");
  if (req!.status !== "TEACHER_ACCEPTED") {
    flash("/admin/substitutions", "Only teacher-accepted requests can be approved.", "error");
  }

  await prisma.substitutionRequest.update({
    where: { id },
    data: { status: "APPROVED", approvedById: admin.id, adminNote: adminNote || null },
  });

  const subjectName = req!.scheduledClass.offering?.subject.name ?? "your class";
  const dateStr = fmtDate(req!.date);
  await Promise.all([
    notify(
      req!.requestedById,
      "SUBSTITUTION_ADMIN_APPROVED",
      "Substitution approved",
      `${req!.substituteTeacher.name} will cover ${subjectName} on ${dateStr}.`,
      "/teacher/substitutions",
    ),
    notify(
      req!.substituteTeacherId,
      "SUBSTITUTION_ADMIN_APPROVED",
      "Substitution confirmed",
      `You're confirmed to cover ${subjectName} for ${req!.requestedBy.name} on ${dateStr}.`,
      "/teacher/substitutions",
    ),
  ]);

  revalidatePath("/admin/substitutions");
  revalidatePath("/admin");
  flash("/admin/substitutions", `Substitution approved — ${req!.substituteTeacher.name} will cover the class.`);
}

export async function rejectSubstitution(formData: FormData) {
  const admin = await requireRole("ADMIN");
  const id = String(formData.get("id") ?? "");
  const adminNote = String(formData.get("adminNote") ?? "").trim();

  const req = await prisma.substitutionRequest.findUnique({
    where: { id },
    include: {
      requestedBy: true,
      substituteTeacher: true,
      scheduledClass: { include: { offering: { include: { subject: true } } } },
    },
  });
  if (!req) flash("/admin/substitutions", "Request not found.", "error");
  if (req!.status !== "TEACHER_ACCEPTED") {
    flash("/admin/substitutions", "Only teacher-accepted requests can be rejected.", "error");
  }

  await prisma.substitutionRequest.update({
    where: { id },
    data: { status: "REJECTED", approvedById: admin.id, adminNote: adminNote || null },
  });

  const subjectName = req!.scheduledClass.offering?.subject.name ?? "the class";
  const dateStr = fmtDate(req!.date);
  await Promise.all([
    notify(
      req!.requestedById,
      "SUBSTITUTION_ADMIN_REJECTED",
      "Substitution rejected",
      `Admin rejected the substitution for ${subjectName} on ${dateStr}.${adminNote ? ` Note: ${adminNote}` : ""}`,
      "/teacher/substitutions",
    ),
    notify(
      req!.substituteTeacherId,
      "SUBSTITUTION_ADMIN_REJECTED",
      "Substitution rejected",
      `Admin rejected the request to cover ${subjectName} on ${dateStr}.`,
      "/teacher/substitutions",
    ),
  ]);

  revalidatePath("/admin/substitutions");
  revalidatePath("/admin");
  flash("/admin/substitutions", "Substitution request rejected.");
}
