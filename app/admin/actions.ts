"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Role, Stream } from "@prisma/client";

async function adminOnly() {
  await requireRole("ADMIN");
}

export async function createDepartment(formData: FormData) {
  await adminOnly();
  const name = String(formData.get("name") ?? "").trim();
  if (name) await prisma.department.create({ data: { name } });
  revalidatePath("/admin", "layout");
}

export async function createClass(formData: FormData) {
  await adminOnly();
  const name = String(formData.get("name") ?? "").trim();
  const departmentId = String(formData.get("departmentId") ?? "");
  const year = Number(formData.get("year") ?? 1) || 1;
  const stream = (String(formData.get("stream") ?? "COMMON") as Stream) || Stream.COMMON;
  if (name && departmentId)
    await prisma.classSection.create({ data: { name, departmentId, year, stream } });
  revalidatePath("/admin", "layout");
}

export async function createSubject(formData: FormData) {
  await adminOnly();
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const departmentId = String(formData.get("departmentId") ?? "");
  const semester = Number(formData.get("semester") ?? 1) || 1;
  const stream = (String(formData.get("stream") ?? "COMMON") as Stream) || Stream.COMMON;
  if (name && code && departmentId)
    await prisma.subject.create({ data: { name, code, departmentId, semester, stream } });
  revalidatePath("/admin", "layout");
}

export async function createOffering(formData: FormData) {
  await adminOnly();
  const subjectId = String(formData.get("subjectId") ?? "");
  const classSectionId = String(formData.get("classSectionId") ?? "");
  const teacherId = String(formData.get("teacherId") ?? "");
  const term = String(formData.get("term") ?? "2026-ODD").trim() || "2026-ODD";
  if (subjectId && classSectionId && teacherId)
    await prisma.offering.create({ data: { subjectId, classSectionId, teacherId, term } });
  revalidatePath("/admin", "layout");
}

export async function createUser(formData: FormData) {
  await adminOnly();
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "STUDENT") as Role;
  const password = String(formData.get("password") ?? "changeme");
  if (email && name) {
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.upsert({
      where: { email },
      update: { name, role },
      create: { email, name, role, passwordHash },
    });
  }
  revalidatePath("/admin", "layout");
}

/**
 * Bulk-import students from pasted CSV (one "email,name" per line) and enroll them all
 * into the chosen class. Existing users are reused; new ones get the default password.
 */
export async function importStudents(formData: FormData) {
  await adminOnly();
  const classSectionId = String(formData.get("classSectionId") ?? "");
  const csv = String(formData.get("csv") ?? "");
  const defaultPassword = String(formData.get("defaultPassword") ?? "stud123") || "stud123";
  if (!classSectionId || !csv.trim()) return;

  const passwordHash = await bcrypt.hash(defaultPassword, 10);
  const rows = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const row of rows) {
    const [emailRaw, ...rest] = row.split(",");
    const email = (emailRaw ?? "").toLowerCase().trim();
    const name = rest.join(",").trim() || email.split("@")[0];
    if (!email) continue;

    const student = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name, role: Role.STUDENT, passwordHash },
    });
    await prisma.enrollment.upsert({
      where: { studentId_classSectionId: { studentId: student.id, classSectionId } },
      update: {},
      create: { studentId: student.id, classSectionId },
    });
  }
  revalidatePath("/admin", "layout");
}
