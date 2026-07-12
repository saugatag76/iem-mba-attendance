// Populates dummy sessions + attendance records for Prof. Saugata Ghosh's offerings,
// so the Reports tab (overview/trend/per-subject/per-student) has realistic data to preview.
import { PrismaClient, AttendanceStatus, AttendanceMethod, SessionStatus } from "@prisma/client";

const prisma = new PrismaClient();

const SESSIONS_PER_OFFERING = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

// Per-student attendance "skill" — index into enrollments (sorted by student name).
// Mix of strong, average, and at-risk students so reports show variety + defaulters.
const ATTENDANCE_RATE = [0.95, 0.85, 0.7, 0.55, 0.35];

// ScheduledClass.day -> JS Date.getDay() index.
const DAY_INDEX: Record<string, number> = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };

// Schedule times are written in 12-hour form without AM/PM (college day runs ~09:30-16:10).
// Hours 1-7 are always afternoon/evening, so normalize those to 24-hour PM.
function withTime(date: Date, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const hour24 = h >= 1 && h <= 7 ? h + 12 : h;
  const d = new Date(date);
  d.setHours(hour24, m, 0, 0);
  return d;
}

/** Past occurrences (most recent first) of a weekly slot, ending at least 2 days before now. */
function pastOccurrences(dayCode: string, count: number): Date[] {
  const targetDow = DAY_INDEX[dayCode];
  const cutoff = new Date(Date.now() - 2 * DAY_MS);
  const diff = (cutoff.getDay() - targetDow + 7) % 7;
  const mostRecent = new Date(cutoff.getTime() - diff * DAY_MS);
  return Array.from({ length: count }, (_, w) => new Date(mostRecent.getTime() - w * 7 * DAY_MS));
}

async function main() {
  const teacher = await prisma.user.findUnique({ where: { email: "sag@iem.edu.in" } });
  if (!teacher) throw new Error("Prof. Saugata Ghosh (sag@iem.edu.in) not found — run the main seed first.");

  const offerings = await prisma.offering.findMany({
    where: { teacherId: teacher.id },
    include: {
      subject: true,
      classSection: { include: { enrollments: { include: { student: true } } } },
      schedule: true,
    },
  });

  console.log(`Found ${offerings.length} offering(s) for ${teacher.name}`);

  // Wipe any existing sessions for these offerings (cascades to attendance records)
  // so this script can be re-run cleanly.
  await prisma.session.deleteMany({ where: { offeringId: { in: offerings.map((o) => o.id) } } });

  for (const o of offerings) {
    const students = [...o.classSection.enrollments]
      .map((e) => e.student)
      .sort((a, b) => a.name.localeCompare(b.name));

    if (students.length === 0) {
      console.log(`  ${o.subject.code} ${o.classSection.name}: no enrolled students, skipping`);
      continue;
    }

    // De-dupe weekly slots (lab subgroups repeat the same day/time twice).
    const slots = new Map<string, { day: string; start: string; end: string }>();
    for (const sc of o.schedule) {
      slots.set(`${sc.day}|${sc.startTime}|${sc.endTime}`, { day: sc.day, start: sc.startTime, end: sc.endTime });
    }
    if (slots.size === 0) {
      console.log(`  ${o.subject.code} ${o.classSection.name}: no weekly slot scheduled, skipping`);
      continue;
    }

    const weeksPerSlot = Math.ceil(SESSIONS_PER_OFFERING / slots.size);
    const sessionDates = [...slots.values()]
      .flatMap((slot) => pastOccurrences(slot.day, weeksPerSlot).map((d) => ({ date: withTime(d, slot.start), end: slot.end })))
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, SESSIONS_PER_OFFERING)
      .reverse();

    for (const { date, end } of sessionDates) {
      const endTime = withTime(date, end);

      const session = await prisma.session.create({
        data: {
          offeringId: o.id,
          teacherId: teacher.id,
          date,
          startTime: date,
          endTime,
          status: SessionStatus.CLOSED,
          geoRadiusM: 75,
        },
      });

      for (let si = 0; si < students.length; si++) {
        const student = students[si];
        const rate = ATTENDANCE_RATE[si % ATTENDANCE_RATE.length];
        if (Math.random() > rate) continue; // absent — no record

        const scannedAt = new Date(date.getTime() + Math.floor(Math.random() * 10) * 60 * 1000);
        await prisma.attendanceRecord.create({
          data: {
            sessionId: session.id,
            studentId: student.id,
            status: Math.random() < 0.08 ? AttendanceStatus.LATE : AttendanceStatus.PRESENT,
            method: Math.random() < 0.1 ? AttendanceMethod.MANUAL : AttendanceMethod.QR,
            scannedAt,
          },
        });
      }
    }

    const dayList = [...slots.values()].map((s) => `${s.day} ${s.start}`).join(", ");
    console.log(`  ${o.subject.code} ${o.classSection.name}: ${sessionDates.length} sessions (${dayList}), ${students.length} students`);
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
