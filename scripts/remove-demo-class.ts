/*
 * Full cleanup of the "Demo Class" section ahead of production launch — removes
 * the synthetic section entirely (its offerings, scheduled classes, past
 * sessions/attendance, enrollments) AND the two accounts that only exist to
 * power it: demo.teacher@iem.edu.in and demo.student@iem.edu.
 *
 * Deleting the ClassSection cascades (DB-level onDelete: Cascade) through
 * Offering → Session → AttendanceRecord, Enrollment, and ScheduledClass →
 * SubstitutionRequest — see prisma/schema.prisma. The two demo Users are then
 * deleted directly; this fails loudly if either is still referenced by a
 * SubstitutionRequest/Event/Notification outside Demo Class, which the dry
 * run reports up front.
 *
 * Safety: writes a full JSON backup of everything about to be deleted to
 * ./backups/ (gitignored) before touching anything — Neon's free tier has no
 * point-in-time recovery, so this is the only rollback path.
 *
 * Run:  npx tsx scripts/remove-demo-class.ts [--apply]
 * Without --apply it only prints a report + writes the backup (dry run, no deletes).
 */
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  const section = await prisma.classSection.findFirst({
    where: { name: "Demo Class" },
    include: {
      offerings: { include: { subject: true, sessions: { include: { records: true } } } },
      enrollments: { include: { student: true } },
      schedule: { include: { substitutionRequests: true } },
    },
  });

  const demoTeacher = await prisma.user.findUnique({
    where: { email: "demo.teacher@iem.edu.in" },
    include: {
      substitutionRequestsCreated: true,
      substitutionRequestsAssigned: true,
      substitutionRequestsApproved: true,
      eventsCreated: true,
      eventsApproved: true,
    },
  });
  const demoStudent = await prisma.user.findUnique({
    where: { email: "demo.student@iem.edu" },
    include: { eventAttendances: true, notifications: true },
  });

  if (!section) {
    console.log('No "Demo Class" section found — already clean.');
  }

  const sessionCount = section?.offerings.reduce((a, o) => a + o.sessions.length, 0) ?? 0;
  const attendanceCount = section?.offerings.reduce((a, o) => a + o.sessions.reduce((b, s) => b + s.records.length, 0), 0) ?? 0;
  const subReqCount = section?.schedule.reduce((a, sc) => a + sc.substitutionRequests.length, 0) ?? 0;

  // Anything that would block deleting the two demo users once the section (and
  // everything under it) is gone — i.e. references from OUTSIDE Demo Class.
  const teacherBlockers =
    (demoTeacher?.substitutionRequestsCreated.length ?? 0) +
    (demoTeacher?.substitutionRequestsAssigned.length ?? 0) +
    (demoTeacher?.substitutionRequestsApproved.length ?? 0) +
    (demoTeacher?.eventsCreated.length ?? 0) +
    (demoTeacher?.eventsApproved.length ?? 0);
  const studentBlockers = (demoStudent?.eventAttendances.length ?? 0);

  const backup = { takenAt: new Date().toISOString(), section, demoTeacher, demoStudent };
  const backupDir = path.join(process.cwd(), "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `remove-demo-class-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`Backup written: ${backupPath} (${fs.statSync(backupPath).size} bytes)`);

  console.log(`\n${APPLY ? "APPLYING" : "DRY RUN — nothing deleted (pass --apply to write)"}`);
  console.log(`  ClassSection "Demo Class": ${section ? "found" : "not found"}`);
  console.log(`  Offerings: ${section?.offerings.length ?? 0}`);
  console.log(`  ScheduledClass rows: ${section?.schedule.length ?? 0}`);
  console.log(`  Sessions: ${sessionCount}`);
  console.log(`  AttendanceRecords: ${attendanceCount}`);
  console.log(`  Enrollments (demo student + borrowed Sec A students): ${section?.enrollments.length ?? 0}`);
  console.log(`  SubstitutionRequests tied to Demo Class slots: ${subReqCount}`);
  console.log(`  demo.teacher@iem.edu.in: ${demoTeacher ? "found" : "not found"}${teacherBlockers ? ` — ${teacherBlockers} references OUTSIDE Demo Class would block user deletion` : ""}`);
  console.log(`  demo.student@iem.edu: ${demoStudent ? "found" : "not found"}${studentBlockers ? ` — ${studentBlockers} references OUTSIDE Demo Class would block user deletion` : ""}`);

  if (!APPLY) {
    await prisma.$disconnect();
    return;
  }

  if (section) {
    await prisma.classSection.delete({ where: { id: section.id } });
  }
  if (demoTeacher) {
    await prisma.user.delete({ where: { id: demoTeacher.id } });
  }
  if (demoStudent) {
    await prisma.user.delete({ where: { id: demoStudent.id } });
  }

  const [usersByRole, sectionCount, sessionCountAfter, attendanceCountAfter] = await Promise.all([
    prisma.user.groupBy({ by: ["role"], _count: true }),
    prisma.classSection.count(),
    prisma.session.count(),
    prisma.attendanceRecord.count(),
  ]);

  console.log(`\nDone. Demo Class and its 2 accounts removed.`);
  console.log(`\nAfter-state:`);
  for (const r of usersByRole) console.log(`  ${r.role}: ${r._count}`);
  console.log(`  ClassSection: ${sectionCount}`);
  console.log(`  Session: ${sessionCountAfter}`);
  console.log(`  AttendanceRecord: ${attendanceCountAfter}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
