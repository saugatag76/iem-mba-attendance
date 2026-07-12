import { PrismaClient, Role, Stream, Weekday } from "@prisma/client";
import bcrypt from "bcryptjs";
import data from "./timetable-data.json";

const prisma = new PrismaClient();

// Unique 6-digit personal code generator (in-memory dedupe within a seed run).
const takenCodes = new Set<string>();
function personalCode(): string {
  let c = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
  while (takenCodes.has(c)) c = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
  takenCodes.add(c);
  return c;
}

async function main() {
  console.log("Seeding from timetable-data.json …");

  const dept = await prisma.department.upsert({
    where: { name: "Master of Business Administration (MBA)" },
    update: {},
    create: { name: "Master of Business Administration (MBA)" },
  });

  // --- Admin ---
  await prisma.user.upsert({
    where: { email: "admin@iem.edu.in" },
    update: { role: Role.ADMIN },
    create: {
      email: "admin@iem.edu.in",
      name: "MBA Admin",
      role: Role.ADMIN,
      passwordHash: await bcrypt.hash("Admin@2026", 10),
      personalCode: personalCode(),
    },
  });

  // --- Teachers (incl. "Staff / NA" + "Guest Faculty") ---
  const teachHash = await bcrypt.hash("Teacher@2026", 10);
  const teacherId = new Map<string, string>(); // initials -> userId
  for (const t of data.teachers) {
    const u = await prisma.user.upsert({
      where: { email: t.email },
      update: { name: t.name, role: Role.TEACHER },
      create: { email: t.email, name: t.name, role: Role.TEACHER, passwordHash: teachHash, personalCode: personalCode() },
    });
    teacherId.set(t.initials, u.id);
  }

  // --- Subjects ---
  const subjectId = new Map<string, string>();
  for (const s of data.subjects) {
    const subj = await prisma.subject.upsert({
      where: { departmentId_code: { departmentId: dept.id, code: s.code } },
      update: { name: s.name, semester: s.semester, stream: s.stream as Stream },
      create: {
        code: s.code,
        name: s.name,
        semester: s.semester,
        stream: s.stream as Stream,
        departmentId: dept.id,
      },
    });
    subjectId.set(s.code, subj.id);
  }

  // --- Sections ---
  const sectionId = new Map<string, string>();
  const sectionYear = new Map<string, number>();
  for (const sec of data.sections) {
    const cs = await prisma.classSection.upsert({
      where: { departmentId_name: { departmentId: dept.id, name: sec.name } },
      update: { year: sec.year, stream: sec.stream as Stream },
      create: { name: sec.name, year: sec.year, stream: sec.stream as Stream, departmentId: dept.id },
    });
    sectionId.set(sec.name, cs.id);
    sectionYear.set(sec.name, sec.year);
  }

  // --- Offerings ---
  const offeringId = new Map<string, string>();
  for (const o of data.offerings) {
    const sid = subjectId.get(o.subjectCode);
    const csid = sectionId.get(o.sectionName);
    const tid = teacherId.get(o.teacherInitials) ?? teacherId.get("NA");
    if (!sid || !csid || !tid) continue;
    const off = await prisma.offering.upsert({
      where: { subjectId_classSectionId_teacherId_term: { subjectId: sid, classSectionId: csid, teacherId: tid, term: o.term } },
      update: {},
      create: { subjectId: sid, classSectionId: csid, teacherId: tid, term: o.term },
    });
    offeringId.set(`${o.subjectCode}|${o.sectionName}|${o.teacherInitials}|${o.term}`, off.id);
  }

  // --- Weekly schedule ---
  await prisma.scheduledClass.deleteMany({});
  let scheduled = 0;
  for (const e of data.schedule) {
    const csid = sectionId.get(e.sectionName);
    if (!csid) continue;
    const term = sectionYear.get(e.sectionName) === 1 ? "2026-T1" : "2026-T4";
    const offId = offeringId.get(`${e.subjectCode}|${e.sectionName}|${e.teacherInitials}|${term}`) ?? null;
    await prisma.scheduledClass.create({
      data: {
        classSectionId: csid,
        day: e.day as Weekday,
        slotIndex: e.slotIndex,
        startTime: e.startTime,
        endTime: e.endTime,
        offeringId: offId,
        subgroup: e.subgroup ?? null,
        rawLabel: e.rawLabel,
      },
    });
    scheduled++;
  }

  // Students are the real admitted roster, imported separately via
  // scripts/import-real-students.ts — this seed never creates dummy students,
  // so it can't overwrite the real roster on a re-run.

  console.log(
    `Done. teachers=${data.teachers.length} subjects=${data.subjects.length} ` +
      `sections=${data.sections.length} offerings=${data.offerings.length} scheduled=${scheduled}`,
  );
  console.log("Logins:");
  console.log("  admin@iem.edu.in (see lib/studentDefaults.ts sibling constant / rotate script for current password)");
  console.log("  teachers: <initials>@iem.edu.in — e.g. nm@iem.edu.in, sc@iem.edu.in, kkg@iem.edu.in (password set above, not printed)");
  console.log("  students: real roster imported via scripts/import-real-students.ts (see that script for the default password).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
