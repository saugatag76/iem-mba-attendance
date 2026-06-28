/**
 * Creates a fully synced demo environment:
 *   - demo.teacher@iem.edu  / demo123  (Teacher)
 *   - demo.student@iem.edu  / demo123  (Student, enrolled in demo class)
 *
 * The teacher has 4 subjects with realistic past attendance so reports
 * look rich. The student has varied attendance — good in some subjects,
 * at-risk in others — so every report view has meaningful content.
 *
 * Run:  npx tsx scripts/setup-demo-accounts.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pastWeekdays(count: number): Date[] {
  const dates: Date[] = [];
  const now = new Date();
  let back = 3;
  while (dates.length < count && back < 150) {
    const d = new Date(now);
    d.setDate(now.getDate() - back++);
    if (d.getDay() >= 1 && d.getDay() <= 5) dates.push(d);
  }
  return dates; // oldest first after reverse
}

async function main() {
  const hash = await bcrypt.hash("demo123", 10);

  const dept = await prisma.department.findFirst();
  if (!dept) throw new Error("Run the main seed first.");

  // ── 1. Demo Teacher ────────────────────────────────────────────────────────
  const teacher = await prisma.user.upsert({
    where: { email: "demo.teacher@iem.edu" },
    update: { name: "Demo Teacher", role: "TEACHER", passwordHash: hash },
    create: { email: "demo.teacher@iem.edu", name: "Demo Teacher", role: "TEACHER", passwordHash: hash },
  });
  console.log("✓ Teacher: demo.teacher@iem.edu / demo123");

  // ── 2. Demo Student ────────────────────────────────────────────────────────
  const student = await prisma.user.upsert({
    where: { email: "demo.student@iem.edu" },
    update: { name: "Demo Student", role: "STUDENT", passwordHash: hash },
    create: { email: "demo.student@iem.edu", name: "Demo Student", role: "STUDENT", passwordHash: hash },
  });
  console.log("✓ Student:  demo.student@iem.edu / demo123");

  // ── 3. Demo Class Section ─────────────────────────────────────────────────
  const section = await prisma.classSection.upsert({
    where: { departmentId_name: { departmentId: dept.id, name: "Demo Class" } },
    update: {},
    create: { name: "Demo Class", year: 1, stream: "COMMON", departmentId: dept.id },
  });
  console.log("✓ Section:  Demo Class");

  // Enroll demo student
  await prisma.enrollment.upsert({
    where: { studentId_classSectionId: { studentId: student.id, classSectionId: section.id } },
    update: {},
    create: { studentId: student.id, classSectionId: section.id },
  });

  // Also grab existing Sec A students to make the class feel fuller
  const secA = await prisma.classSection.findFirst({ where: { name: "Sec A" } });
  const extraStudents = secA
    ? (await prisma.enrollment.findMany({
        where: { classSectionId: secA.id },
        include: { student: true },
      })).map((e) => e.student)
    : [];
  for (const s of extraStudents) {
    await prisma.enrollment.upsert({
      where: { studentId_classSectionId: { studentId: s.id, classSectionId: section.id } },
      update: {},
      create: { studentId: s.id, classSectionId: section.id },
    });
  }
  const allStudents = [student, ...extraStudents];
  console.log(`✓ Enrolled: ${allStudents.length} students (demo + ${extraStudents.length} from Sec A)`);

  // ── 4. Subjects + Offerings ───────────────────────────────────────────────
  const subjectCodes = ["MBA171", "MBA172", "MBA173", "MBA101"];
  const subjects = await prisma.subject.findMany({ where: { code: { in: subjectCodes } } });

  const offerings = [];
  for (const subject of subjects) {
    const off = await prisma.offering.upsert({
      where: {
        subjectId_classSectionId_teacherId_term: {
          subjectId: subject.id,
          classSectionId: section.id,
          teacherId: teacher.id,
          term: "2026-T1",
        },
      },
      update: {},
      create: {
        subjectId: subject.id,
        classSectionId: section.id,
        teacherId: teacher.id,
        term: "2026-T1",
      },
    });
    offerings.push({ offering: off, subject });
    console.log(`✓ Offering: ${subject.code} ${subject.name}`);
  }

  // ── 5. Scheduled classes — one per weekday so demo works any day ──────────
  // Spread 4 subjects across 5 days (OB appears twice — Mon + Fri)
  const weekdaySlots: { day: string; subjectCode: string; slotIndex: number; start: string; end: string }[] = [
    { day: "MON", subjectCode: "MBA101", slotIndex: 1, start: "09:30", end: "10:20" },
    { day: "TUE", subjectCode: "MBA171", slotIndex: 2, start: "10:20", end: "11:10" },
    { day: "WED", subjectCode: "MBA172", slotIndex: 3, start: "11:10", end: "12:00" },
    { day: "THU", subjectCode: "MBA173", slotIndex: 4, start: "12:00", end: "12:50" },
    { day: "FRI", subjectCode: "MBA101", slotIndex: 5, start: "13:40", end: "14:30" },
  ];

  // Remove old demo scheduled classes first
  const demoOfferingIds = offerings.map((o) => o.offering.id);
  await prisma.scheduledClass.deleteMany({ where: { offeringId: { in: demoOfferingIds } } });

  for (const ws of weekdaySlots) {
    const match = offerings.find((o) => o.subject.code === ws.subjectCode);
    if (!match) continue;
    await prisma.scheduledClass.create({
      data: {
        classSectionId: section.id,
        offeringId: match.offering.id,
        day: ws.day as "MON" | "TUE" | "WED" | "THU" | "FRI",
        slotIndex: ws.slotIndex,
        startTime: ws.start,
        endTime: ws.end,
        rawLabel: `${match.subject.name} (Demo Teacher)`,
      },
    });
    console.log(`✓ Schedule: ${ws.day} ${ws.start}–${ws.end} → ${match.subject.code}`);
  }

  // ── 6. Past sessions + attendance ─────────────────────────────────────────
  // Demo student attendance per subject: 90%, 75%, 60%, 40%
  // so reports show a healthy subject, borderline, at-risk, and a defaulter
  const demoStudentRates: Record<string, number> = {
    MBA171: 0.90,
    MBA172: 0.75,
    MBA173: 0.60,
    MBA101: 0.40,
  };
  // Other enrolled students: varied rates for realistic class view
  const EXTRA_RATES = [0.95, 0.85, 0.70, 0.55, 0.35];

  const SESSIONS_PER = 12;
  const dates = pastWeekdays(SESSIONS_PER * 3).reverse().slice(0, SESSIONS_PER * 2);
  const slotTimes = ["09:30", "10:20", "11:10", "12:00", "13:40", "14:30"];

  let totalSessions = 0;
  let totalRecords = 0;

  // Remove any old dummy sessions for this teacher in this section
  const oldSessions = await prisma.session.findMany({
    where: { teacherId: teacher.id, offering: { classSectionId: section.id } },
    select: { id: true },
  });
  if (oldSessions.length) {
    await prisma.attendanceRecord.deleteMany({ where: { sessionId: { in: oldSessions.map((s) => s.id) } } });
    await prisma.session.deleteMany({ where: { id: { in: oldSessions.map((s) => s.id) } } });
  }

  for (const { offering, subject } of offerings) {
    const step = Math.max(1, Math.floor(dates.length / SESSIONS_PER));
    const sessionDates = Array.from({ length: SESSIONS_PER }, (_, i) =>
      dates[Math.min(i * step, dates.length - 1)],
    );
    const demoRate = demoStudentRates[subject.code] ?? 0.75;

    for (const date of sessionDates) {
      const slotTime = slotTimes[rand(0, slotTimes.length - 1)];
      const [h, m] = slotTime.split(":").map(Number);
      const start = new Date(date);
      start.setHours(h, m, 0, 0);
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + 50);

      const session = await prisma.session.create({
        data: {
          offeringId: offering.id,
          teacherId: teacher.id,
          date: start,
          startTime: start,
          endTime: end,
          status: "CLOSED",
        },
      });

      // Demo student
      if (Math.random() < demoRate) {
        const at = new Date(start);
        at.setMinutes(at.getMinutes() + rand(0, 10));
        await prisma.attendanceRecord.create({
          data: { sessionId: session.id, studentId: student.id, status: "PRESENT", method: "QR", scannedAt: at },
        });
        totalRecords++;
      }

      // Extra students
      for (let i = 0; i < extraStudents.length; i++) {
        const rate = EXTRA_RATES[i % EXTRA_RATES.length];
        if (Math.random() < rate) {
          const at = new Date(start);
          at.setMinutes(at.getMinutes() + rand(0, 12));
          await prisma.attendanceRecord.create({
            data: { sessionId: session.id, studentId: extraStudents[i].id, status: "PRESENT", method: "QR", scannedAt: at },
          });
          totalRecords++;
        }
      }
      totalSessions++;
    }
  }

  console.log(`\n✅ Demo environment ready!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  TEACHER   demo.teacher@iem.edu / demo123
  STUDENT   demo.student@iem.edu / demo123
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Class:    Demo Class (${allStudents.length} students)
  Subjects: ${offerings.map((o) => o.subject.code).join(", ")}
  Sessions: ${totalSessions} past sessions, ${totalRecords} attendance records

  Demo student attendance (for interesting reports):
    OB            (MBA171): 90%  — good
    Communication (MBA172): 75%  — borderline
    CAB           (MBA173): 60%  — at risk
    Mathematics   (MBA101): 40%  — defaulter

  LIVE DEMO FLOW:
  1. Login as Demo Teacher → My Day → Open session (no location needed)
  2. Login as Demo Student on another device → Scan → point at QR
  3. Teacher sees student appear in live roster instantly
  4. Close session → Reports show full attendance register
`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
