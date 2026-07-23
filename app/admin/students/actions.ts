"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { uniquePersonalCode } from "@/lib/code";
import { DEFAULT_STUDENT_PASSWORD } from "@/lib/studentDefaults";
import { classifyIdentifier, identifierEmail } from "@/lib/identifier";
import { Role } from "@prisma/client";

function flash(to: string, msg: string, type?: "error") {
  revalidatePath("/admin/students");
  const sep = to.includes("?") ? "&" : "?";
  redirect(`${to}${sep}toast=${encodeURIComponent(msg)}${type ? `&toastType=${type}` : ""}`);
}

/** Add a brand-new student: name + phone-or-enrollment-no + section. */
export async function createStudent(formData: FormData) {
  await requireRole("ADMIN");
  const name = String(formData.get("name") ?? "").trim();
  const identifier = classifyIdentifier(String(formData.get("identifier") ?? ""));
  const sectionId = String(formData.get("sectionId") ?? "");

  if (!name || !sectionId) flash("/admin/students", "Name and section are required.", "error");
  if (!identifier) flash("/admin/students", "Enter a valid 10–12 digit phone number or 14-digit enrollment number.", "error");

  const existing = await prisma.user.findFirst({
    where: identifier!.kind === "phone" ? { phone: identifier!.value } : { enrollmentNo: identifier!.value },
  });
  if (existing) flash("/admin/students", "A student with this phone/enrollment number already exists. Use Edit instead.", "error");

  const passwordHash = await bcrypt.hash(DEFAULT_STUDENT_PASSWORD, 10);
  const student = await prisma.user.create({
    data: {
      email: identifierEmail(identifier!.kind, identifier!.value),
      phone: identifier!.kind === "phone" ? identifier!.value : null,
      enrollmentNo: identifier!.kind === "enrollment" ? identifier!.value : null,
      name,
      role: Role.STUDENT,
      passwordHash,
      personalCode: await uniquePersonalCode(),
      mustChangePassword: true,
    },
  });
  await prisma.enrollment.create({ data: { studentId: student.id, classSectionId: sectionId } });

  flash("/admin/students", `${name} added. Default password: ${DEFAULT_STUDENT_PASSWORD} (they'll be asked to change it on first login).`);
}

/** Edit an existing student's name, phone/enrollment no, and/or section (single primary section model). */
export async function updateStudent(formData: FormData) {
  await requireRole("ADMIN");
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const identifier = classifyIdentifier(String(formData.get("identifier") ?? ""));
  const sectionId = String(formData.get("sectionId") ?? "");

  if (!id || !name || !sectionId) flash("/admin/students", "Name and section are required.", "error");
  if (!identifier) flash("/admin/students", "Enter a valid 10–12 digit phone number or 14-digit enrollment number.", "error");

  const dup = await prisma.user.findFirst({
    where: {
      id: { not: id },
      ...(identifier!.kind === "phone" ? { phone: identifier!.value } : { enrollmentNo: identifier!.value }),
    },
  });
  if (dup) flash("/admin/students", "Another student already uses this phone/enrollment number.", "error");

  await prisma.user.update({
    where: { id },
    data: {
      name,
      phone: identifier!.kind === "phone" ? identifier!.value : null,
      enrollmentNo: identifier!.kind === "enrollment" ? identifier!.value : null,
      email: identifierEmail(identifier!.kind, identifier!.value),
    },
  });

  // Single-section model: replace any existing enrollments with the chosen one.
  await prisma.enrollment.deleteMany({ where: { studentId: id } });
  await prisma.enrollment.create({ data: { studentId: id, classSectionId: sectionId } });

  flash("/admin/students", `${name} updated.`);
}

/** Permanently delete a student — cascades to enrollments and attendance;
 *  event attendance has no cascade (FK-restrict), so it's cleared explicitly first. */
export async function deleteStudent(formData: FormData) {
  await requireRole("ADMIN");
  const id = String(formData.get("id") ?? "");
  if (!id) flash("/admin/students", "Student not found.", "error");
  await prisma.eventAttendance.deleteMany({ where: { studentId: id } });
  const student = await prisma.user.delete({ where: { id } });
  flash("/admin/students", `${student.name} removed.`);
}
