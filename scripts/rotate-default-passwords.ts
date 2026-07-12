/*
 * Rotates the actual stored passwordHash for accounts still sitting on the
 * OLD shared default passwords (admin123 / teach123 / the old student default),
 * replacing them with the new defaults now hardcoded in lib/studentDefaults.ts
 * and prisma/seed.ts. This only touches accounts still authenticating with a
 * known/leaked default — never a password a real person has already chosen:
 *
 *   - ADMIN / TEACHER: every account whose current hash still matches the old
 *     default is rotated (there's no "must change password" gate for these
 *     roles, so absent this script they'd never move off the old value).
 *   - STUDENT: only accounts where mustChangePassword is still true AND the
 *     hash still matches the old default — i.e. students who have never
 *     completed their first login. Anyone who already picked their own
 *     password is left untouched.
 *   - demo.teacher / demo.student (demo123) are left alone entirely.
 *
 * Run:  npx tsx scripts/rotate-default-passwords.ts [--apply]
 * Without --apply it only prints a report (dry run, no writes).
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { DEFAULT_STUDENT_PASSWORD } from "../lib/studentDefaults";

const prisma = new PrismaClient();

const APPLY = process.argv.includes("--apply");

const OLD_ADMIN = "admin123";
const OLD_TEACHER = "teach123";
const OLD_STUDENT = "Mba@2026";

const NEW_ADMIN = "Admin@2026";
const NEW_TEACHER = "Teacher@2026";
const NEW_STUDENT = DEFAULT_STUDENT_PASSWORD; // must match lib/studentDefaults.ts

async function main() {
  const newAdminHash = await bcrypt.hash(NEW_ADMIN, 10);
  const newTeacherHash = await bcrypt.hash(NEW_TEACHER, 10);
  const newStudentHash = await bcrypt.hash(NEW_STUDENT, 10);

  let adminRotated = 0;
  let teacherRotated = 0;
  let studentRotated = 0;

  const admins = await prisma.user.findMany({ where: { role: "ADMIN" } });
  for (const u of admins) {
    if (!(await bcrypt.compare(OLD_ADMIN, u.passwordHash))) continue;
    adminRotated++;
    console.log(`  [admin]   ${u.email}`);
    if (APPLY) await prisma.user.update({ where: { id: u.id }, data: { passwordHash: newAdminHash } });
  }

  const teachers = await prisma.user.findMany({ where: { role: "TEACHER" } });
  for (const u of teachers) {
    if (u.email.startsWith("demo.")) continue; // leave demo123 accounts alone
    if (!(await bcrypt.compare(OLD_TEACHER, u.passwordHash))) continue;
    teacherRotated++;
    console.log(`  [teacher] ${u.email}`);
    if (APPLY) await prisma.user.update({ where: { id: u.id }, data: { passwordHash: newTeacherHash } });
  }

  const pendingStudents = await prisma.user.findMany({ where: { role: "STUDENT", mustChangePassword: true } });
  for (const u of pendingStudents) {
    if (u.email.startsWith("demo.")) continue; // leave demo123 accounts alone
    if (!(await bcrypt.compare(OLD_STUDENT, u.passwordHash))) continue;
    studentRotated++;
    if (APPLY) await prisma.user.update({ where: { id: u.id }, data: { passwordHash: newStudentHash } });
  }

  console.log(`\n${APPLY ? "Applied" : "Would rotate"}: admin=${adminRotated} teacher=${teacherRotated} student(pending, old default)=${studentRotated}`);
  if (!APPLY) console.log("Dry run only — re-run with --apply to write changes.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
