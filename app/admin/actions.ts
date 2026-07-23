"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { uniquePersonalCode } from "@/lib/code";
import { Role, Stream } from "@prisma/client";

async function adminOnly() {
  await requireRole("ADMIN");
}

/** Revalidate, then redirect back with a flash toast. `redirectTo` (a hidden form
 *  field) preserves the originating tab/filters; otherwise falls back to `fallback`. */
function flash(formData: FormData, fallback: string, message: string, type?: "error") {
  revalidatePath("/admin", "layout");
  const base = String(formData.get("redirectTo") || fallback);
  const sep = base.includes("?") ? "&" : "?";
  const extra = type ? `&toastType=${type}` : "";
  redirect(`${base}${sep}toast=${encodeURIComponent(message)}${extra}`);
}

export async function createDepartment(formData: FormData) {
  await adminOnly();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) flash(formData, "/admin/academics", "Department name is required", "error");
  await prisma.department.create({ data: { name } });
  flash(formData, "/admin/academics", `Department “${name}” created`);
}

export async function createClass(formData: FormData) {
  await adminOnly();
  const name = String(formData.get("name") ?? "").trim();
  const departmentId = String(formData.get("departmentId") ?? "");
  const year = Number(formData.get("year") ?? 1) || 1;
  const stream = (String(formData.get("stream") ?? "COMMON") as Stream) || Stream.COMMON;
  if (!name || !departmentId) flash(formData, "/admin/academics", "Class name and department are required", "error");
  await prisma.classSection.create({ data: { name, departmentId, year, stream } });
  flash(formData, "/admin/academics", `Class “${name}” created`);
}

export async function deleteClass(formData: FormData) {
  await adminOnly();
  const id = String(formData.get("id") ?? "");
  if (!id) flash(formData, "/admin/academics?tab=classes", "Class ID missing", "error");
  // Offerings, enrollments and scheduled classes cascade via schema (sessions/
  // attendance cascade further, through each offering); students themselves are
  // never deleted, only unenrolled.
  const cls = await prisma.classSection.delete({ where: { id } });
  flash(formData, "/admin/academics?tab=classes", `Class “${cls.name}” removed`);
}

export async function createSubject(formData: FormData) {
  await adminOnly();
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const departmentId = String(formData.get("departmentId") ?? "");
  const semester = Number(formData.get("semester") ?? 1) || 1;
  const stream = (String(formData.get("stream") ?? "COMMON") as Stream) || Stream.COMMON;
  if (!name || !code || !departmentId) flash(formData, "/admin/academics", "Subject name, code and department are required", "error");
  await prisma.subject.create({ data: { name, code, departmentId, semester, stream } });
  flash(formData, "/admin/academics", `Subject “${code} ${name}” created`);
}

export async function createOffering(formData: FormData) {
  await adminOnly();
  const subjectId = String(formData.get("subjectId") ?? "");
  const classSectionId = String(formData.get("classSectionId") ?? "");
  const teacherId = String(formData.get("teacherId") ?? "");
  const term = String(formData.get("term") ?? "2026-T1").trim() || "2026-T1";
  if (!subjectId || !classSectionId || !teacherId)
    flash(formData, "/admin/offerings", "Subject, class and teacher are required", "error");
  await prisma.offering.create({ data: { subjectId, classSectionId, teacherId, term } });
  flash(formData, "/admin/offerings", "Offering created");
}

export async function reassignOfferingTeacher(formData: FormData) {
  await adminOnly();
  const id = String(formData.get("id") ?? "");
  const teacherId = String(formData.get("teacherId") ?? "");
  if (!id || !teacherId) flash(formData, "/admin/offerings", "Offering and teacher are required", "error");
  await prisma.offering.update({ where: { id }, data: { teacherId } });
  flash(formData, "/admin/offerings", "Teacher reassigned");
}

export async function deleteOffering(formData: FormData) {
  await adminOnly();
  const id = String(formData.get("id") ?? "");
  if (!id) flash(formData, "/admin/offerings", "Offering ID missing", "error");
  // Sessions cascade via schema; just delete the offering.
  await prisma.offering.delete({ where: { id } });
  flash(formData, "/admin/offerings", "Offering removed");
}

export async function createUser(formData: FormData) {
  await adminOnly();
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "STUDENT") as Role;
  const password = String(formData.get("password") ?? "changeme");
  if (!email || !name) flash(formData, "/admin/people", "Email and name are required", "error");
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({
    where: { email },
    update: { name, role },
    create: { email, name, role, passwordHash, personalCode: await uniquePersonalCode() },
  });
  flash(formData, "/admin/people", `${name} saved`);
}

/**
 * Manually set/reset a user's password — there is no self-serve "forgot password"
 * flow, so the admin does this directly and tells the person their new password
 * out of band. For students, this also flips mustChangePassword back on so they're
 * forced to pick their own password again before they can mark attendance.
 */
export async function resetPassword(formData: FormData) {
  await adminOnly();
  const id = String(formData.get("id") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "").trim();
  if (!id) flash(formData, "/admin/people", "User not found", "error");
  if (newPassword.length < 6) flash(formData, "/admin/people", "Password must be at least 6 characters", "error");

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) flash(formData, "/admin/people", "User not found", "error");

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id },
    data: {
      passwordHash,
      ...(user!.role === "STUDENT" ? { mustChangePassword: true } : {}),
    },
  });
  flash(formData, "/admin/people", `Password reset for ${user!.name}`);
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
  if (!classSectionId || !csv.trim()) flash(formData, "/admin/import", "Pick a class and paste at least one row", "error");

  const passwordHash = await bcrypt.hash(defaultPassword, 10);
  const rows = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let count = 0;
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
    count++;
  }
  flash(formData, "/admin/import", `Imported ${count} student${count === 1 ? "" : "s"}`);
}
