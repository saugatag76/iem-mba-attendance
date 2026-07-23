/*
 * Import of Year-2 (MBA 25-27) Finance students, now that the Finance 1/2
 * per-student split has been decided. Unlike SecondYear_25-27.xlsx (used for
 * Marketing/Supply Chain/Tech Mgmt/HR), this is a separate file with a
 * different layout, provided specifically for the Finance split.
 *
 * Source: "Finance_1and Finance 2_2025_2027_Batch.xlsx", single sheet
 * "Finance 1" (misleadingly named — it actually contains BOTH Finance 1 and
 * Finance 2 students). Columns: SL NO, STUDENT NAME, ENROLLMENT NO, SECTION
 * (A/B/C/D — same as the other Year-2 file, not the section we enroll into),
 * APPEAR FOR THE EXAMINATION (this is the actual Finance 1 / Finance 2 split),
 * STATUS, Stream, Room.
 *
 *   FINANCE 1 -> ClassSection "Finance 1"
 *   FINANCE 2 -> ClassSection "Finance 2"
 *
 * Students log in with their 14-digit enrollment number (same as the rest of
 * Year-2), shared default password, forced to change it on first login.
 *
 * Safety:
 *   - Never wipes anything — Finance 1/2 sections start empty, everything
 *     else (Year-1, Year-2 MM/SC/TM/HR) is untouched.
 *   - Upserts by `enrollmentNo` (idempotent — re-running updates, not duplicates).
 *   - One exact duplicate row exists in the source file (RITIKA KUMARI,
 *     12020501015044, appears twice with identical data) — de-duplicated below.
 *
 * Run:  npx tsx scripts/import-finance-students.ts [path-to-xlsx] [--apply]
 * Without --apply it only prints a report (dry run, no writes).
 */
import * as XLSX from "xlsx";
import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";
import { uniquePersonalCode } from "../lib/code";
import { DEFAULT_STUDENT_PASSWORD } from "../lib/studentDefaults";

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const XLSX_PATH = args.find((a) => !a.startsWith("--")) ?? "Finance_1and Finance 2_2025_2027_Batch.xlsx";
const SHEET_NAME = "Finance 1";

const EXAM_SECTION: Record<string, string> = {
  "FINANCE 1": "Finance 1",
  "FINANCE 2": "Finance 2",
};

function norm(s: any): string {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}
function titleCase(name: string): string {
  return name
    .toLowerCase()
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
function enrollmentEmail(enrollmentNo: string): string {
  return `e${enrollmentNo}@iem.internal`;
}

type Row = { name: string; enrollmentNo: string; section: string };

function parseSheet(path: string): { rows: Row[]; skippedNotSelected: number; invalid: string[]; duplicatesInFile: string[] } {
  const wb = XLSX.readFile(path);
  const sheet = wb.Sheets[SHEET_NAME];
  if (!sheet) throw new Error(`Sheet "${SHEET_NAME}" not found in ${path}. Sheets present: ${wb.SheetNames.join(", ")}`);
  const dataRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
  // Header at index 0: SL NO, STUDENT NAME, ENROLLMENT NO, SECTION, APPEAR FOR THE EXAMINATION, STATUS, Stream, Room
  const body = dataRows.slice(1).filter((r) => norm(r[1]) !== "");

  const rows: Row[] = [];
  const invalid: string[] = [];
  const duplicatesInFile: string[] = [];
  const seenInFile = new Map<string, string>();
  let skippedNotSelected = 0;

  for (const r of body) {
    const name = titleCase(norm(r[1]));
    const enrollmentNo = norm(r[2]).replace(/[^0-9]/g, "");
    const exam = norm(r[4]).toUpperCase();
    const status = norm(r[5]).toUpperCase();

    if (status !== "SELECTED") {
      skippedNotSelected++;
      continue;
    }
    if (!/^\d{14}$/.test(enrollmentNo)) {
      invalid.push(`${name}: invalid enrollment number "${norm(r[2])}" -> "${enrollmentNo}"`);
      continue;
    }
    const section = EXAM_SECTION[exam];
    if (!section) {
      invalid.push(`${name}: unrecognized "APPEAR FOR THE EXAMINATION" value "${norm(r[4])}"`);
      continue;
    }

    if (seenInFile.has(enrollmentNo)) {
      duplicatesInFile.push(`${enrollmentNo}: ${seenInFile.get(enrollmentNo)} and ${name} — kept first occurrence`);
      continue;
    }
    seenInFile.set(enrollmentNo, name);

    rows.push({ name, enrollmentNo, section });
  }

  return { rows, skippedNotSelected, invalid, duplicatesInFile };
}

async function main() {
  const { rows, skippedNotSelected, invalid, duplicatesInFile } = parseSheet(XLSX_PATH);

  const bySection = new Map<string, number>();
  for (const r of rows) bySection.set(r.section, (bySection.get(r.section) ?? 0) + 1);

  console.log(`Parsed ${XLSX_PATH} (sheet "${SHEET_NAME}")`);
  console.log(`  Active rows to import: ${rows.length}`);
  for (const [sec, n] of [...bySection.entries()].sort()) console.log(`    ${sec}: ${n}`);
  if (skippedNotSelected) console.log(`  Skipped (STATUS not SELECTED): ${skippedNotSelected}`);
  if (duplicatesInFile.length) {
    console.log(`  Duplicate rows in file (de-duplicated): ${duplicatesInFile.length}`);
    for (const m of duplicatesInFile) console.log(`    - ${m}`);
  }
  if (invalid.length) {
    console.log(`  INVALID rows (not imported): ${invalid.length}`);
    for (const m of invalid) console.log(`    - ${m}`);
  }

  // ---- Target sections must already be seeded ----
  const sections = await prisma.classSection.findMany({ where: { name: { in: Object.values(EXAM_SECTION) } } });
  const sectionIdByName = new Map(sections.map((s) => [s.name, s.id]));
  for (const name of Object.values(EXAM_SECTION)) {
    if (!sectionIdByName.has(name)) throw new Error(`ClassSection "${name}" not found — run the base seed first.`);
  }

  // ---- Existing students (for upsert reporting) ----
  const existingByEnrollment = new Map(
    (await prisma.user.findMany({ where: { role: "STUDENT", enrollmentNo: { not: null } }, select: { id: true, enrollmentNo: true } })).map((u) => [u.enrollmentNo!, u.id]),
  );
  const willCreate = rows.filter((r) => !existingByEnrollment.has(r.enrollmentNo)).length;
  const willUpdate = rows.filter((r) => existingByEnrollment.has(r.enrollmentNo)).length;

  console.log(`\n${APPLY ? "APPLYING" : "DRY RUN — nothing written (pass --apply to write)"}`);
  console.log(`Will create: ${willCreate}   Will update (existing enrollment): ${willUpdate}`);

  if (!APPLY) {
    await prisma.$disconnect();
    return;
  }

  // ---- Upsert real students ----
  const passwordHash = await bcrypt.hash(DEFAULT_STUDENT_PASSWORD, 10);
  let created = 0, updated = 0;
  const createdBySection = new Map<string, number>();

  for (const r of rows) {
    const classSectionId = sectionIdByName.get(r.section)!;
    const existingId = existingByEnrollment.get(r.enrollmentNo);

    if (existingId) {
      await prisma.user.update({
        where: { id: existingId },
        data: { name: r.name, email: enrollmentEmail(r.enrollmentNo) },
      });
      await prisma.enrollment.deleteMany({ where: { studentId: existingId } });
      await prisma.enrollment.create({ data: { studentId: existingId, classSectionId } });
      updated++;
    } else {
      const student = await prisma.user.create({
        data: {
          email: enrollmentEmail(r.enrollmentNo),
          enrollmentNo: r.enrollmentNo,
          name: r.name,
          role: Role.STUDENT,
          passwordHash,
          personalCode: await uniquePersonalCode(),
          mustChangePassword: true,
        },
      });
      await prisma.enrollment.create({ data: { studentId: student.id, classSectionId } });
      created++;
      createdBySection.set(r.section, (createdBySection.get(r.section) ?? 0) + 1);
    }
  }

  console.log(`\nDone. Created: ${created}   Updated: ${updated}`);
  for (const [sec, n] of [...createdBySection.entries()].sort()) console.log(`    ${sec}: ${n} created`);
  console.log(`\nAll newly created students got the shared default password (see lib/studentDefaults.ts) — forced change on first login.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
