import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";

async function test(email: string, password: string) {
  const u = await prisma.user.findUnique({ where: { email } });
  if (!u) {
    console.log(`  ${email.padEnd(22)} → NOT FOUND in DB`);
    return;
  }
  const ok = await bcrypt.compare(password, u.passwordHash);
  console.log(`  ${email.padEnd(22)} role=${u.role.padEnd(7)} "${password}" → ${ok ? "VALID ✓" : "WRONG ✗"}`);
}

async function main() {
  console.log("Checking credentials against the live (Neon) DB:\n");
  await test("teacher1@iem.edu", "teach123");
  await test("finA1@iem.edu", "stud123");
  await test("finA2@iem.edu", "stud123");
  await test("y1a1@iem.edu", "stud123");
  console.log("\nAll students in DB:");
  const studs = await prisma.user.findMany({ where: { role: "STUDENT" }, select: { email: true } });
  console.log("  " + studs.map((s) => s.email).join(", "));
  await prisma.$disconnect();
}

main();
