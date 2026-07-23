/*
 * Permanently removes students who left/withdrew from the program, per a list
 * provided by the admin (name, phone, email, program, status="L").
 *
 * Safety:
 *   - Matches by phone number only (the reliable, unique key).
 *   - Writes a full JSON backup (record + enrollments + attendance +
 *     event attendance) to ./backups/ before deleting anything.
 *   - Deletes EventAttendance rows first (no onDelete cascade on that
 *     relation — same precaution as scripts/import-real-students.ts), then
 *     the User row itself, which cascades Enrollment + AttendanceRecord.
 *   - Reports any phone number from the list that doesn't match a real
 *     student instead of silently skipping it.
 *
 * Run:  npx tsx scripts/remove-withdrawn-students.ts [--apply]
 * Without --apply it only prints a report (dry run, no writes).
 */
import fs from "fs";
import path from "path";
import { prisma } from "../lib/prisma";

const APPLY = process.argv.includes("--apply");

const WITHDRAWN: { name: string; phone: string }[] = [
  { name: "TITLI DEY", phone: "8017350388" },
  { name: "RUDRADIP HALDAR", phone: "6291356676" },
  { name: "HARSITA BHOWMIK", phone: "7640832697" },
  { name: "AGNIDH SINHA HALDAR", phone: "9832825473" },
  { name: "Anirban barik", phone: "9635410270" },
  { name: "Abhishek kumar rai", phone: "7003141449" },
  { name: "SNEHAL GUHA ROY", phone: "7439480584" },
  { name: "DISHA ROY", phone: "9874322722" },
  { name: "SUBHAM BHATTACHARYA", phone: "8017841579" },
  { name: "SUJAN SAHA", phone: "7001267652" },
  { name: "SUSMITA BERA", phone: "8653020628" },
  { name: "GAIRIK DUTTA", phone: "9064918052" },
  { name: "SOUNAMI MAITY", phone: "6294166119" },
  { name: "VINAY MUKHERJEE", phone: "7866940345" },
  { name: "ANAMITRA CHAKRABORTY", phone: "9051461075" },
  { name: "SOUVIK BISWAS", phone: "8637566365" },
  { name: "ASMI DAS", phone: "9641474173" },
  { name: "SHIVAM KUMAR PATHAK", phone: "6299805456" },
  { name: "PRANJAL GOSWAMI", phone: "8638248578" },
  { name: "TUSHAR PRAMANICK", phone: "9064648527" },
  { name: "KAZI TITAS TANVEER", phone: "8597416147" },
  { name: "AJAY GUPTA", phone: "9523453710" },
];

async function main() {
  const phones = WITHDRAWN.map((w) => w.phone);
  const students = await prisma.user.findMany({
    where: { phone: { in: phones } },
    include: {
      enrollments: { include: { classSection: true } },
      attendanceRecords: true,
      eventAttendances: true,
    },
  });

  const foundByPhone = new Map(students.map((s) => [s.phone!, s]));
  const notFound = WITHDRAWN.filter((w) => !foundByPhone.has(w.phone));

  console.log(`${APPLY ? "APPLYING" : "DRY RUN — nothing deleted (pass --apply to write)"}`);
  console.log(`\nMatched: ${students.length} of ${WITHDRAWN.length}`);
  if (notFound.length) {
    console.log(`NOT FOUND (no student with this phone — skipped):`);
    for (const w of notFound) console.log(`  ${w.phone}  ${w.name}`);
  }

  console.log(`\nTo remove:`);
  for (const w of WITHDRAWN) {
    const s = foundByPhone.get(w.phone);
    if (!s) continue;
    const sections = s.enrollments.map((e) => e.classSection.name).join(", ") || "(none)";
    console.log(`  ${s.name}  (${s.phone})  section: ${sections}  attendance: ${s.attendanceRecords.length}  eventAttendance: ${s.eventAttendances.length}`);
  }

  if (students.length === 0) {
    console.log("\nNothing to do.");
    await prisma.$disconnect();
    return;
  }

  // Backup before touching anything.
  const backupDir = path.join(process.cwd(), "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `remove-withdrawn-students-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(backupPath, JSON.stringify({ takenAt: new Date().toISOString(), students }, null, 2));
  console.log(`\nBackup written: ${backupPath}`);

  if (!APPLY) {
    await prisma.$disconnect();
    return;
  }

  for (const s of students) {
    await prisma.eventAttendance.deleteMany({ where: { studentId: s.id } });
    await prisma.user.delete({ where: { id: s.id } });
  }

  const remaining = await prisma.user.count({ where: { phone: { in: phones } } });
  console.log(`\nDone. Deleted: ${students.length}. Remaining matches (should be 0): ${remaining}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
