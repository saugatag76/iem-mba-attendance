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

export async function approveSubstitution(formData: FormData) {
  const admin = await requireRole("ADMIN");
  const id = String(formData.get("id") ?? "");
  const adminNote = String(formData.get("adminNote") ?? "").trim();

  const req = await prisma.substitutionRequest.findUnique({
    where: { id },
    include: {
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
  revalidatePath("/admin/substitutions");
  revalidatePath("/admin");
  flash("/admin/substitutions", `Substitution approved — ${req!.substituteTeacher.name} will cover the class.`);
}

export async function rejectSubstitution(formData: FormData) {
  const admin = await requireRole("ADMIN");
  const id = String(formData.get("id") ?? "");
  const adminNote = String(formData.get("adminNote") ?? "").trim();

  const req = await prisma.substitutionRequest.findUnique({ where: { id } });
  if (!req) flash("/admin/substitutions", "Request not found.", "error");
  if (req!.status !== "TEACHER_ACCEPTED") {
    flash("/admin/substitutions", "Only teacher-accepted requests can be rejected.", "error");
  }

  await prisma.substitutionRequest.update({
    where: { id },
    data: { status: "REJECTED", approvedById: admin.id, adminNote: adminNote || null },
  });
  revalidatePath("/admin/substitutions");
  revalidatePath("/admin");
  flash("/admin/substitutions", "Substitution request rejected.");
}
