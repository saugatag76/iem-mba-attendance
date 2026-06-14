import { PrismaClient, Role, Stream } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function user(email: string, name: string, role: Role, password: string) {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.upsert({
    where: { email },
    update: { name, role },
    create: { email, name, role, passwordHash },
  });
}

async function main() {
  console.log("Seeding MBA department…");

  const dept = await prisma.department.upsert({
    where: { name: "Master of Business Administration (MBA)" },
    update: {},
    create: { name: "Master of Business Administration (MBA)" },
  });

  // ---- Sections ----
  async function section(name: string, year: number, stream: Stream) {
    return prisma.classSection.upsert({
      where: { departmentId_name: { departmentId: dept.id, name } },
      update: { year, stream },
      create: { name, year, stream, departmentId: dept.id },
    });
  }

  // Year 1: four common sections.
  const y1: Record<string, Awaited<ReturnType<typeof section>>> = {};
  for (const s of ["A", "B", "C", "D"]) {
    y1[s] = await section(`Year 1 — Sec ${s}`, 1, Stream.COMMON);
  }

  // Year 2: stream sections (Finance ×2, HR ×1, Tech-Mgmt ×1) + a shared Common group.
  const finA = await section("Year 2 Finance — Sec A", 2, Stream.FINANCE);
  const finB = await section("Year 2 Finance — Sec B", 2, Stream.FINANCE);
  const hrA = await section("Year 2 HR — Sec A", 2, Stream.HR);
  const tmA = await section("Year 2 Tech Mgmt — Sec A", 2, Stream.TECH_MANAGEMENT);
  const y2common = await section("Year 2 — Common (Marketing)", 2, Stream.COMMON);

  // ---- Subjects (DUMMY — replace with the real list later) ----
  async function subject(code: string, name: string, semester: number, stream: Stream) {
    return prisma.subject.upsert({
      where: { departmentId_code: { departmentId: dept.id, code } },
      update: { name, semester, stream },
      create: { code, name, semester, stream, departmentId: dept.id },
    });
  }

  // Year 1 — all common, across sem 1-3.
  const y1subjects = [
    await subject("MB101", "Principles of Management", 1, Stream.COMMON),
    await subject("MB102", "Managerial Economics", 1, Stream.COMMON),
    await subject("MB103", "Accounting for Managers", 1, Stream.COMMON),
    await subject("MB104", "Business Statistics", 1, Stream.COMMON),
    await subject("MB105", "Marketing Management", 2, Stream.COMMON),
    await subject("MB106", "Financial Management", 2, Stream.COMMON),
    await subject("MB107", "Organizational Behavior", 2, Stream.COMMON),
    await subject("MB108", "Operations Management", 2, Stream.COMMON),
    await subject("MB109", "Business Research Methods", 3, Stream.COMMON),
    await subject("MB110", "Human Resource Management", 3, Stream.COMMON),
    await subject("MB111", "Business Law", 3, Stream.COMMON),
    await subject("MB112", "Strategic Management", 3, Stream.COMMON),
  ];

  // Year 2 — specialisation streams (sem 4-6).
  const fn201 = await subject("FN201", "Security Analysis & Portfolio Mgmt", 4, Stream.FINANCE);
  const fn202 = await subject("FN202", "Corporate Finance", 4, Stream.FINANCE);
  await subject("FN203", "Financial Derivatives", 5, Stream.FINANCE);
  await subject("FN204", "Banking & Insurance", 5, Stream.FINANCE);
  await subject("FN205", "International Finance", 6, Stream.FINANCE);
  await subject("FN206", "Financial Risk Management", 6, Stream.FINANCE);

  await subject("HR201", "Talent Acquisition", 4, Stream.HR);
  await subject("HR202", "Compensation Management", 4, Stream.HR);
  await subject("HR203", "Industrial Relations", 5, Stream.HR);
  await subject("HR204", "Organizational Development", 5, Stream.HR);
  await subject("HR205", "Strategic HRM", 6, Stream.HR);
  await subject("HR206", "HR Analytics", 6, Stream.HR);

  await subject("TM201", "IT Project Management", 4, Stream.TECH_MANAGEMENT);
  await subject("TM202", "Business Analytics", 4, Stream.TECH_MANAGEMENT);
  await subject("TM203", "Digital Transformation", 5, Stream.TECH_MANAGEMENT);
  await subject("TM204", "Data Management", 5, Stream.TECH_MANAGEMENT);
  await subject("TM205", "Technology Strategy", 6, Stream.TECH_MANAGEMENT);
  await subject("TM206", "Cybersecurity Management", 6, Stream.TECH_MANAGEMENT);

  // Year 2 — Marketing, COMMON to all streams.
  const mk201 = await subject("MK201", "Consumer Behavior", 4, Stream.COMMON);
  await subject("MK202", "Digital Marketing", 5, Stream.COMMON);
  await subject("MK203", "Brand Management", 6, Stream.COMMON);

  // ---- Users ----
  await user("admin@iem.edu", "MBA Admin", Role.ADMIN, "admin123");
  const teachers = [];
  for (const [email, name] of [
    ["teacher1@iem.edu", "Dr. Sen"],
    ["teacher2@iem.edu", "Prof. Roy"],
    ["teacher3@iem.edu", "Dr. Mehta"],
    ["teacher4@iem.edu", "Prof. Iyer"],
    ["teacher5@iem.edu", "Dr. Khan"],
  ]) {
    teachers.push(await user(email, name, Role.TEACHER, "teach123"));
  }

  // ---- Offerings (a representative, testable subset) ----
  async function offer(subjectId: string, classSectionId: string, teacherId: string) {
    return prisma.offering.upsert({
      where: {
        subjectId_classSectionId_term: { subjectId, classSectionId, term: "2026-ODD" },
      },
      update: { teacherId },
      create: { subjectId, classSectionId, teacherId, term: "2026-ODD" },
    });
  }

  // Year 1 Sec A — all four sem-1 common subjects.
  for (let i = 0; i < 4; i++) {
    await offer(y1subjects[i].id, y1["A"].id, teachers[i % teachers.length].id);
  }
  // Year 2 Finance Sec A — sem-4 finance specialisation.
  await offer(fn201.id, finA.id, teachers[0].id);
  await offer(fn202.id, finA.id, teachers[1].id);
  // Year 2 Common — Marketing (sem 4), shared by all Year-2 students.
  await offer(mk201.id, y2common.id, teachers[2].id);

  // ---- Students + enrollments ----
  async function enroll(studentId: string, classSectionId: string) {
    await prisma.enrollment.upsert({
      where: { studentId_classSectionId: { studentId, classSectionId } },
      update: {},
      create: { studentId, classSectionId },
    });
  }

  // Year 1 Sec A students.
  for (let i = 1; i <= 6; i++) {
    const s = await user(`y1a${i}@iem.edu`, `Y1A Student ${i}`, Role.STUDENT, "stud123");
    await enroll(s.id, y1["A"].id);
  }
  // Year 2 Finance Sec A students — enrolled in their stream AND the common Marketing group.
  for (let i = 1; i <= 5; i++) {
    const s = await user(`fina${i}@iem.edu`, `Finance-A Student ${i}`, Role.STUDENT, "stud123");
    await enroll(s.id, finA.id);
    await enroll(s.id, y2common.id);
  }

  console.log("Done. Logins (password in parens):");
  console.log("  admin@iem.edu (admin123)");
  console.log("  teacher1..5@iem.edu (teach123)");
  console.log("  Year 1 Sec A students: y1a1..6@iem.edu (stud123)");
  console.log("  Year 2 Finance A students: fina1..5@iem.edu (stud123)");
  void [finB, hrA, tmA]; // sections created for structure; no offerings seeded yet
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
