/*
 * Wipes all activity/test data before a real production launch, while keeping
 * the real roster (admin, real teachers, real students, academic structure)
 * and the demo pair fully intact.
 *
 * Removes entirely:
 *   - the fake `test@iem.edu.in` teacher account + its 4 offerings + 80 sessions
 *   - all Events (currently just the 1 leftover "Test Event")
 *   - every Session NOT under the "Demo Class" section (cascades its
 *     AttendanceRecords automatically) — these are feature-testing artifacts
 *     from this dev session on real teachers/sections, not real class attendance
 *   - all SubstitutionRequests and Notifications (also dev-session testing artifacts)
 *
 * Explicitly NOT touched: real User rows (admin/teachers/students), Enrollment,
 * Department/ClassSection/Subject/Offering (except test@iem.edu.in's)/ScheduledClass,
 * and everything under "Demo Class" (its 4 offerings, 53 sessions, 33 attendance records).
 *
 * Safety: always writes a full JSON backup of every row about to be deleted to
 * ./backups/ (gitignored) before touching anything — Neon's free tier has no
 * point-in-time recovery, so this is the only rollback path.
 *
 * Run:  npx tsx scripts/wipe-test-data.ts [--apply]
 * Without --apply it only prints a report + writes the backup (dry run, no deletes).
 */
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  const [substitutionRequests, notifications, events, sessions, testTeacher] = await Promise.all([
    prisma.substitutionRequest.findMany({}),
    prisma.notification.findMany({}),
    prisma.event.findMany({ include: { attendances: true } }),
    prisma.session.findMany({
      where: { offering: { classSection: { name: { not: "Demo Class" } } } },
      include: { records: true },
    }),
    prisma.user.findUnique({
      where: { email: "test@iem.edu.in" },
      include: { taughtOfferings: true, taughtSessions: true },
    }),
  ]);

  const attendanceRecordCount = sessions.reduce((a, s) => a + s.records.length, 0);

  const backup = { takenAt: new Date().toISOString(), substitutionRequests, notifications, events, sessions, testTeacher };
  const backupDir = path.join(process.cwd(), "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `wipe-test-data-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));

  console.log(`Backup written: ${backupPath} (${fs.statSync(backupPath).size} bytes)`);
  console.log(`\n${APPLY ? "APPLYING" : "DRY RUN — nothing deleted (pass --apply to write)"}`);
  console.log(`  SubstitutionRequest to delete: ${substitutionRequests.length}`);
  console.log(`  Notification to delete: ${notifications.length}`);
  console.log(`  Event to delete: ${events.length}`);
  console.log(`  Session to delete (non-Demo-Class): ${sessions.length}`);
  console.log(`  AttendanceRecord to delete (cascade via above sessions): ${attendanceRecordCount}`);
  console.log(`  test@iem.edu.in teacher: ${testTeacher ? `found (${testTeacher.taughtOfferings.length} offerings, ${testTeacher.taughtSessions.length} sessions)` : "not found (already clean)"}`);

  if (!APPLY) {
    await prisma.$disconnect();
    return;
  }

  const subRes = await prisma.substitutionRequest.deleteMany({});
  const notifRes = await prisma.notification.deleteMany({});
  const eventRes = await prisma.event.deleteMany({});
  const sessionRes = await prisma.session.deleteMany({
    where: { offering: { classSection: { name: { not: "Demo Class" } } } },
  });
  let offeringCount = 0;
  if (testTeacher) {
    const offRes = await prisma.offering.deleteMany({ where: { teacherId: testTeacher.id } });
    offeringCount = offRes.count;
    await prisma.user.delete({ where: { id: testTeacher.id } });
  }

  const [usersByRole, sessionCount, attendanceCount, eventCount, subReqCount, notifCount] = await Promise.all([
    prisma.user.groupBy({ by: ["role"], _count: true }),
    prisma.session.count(),
    prisma.attendanceRecord.count(),
    prisma.event.count(),
    prisma.substitutionRequest.count(),
    prisma.notification.count(),
  ]);

  console.log(`\nDone. Deleted: ${subRes.count} substitution requests, ${notifRes.count} notifications, ${eventRes.count} events, ${sessionRes.count} sessions, ${offeringCount} offerings, ${testTeacher ? 1 : 0} test teacher user.`);
  console.log(`\nAfter-state:`);
  for (const r of usersByRole) console.log(`  ${r.role}: ${r._count}`);
  console.log(`  Session: ${sessionCount}`);
  console.log(`  AttendanceRecord: ${attendanceCount}`);
  console.log(`  Event: ${eventCount}`);
  console.log(`  SubstitutionRequest: ${subReqCount}`);
  console.log(`  Notification: ${notifCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
