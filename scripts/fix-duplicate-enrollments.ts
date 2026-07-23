/*
 * One-off fix for a bug in the bulk import (app/admin/import/actions.ts):
 * re-enrolling an EXISTING student into a new class section only ever added a
 * second Enrollment row instead of replacing their old one — breaking the
 * single-section model every other part of the app assumes (admin Students
 * page shows `enrollments[0]`, so the student appeared unchanged even though a
 * second enrollment silently existed). The action itself is already fixed to
 * delete-then-create; this script repairs students who already ended up with
 * more than one enrollment before that fix landed.
 *
 * For each affected student, keeps their MOST RECENTLY CREATED enrollment
 * (i.e. the section from the most recent import/edit) and removes the rest.
 *
 * Safety: writes a full JSON backup of every affected student's enrollments
 * to ./backups/ (gitignored) before deleting anything.
 *
 * Run:  npx tsx scripts/fix-duplicate-enrollments.ts [--apply]
 * Without --apply it only prints a report (dry run, no writes).
 */
import fs from "fs";
import path from "path";
import { prisma } from "../lib/prisma";

const APPLY = process.argv.includes("--apply");

async function main() {
  const students = await prisma.user.findMany({
    where: { role: "STUDENT" },
    include: { enrollments: { include: { classSection: true }, orderBy: { createdAt: "asc" } } },
  });
  const affected = students.filter((s) => s.enrollments.length > 1);

  if (affected.length === 0) {
    console.log("No students with more than one enrollment — nothing to fix.");
    await prisma.$disconnect();
    return;
  }

  const backup = {
    takenAt: new Date().toISOString(),
    students: affected.map((s) => ({
      id: s.id,
      name: s.name,
      identifier: s.phone ?? s.enrollmentNo,
      enrollments: s.enrollments.map((e) => ({ id: e.id, classSectionId: e.classSectionId, classSectionName: e.classSection.name, createdAt: e.createdAt })),
    })),
  };
  const backupDir = path.join(process.cwd(), "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `fix-duplicate-enrollments-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`Backup written: ${backupPath}`);

  console.log(`\n${APPLY ? "APPLYING" : "DRY RUN — nothing written (pass --apply to write)"}`);
  console.log(`Students with duplicate enrollments: ${affected.length}`);
  for (const s of affected) {
    const keep = s.enrollments[s.enrollments.length - 1]; // most recently created
    const drop = s.enrollments.slice(0, -1);
    console.log(`  ${s.name} (${s.phone ?? s.enrollmentNo}): keep "${keep.classSection.name}", drop ${drop.map((e) => `"${e.classSection.name}"`).join(", ")}`);
    if (APPLY) {
      await prisma.enrollment.deleteMany({ where: { id: { in: drop.map((e) => e.id) } } });
    }
  }

  if (APPLY) {
    const stillDuplicated = await prisma.user.findMany({
      where: { role: "STUDENT", enrollments: { some: {} } },
      include: { _count: { select: { enrollments: true } } },
    });
    const remaining = stillDuplicated.filter((s) => s._count.enrollments > 1);
    console.log(`\nDone. Students still with >1 enrollment: ${remaining.length}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
