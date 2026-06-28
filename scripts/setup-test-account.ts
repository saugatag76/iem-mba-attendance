/**
 * 1. Removes all dummy sessions for NM (seed-nm-sessions.ts) and SAG (seed-sag-reports.ts).
 * 2. Creates a dedicated test teacher account (test@iem.edu) with realistic dummy
 *    offerings, sessions, and varied attendance so every report view has data.
 *
 * Run:  npx tsx scripts/setup-test-account.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Past weekday dates, most recent first
function pastWeekdays(count: number): Date[] {
  const dates: Date[] = [];
  const now = new Date();
  let daysBack = 2; // start from 2 days ago
  while (dates.length < count) {
    const d = new Date(now);
    d.setDate(now.getDate() - daysBack);
    if (d.getDay() >= 1 && d.getDay() <= 5) dates.push(d);
    daysBack++;
    if (daysBack > 120) break;
  }
  return dates;
}

// Per-student attendance pattern — makes reports interesting (defaulters, risk, good)
const ATTENDANCE_RATES = [0.95, 0.85, 0.72, 0.55, 0.30];

async function main() {
  // ── 1. Remove dummy sessions for NM and SAG ────────────────────────────────
  console.log("Removing dummy sessions for NM and SAG…");
  for (const email of ["nm@iem.edu", "sag@iem.edu"]) {
    const teacher = await prisma.user.findUnique({ where: { email } });
    if (!teacher) continue;
    const sessions = await prisma.session.findMany({
      where: { teacherId: teacher.id },
      select: { id: true },
    });
    const ids = sessions.map((s) => s.id);
    if (ids.length) {
      await prisma.attendanceRecord.deleteMany({ where: { sessionId: { in: ids } } });
      await prisma.session.deleteMany({ where: { id: { in: ids } } });
      console.log(`  ✓ Removed ${ids.length} sessions for ${teacher.name}`);
    }
  }

  // ── 2. Create test teacher ─────────────────────────────────────────────────
  console.log("\nCreating test teacher account…");
  const dept = await prisma.department.findFirst();
  if (!dept) throw new Error("No department found — run seed first.");

  const hash = await bcrypt.hash("teach123", 10);
  const testTeacher = await prisma.user.upsert({
    where: { email: "test@iem.edu" },
    update: { name: "Test Teacher", role: "TEACHER" },
    create: { email: "test@iem.edu", name: "Test Teacher", role: "TEACHER", passwordHash: hash },
  });
  console.log(`  ✓ test@iem.edu (password: teach123)`);

  // ── 3. Find subjects + sections to create offerings for ───────────────────
  // Use existing Year-1 sections (Sec A + Sec B) and a variety of subjects
  const [secA, secB] = await Promise.all([
    prisma.classSection.findFirst({ where: { name: "Sec A" } }),
    prisma.classSection.findFirst({ where: { name: "Sec B" } }),
  ]);
  if (!secA || !secB) throw new Error("Sec A/B not found — run seed first.");

  const subjectCodes = ["MBA171", "MBA172", "MBA173", "MBA174"];
  const subjects = await prisma.subject.findMany({ where: { code: { in: subjectCodes } } });
  if (subjects.length === 0) throw new Error("Subjects not found.");

  // ── 4. Create offerings (one per subject per section) ─────────────────────
  console.log("\nCreating offerings…");
  const offerings: Awaited<ReturnType<typeof prisma.offering.findMany>> = [];
  for (const section of [secA, secB]) {
    for (const subject of subjects) {
      const off = await prisma.offering.upsert({
        where: {
          subjectId_classSectionId_teacherId_term: {
            subjectId: subject.id,
            classSectionId: section.id,
            teacherId: testTeacher.id,
            term: "2026-T1",
          },
        },
        update: {},
        create: {
          subjectId: subject.id,
          classSectionId: section.id,
          teacherId: testTeacher.id,
          term: "2026-T1",
        },
      });
      offerings.push(off);
      console.log(`  ✓ ${subject.code} ${subject.name} → ${section.name}`);
    }
  }

  // ── 5. Find enrolled students ─────────────────────────────────────────────
  const enrollmentsA = await prisma.enrollment.findMany({
    where: { classSectionId: secA.id },
    include: { student: true },
    orderBy: { student: { name: "asc" } },
  });
  const enrollmentsB = await prisma.enrollment.findMany({
    where: { classSectionId: secB.id },
    include: { student: true },
    orderBy: { student: { name: "asc" } },
  });
  const studentsBySection: Record<string, typeof enrollmentsA[number]["student"][]> = {
    [secA.id]: enrollmentsA.map((e) => e.student),
    [secB.id]: enrollmentsB.map((e) => e.student),
  };

  // ── 6. Create sessions + attendance records ─────────────────────────────
  console.log("\nSeeding sessions and attendance…");
  const SESSIONS_PER_OFFERING = 10;
  const dates = pastWeekdays(SESSIONS_PER_OFFERING * 3);
  let totalSessions = 0;
  let totalRecords = 0;

  const slotTimes = ["09:30", "10:20", "11:10", "12:00", "13:40", "14:30"];

  for (const offering of offerings) {
    const students = studentsBySection[offering.classSectionId] ?? [];
    if (students.length === 0) continue;

    // Pick evenly-spread dates for this offering
    const step = Math.max(1, Math.floor(dates.length / SESSIONS_PER_OFFERING));
    const sessionDates = Array.from({ length: SESSIONS_PER_OFFERING }, (_, i) =>
      dates[Math.min(i * step, dates.length - 1)],
    );

    for (const date of sessionDates) {
      const slotTime = slotTimes[randomBetween(0, slotTimes.length - 1)];
      const [h, m] = slotTime.split(":").map(Number);
      const start = new Date(date);
      start.setHours(h, m, 0, 0);
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + 50);

      const session = await prisma.session.create({
        data: {
          offeringId: offering.id,
          teacherId: testTeacher.id,
          date: start,
          startTime: start,
          endTime: end,
          status: "CLOSED",
        },
      });

      // Each student has a fixed attendance rate → realistic report variety
      for (let si = 0; si < students.length; si++) {
        const rate = ATTENDANCE_RATES[si % ATTENDANCE_RATES.length];
        if (Math.random() < rate) {
          const scannedAt = new Date(start);
          scannedAt.setMinutes(scannedAt.getMinutes() + randomBetween(0, 12));
          await prisma.attendanceRecord.create({
            data: {
              sessionId: session.id,
              studentId: students[si].id,
              status: "PRESENT",
              method: "QR",
              scannedAt,
            },
          });
          totalRecords++;
        }
      }
      totalSessions++;
    }

    const subj = subjects.find((s) => s.id === offering.subjectId);
    const sect = [secA, secB].find((s) => s.id === offering.classSectionId);
    console.log(`  ✓ ${subj?.code} ${sect?.name} — ${SESSIONS_PER_OFFERING} sessions`);
  }

  console.log(`\n✅ Done!
  Test teacher:  test@iem.edu  /  teach123
  Offerings:     ${offerings.length} (${subjects.length} subjects × 2 sections)
  Sessions:      ${totalSessions}
  Attendance:    ${totalRecords} records
  Students:      ${enrollmentsA.length} in Sec A, ${enrollmentsB.length} in Sec B
  Attendance rates: ${ATTENDANCE_RATES.map((r) => Math.round(r * 100) + "%").join(", ")} (per student slot)
  `);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
