/**
 * Regenerates data/logins/{admin,teacher,student}-logins.xlsx from the live
 * database — the committed files were stale placeholder/test data (old
 * @iem.edu domain, admin123/teach123 defaults, fake "Sec A Student 1" rows).
 *
 * A stored password hash can't be reversed, so a row can only show a real,
 * working password for accounts still sitting on the current role default —
 * verified live via bcrypt.compare, the same technique
 * scripts/rotate-default-passwords.ts uses. Anyone who has already changed
 * their password (checked via login, or via mustChangePassword=false for
 * students) is listed with a "(already changed)" marker instead of a guess.
 *
 * Students log in with phone (year 1) or enrollment number (year 2), never
 * email (see lib/identifier.ts) — the old sheet's "Email" column for
 * students was actively wrong, not just stale.
 *
 * demo.teacher@iem.edu.in / demo.student@iem.edu are excluded — they're a
 * separate fixed-password (demo123) demo flow, not real production people.
 *
 * Run: npx tsx scripts/update-login-excels.ts
 */
import * as XLSX from "xlsx";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { DEFAULT_STUDENT_PASSWORD } from "../lib/studentDefaults";

const ADMIN_DEFAULT = "Admin@2026";
const TEACHER_DEFAULT = "Teacher@2026";
const STUDENT_DEFAULT = DEFAULT_STUDENT_PASSWORD;

const CHANGED = "(already changed)";

async function main() {
  const [admins, teachers, students] = await Promise.all([
    prisma.user.findMany({ where: { role: "ADMIN" }, orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { role: "TEACHER", email: { not: { startsWith: "demo." } } },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "STUDENT", email: { not: { startsWith: "demo." } } },
      include: { enrollments: { include: { classSection: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  let adminOnDefault = 0;
  const adminRows = [];
  for (const u of admins) {
    const onDefault = await bcrypt.compare(ADMIN_DEFAULT, u.passwordHash);
    if (onDefault) adminOnDefault++;
    adminRows.push({ Name: u.name, Email: u.email, Password: onDefault ? ADMIN_DEFAULT : CHANGED });
  }

  let teacherOnDefault = 0;
  const teacherRows = [];
  for (const u of teachers) {
    const onDefault = await bcrypt.compare(TEACHER_DEFAULT, u.passwordHash);
    if (onDefault) teacherOnDefault++;
    teacherRows.push({ Name: u.name, Email: u.email, Password: onDefault ? TEACHER_DEFAULT : CHANGED });
  }

  let studentOnDefault = 0;
  const studentRows = [];
  for (const u of students) {
    const onDefault = !u.mustChangePassword ? false : await bcrypt.compare(STUDENT_DEFAULT, u.passwordHash);
    if (onDefault) studentOnDefault++;
    const type = u.phone ? "Phone" : u.enrollmentNo ? "Enrollment" : "";
    const loginId = u.phone ?? u.enrollmentNo ?? "";
    const section = u.enrollments[0]?.classSection?.name ?? "Unassigned";
    studentRows.push({
      Name: u.name,
      Section: section,
      "Login ID": loginId,
      Type: type,
      Password: onDefault ? STUDENT_DEFAULT : CHANGED,
    });
  }

  function writeWorkbook(rows: Record<string, string>[], colWidths: number[], fileName: string) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = colWidths.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, "Logins");
    XLSX.writeFile(wb, `data/logins/${fileName}`);
  }

  writeWorkbook(adminRows, [28, 30, 18], "admin-logins.xlsx");
  writeWorkbook(teacherRows, [30, 30, 18], "teacher-logins.xlsx");
  writeWorkbook(studentRows, [24, 16, 18, 12, 18], "student-logins.xlsx");

  console.log(`admin-logins.xlsx:   ${admins.length} rows (${adminOnDefault} on default password)`);
  console.log(`teacher-logins.xlsx: ${teachers.length} rows (${teacherOnDefault} on default password)`);
  console.log(`student-logins.xlsx: ${students.length} rows (${studentOnDefault} on default password)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
