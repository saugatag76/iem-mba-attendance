/**
 * Seeds realistic dummy attendance sessions for Dr. Nivedita Mandal (nm@iem.edu.in).
 * Generates 8 sessions per offering over the past 6 weeks with varied attendance.
 * Run:  npx tsx scripts/seed-nm-sessions.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Past dates spread across 6 weeks (skip weekends)
function pastDates(count: number): Date[] {
  const dates: Date[] = [];
  const now = new Date();
  let daysBack = 1;
  while (dates.length < count) {
    const d = new Date(now);
    d.setDate(now.getDate() - daysBack);
    const day = d.getDay();
    if (day >= 1 && day <= 5) dates.push(d); // weekdays only
    daysBack++;
    if (daysBack > 90) break;
  }
  return dates.reverse(); // oldest first
}

async function main() {
  const teacher = await prisma.user.findUniqueOrThrow({ where: { email: "nm@iem.edu.in" } });

  const offerings = await prisma.offering.findMany({
    where: { teacherId: teacher.id },
    include: {
      subject: true,
      classSection: { include: { enrollments: { include: { student: true } } } },
    },
  });

  const SESSIONS_PER_OFFERING = 8;
  const allDates = pastDates(SESSIONS_PER_OFFERING * 2); // pool of dates to draw from

  let totalSessions = 0;
  let totalRecords = 0;

  for (const offering of offerings) {
    const students = offering.classSection.enrollments.map((e) => e.student);
    if (students.length === 0) continue;

    // Pick SESSIONS_PER_OFFERING evenly spread dates
    const step = Math.max(1, Math.floor(allDates.length / SESSIONS_PER_OFFERING));
    const sessionDates = Array.from({ length: SESSIONS_PER_OFFERING }, (_, i) =>
      allDates[Math.min(i * step, allDates.length - 1)],
    );

    for (const date of sessionDates) {
      const sessionStart = new Date(date);
      sessionStart.setHours(9, 30, 0, 0);
      const sessionEnd = new Date(date);
      sessionEnd.setHours(10, 20, 0, 0);

      const session = await prisma.session.create({
        data: {
          offeringId: offering.id,
          teacherId: teacher.id,
          date: sessionStart,
          startTime: sessionStart,
          endTime: sessionEnd,
          status: "CLOSED",
          // No geofence for dummy data
        },
      });

      // Random attendance: 60–100% presence per session
      const presentCount = randomBetween(
        Math.ceil(students.length * 0.6),
        students.length,
      );
      const presentStudents = [...students]
        .sort(() => Math.random() - 0.5)
        .slice(0, presentCount);

      for (const student of presentStudents) {
        const scannedAt = new Date(sessionStart);
        scannedAt.setMinutes(scannedAt.getMinutes() + randomBetween(0, 15));
        await prisma.attendanceRecord.create({
          data: {
            sessionId: session.id,
            studentId: student.id,
            status: "PRESENT",
            method: "QR",
            scannedAt,
          },
        });
        totalRecords++;
      }

      totalSessions++;
    }

    console.log(
      `  ✓ ${offering.subject.code} ${offering.classSection.name} — ${SESSIONS_PER_OFFERING} sessions, ${students.length} students`,
    );
  }

  console.log(`\nDone. Created ${totalSessions} sessions, ${totalRecords} attendance records for ${teacher.name}.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
