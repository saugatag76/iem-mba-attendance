"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { uniquePersonalCode } from "@/lib/code";
import { DEFAULT_STUDENT_PASSWORD } from "@/lib/studentDefaults";
import { classifyIdentifier, identifierEmail } from "@/lib/identifier";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";

/** Import + enroll students by phone number (Year 1) or enrollment number
 *  (Year 2), returning a structured result. */
export async function importStudentsPreviewed(formData: FormData) {
  await requireRole("ADMIN");
  const classSectionId = String(formData.get("classSectionId") ?? "");
  const csv = String(formData.get("csv") ?? "");
  const defaultPassword = String(formData.get("defaultPassword") ?? DEFAULT_STUDENT_PASSWORD) || DEFAULT_STUDENT_PASSWORD;

  const passwordHash = await bcrypt.hash(defaultPassword, 10);
  const rows = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let created = 0;
  let enrolled = 0;
  let skipped = 0;

  for (const row of rows) {
    const [identifierRaw, ...rest] = row.split(",");
    const identifier = classifyIdentifier(identifierRaw ?? "");
    const name = rest.join(",").trim() || `Student ${(identifierRaw ?? "").trim()}`;
    if (!identifier) { skipped++; continue; }

    const existing = await prisma.user.findFirst({
      where: identifier.kind === "phone" ? { phone: identifier.value } : { enrollmentNo: identifier.value },
    });
    if (existing) {
      const enr = await prisma.enrollment.findUnique({
        where: { studentId_classSectionId: { studentId: existing.id, classSectionId } },
      });
      if (enr) { skipped++; continue; }
      // Single-section model (matches admin/students Edit): moving a student into
      // this class replaces any other section they're in, rather than adding a
      // second enrollment alongside it.
      await prisma.enrollment.deleteMany({ where: { studentId: existing.id } });
      await prisma.enrollment.create({ data: { studentId: existing.id, classSectionId } });
      enrolled++;
    } else {
      const student = await prisma.user.create({
        data: {
          email: identifierEmail(identifier.kind, identifier.value),
          phone: identifier.kind === "phone" ? identifier.value : null,
          enrollmentNo: identifier.kind === "enrollment" ? identifier.value : null,
          name,
          role: Role.STUDENT,
          passwordHash,
          personalCode: await uniquePersonalCode(),
          mustChangePassword: true,
        },
      });
      await prisma.enrollment.create({ data: { studentId: student.id, classSectionId } });
      created++;
    }
  }

  return { created, enrolled, skipped };
}
