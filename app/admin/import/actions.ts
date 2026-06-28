"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";

/** Generate a system-internal email from a phone number (never shown to student). */
function phoneEmail(phone: string) {
  return `p${phone}@iem.internal`;
}

/** Import + enroll students by phone number, returning a structured result. */
export async function importStudentsPreviewed(formData: FormData) {
  await requireRole("ADMIN");
  const classSectionId = String(formData.get("classSectionId") ?? "");
  const csv = String(formData.get("csv") ?? "");
  const defaultPassword = String(formData.get("defaultPassword") ?? "stud123") || "stud123";

  const passwordHash = await bcrypt.hash(defaultPassword, 10);
  const rows = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let created = 0;
  let enrolled = 0;
  let skipped = 0;

  const phoneRegex = /^\d{10,12}$/;

  for (const row of rows) {
    const [phoneRaw, ...rest] = row.split(",");
    const phone = (phoneRaw ?? "").trim().replace(/[\s+\-()]/g, "");
    const name = rest.join(",").trim() || `Student ${phone}`;
    if (!phone || !phoneRegex.test(phone)) { skipped++; continue; }

    const existing = await prisma.user.findFirst({ where: { phone } });
    if (existing) {
      const enr = await prisma.enrollment.findUnique({
        where: { studentId_classSectionId: { studentId: existing.id, classSectionId } },
      });
      if (enr) { skipped++; continue; }
      await prisma.enrollment.create({ data: { studentId: existing.id, classSectionId } });
      enrolled++;
    } else {
      const email = phoneEmail(phone);
      const student = await prisma.user.create({
        data: { email, phone, name, role: Role.STUDENT, passwordHash },
      });
      await prisma.enrollment.create({ data: { studentId: student.id, classSectionId } });
      created++;
    }
  }

  return { created, enrolled, skipped };
}
