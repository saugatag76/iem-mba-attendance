import { PrismaClient, Role, Stream, Weekday } from "@prisma/client";
import bcrypt from "bcryptjs";
import data from "./timetable-data.json";

const prisma = new PrismaClient();

const emailBase = (sectionName: string) =>
  sectionName.toLowerCase().replace(/[^a-z0-9]+/g, "");

async function main() {
  console.log("Seeding from timetable-data.json …");

  const dept = await prisma.department.upsert({
    where: { name: "Master of Business Administration (MBA)" },
    update: {},
    create: { name: "Master of Business Administration (MBA)" },
  });

  // --- Admin ---
  await prisma.user.upsert({
    where: { email: "admin@iem.edu" },
    update: { role: Role.ADMIN },
    create: {
      email: "admin@iem.edu",
      name: "MBA Admin",
      role: Role.ADMIN,
      passwordHash: await bcrypt.hash("admin123", 10),
    },
  });

  // --- Teachers (incl. "Staff / NA" + "Guest Faculty") ---
  const teachHash = await bcrypt.hash("teach123", 10);
  const teacherId = new Map<string, string>(); // initials -> userId
  for (const t of data.teachers) {
    const u = await prisma.user.upsert({
      where: { email: t.email },
      update: { name: t.name, role: Role.TEACHER },
      create: { email: t.email, name: t.name, role: Role.TEACHER, passwordHash: teachHash },
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

  // --- Sample students (5 per section) ---
  const studHash = await bcrypt.hash("stud123", 10);
  for (const sec of data.sections) {
    const csid = sectionId.get(sec.name)!;
    const base = emailBase(sec.name);
    for (let i = 1; i <= 5; i++) {
      const email = `${base}.s${i}@iem.edu`;
      const u = await prisma.user.upsert({
        where: { email },
        update: {},
        create: {
          email,
          name: `${sec.name} Student ${i}`,
          role: Role.STUDENT,
          passwordHash: studHash,
        },
      });
      await prisma.enrollment.upsert({
        where: { studentId_classSectionId: { studentId: u.id, classSectionId: csid } },
        update: {},
        create: { studentId: u.id, classSectionId: csid },
      });
    }
  }

  console.log(
    `Done. teachers=${data.teachers.length} subjects=${data.subjects.length} ` +
      `sections=${data.sections.length} offerings=${data.offerings.length} scheduled=${scheduled}`,
  );
  console.log("Logins:");
  console.log("  admin@iem.edu (admin123)");
  console.log("  teachers: <initials>@iem.edu (teach123) — e.g. nm@iem.edu, sc@iem.edu, kkg@iem.edu");
  console.log("  students: <section>.s1..5@iem.edu (stud123) — e.g. seca.s1@iem.edu, finance1.s1@iem.edu, hr.s1@iem.edu");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
