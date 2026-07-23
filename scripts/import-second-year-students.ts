/*
 * Import of Year-2 (MBA 25-27) students. Unlike Year-1, these students have no
 * phone number — they log in with their 14-digit **enrollment number** instead.
 *
 * Source: "SecondYear_25-27.xlsx", sheet "Sheet1" (SL.NO, Enrollment NO, Section
 * A/B/C/D, Name, Specialization). The A/B/C/D "Section" column does NOT correspond
 * to any year-2 timetable (year-2 is organised by stream) — it is ignored here.
 *
 * This batch imports the specializations with a confirmed single target section.
 * FINANCE is still deferred (skipped + tallied) — split into Finance 1/2 not yet
 * decided. HUMAN RESOURCE is confirmed as a single section and is now included:
 *   MARKETING                -> MM
 *   SUPPLY CHAIN MANAGEMENT  -> SC
 *   TECHNOLOGY MANAGEMENT    -> TM
 *   HUMAN RESOURCE           -> HR
 *
 * One enrollment number was corrupted by Excel into scientific notation
 * ("1.20251E+13") for PUJA KUMARI — corrected below with the value the user supplied.
 *
 * Safety:
 *   - Never wipes anything — year-2 sections start empty, and year-1 (@iem.internal,
 *     phone-based) students are untouched (this script only ever selects rows from
 *     the year-2 sheet).
 *   - Upserts by `enrollmentNo` (idempotent — re-running updates, not duplicates).
 *
 * Run:  npx tsx scripts/import-second-year-students.ts [path-to-xlsx] [--apply]
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
const XLSX_PATH = args.find((a) => !a.startsWith("--")) ?? "SecondYear_25-27.xlsx";

// Specialization (as written in the sheet) -> ClassSection.name already seeded in the DB.
// FINANCE is intentionally absent — deferred until the user decides the Finance 1/2
// per-student split. HUMAN RESOURCE is confirmed single-section and included below.
const SPECIALIZATION_SECTION: Record<string, string> = {
  "FINANCE 1": "F1",
  "FINANCE 2": "F2",
  "MARKETING": "MM",
  "SUPPLY CHAIN MANAGEMENT": "SC",
  "TECHNOLOGY MANAGEMENT": "TM",
  "HUMAN RESOURCE": "HR",
};

// One corrected enrollment number (Excel mangled it into scientific notation).
const ENROLLMENT_FIX: Record<string, string> = {
  "PUJA KUMARI": "12025051001184",
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

type Row = { name: string; enrollmentNo: string; specialization: string; section: string };

function parseSheet(path: string): { rows: Row[]; deferredCount: Map<string, number>; invalid: string[] } {
  const wb = XLSX.readFile(path);
  const sheet: any[][] = XLSX.utils.sheet_to_json(wb.Sheets["Sheet1"], { header: 1, raw: false, defval: "" });
  // Header at index 0: SL.NO, Enrollment NO, Section, Name, Specialization
  const dataRows = sheet.slice(1).filter((r) => norm(r[3]) !== "");

  const rows: Row[] = [];
  const deferredCount = new Map<string, number>();
  const invalid: string[] = [];

  for (const r of dataRows) {
    const name = titleCase(norm(r[3]));
    const specialization = norm(r[4]).toUpperCase();
    const section = SPECIALIZATION_SECTION[specialization];

    if (!section) {
      // FINANCE / HUMAN RESOURCE (or anything unrecognized) — deferred, not an error.
      deferredCount.set(specialization, (deferredCount.get(specialization) ?? 0) + 1);
      continue;
    }

    let enrollmentNo = norm(r[1]).replace(/[^0-9]/g, "");
    if (ENROLLMENT_FIX[name.toUpperCase()]) enrollmentNo = ENROLLMENT_FIX[name.toUpperCase()];
    if (!/^\d{14}$/.test(enrollmentNo)) {
      invalid.push(`${name}: invalid enrollment number "${norm(r[1])}" -> "${enrollmentNo}"`);
      continue;
    }

    rows.push({ name, enrollmentNo, specialization, section });
  }

  // Duplicate enrollment numbers within the imported set would collide on upsert — flag them.
  const seen = new Map<string, string>();
  for (const r of rows) {
    if (seen.has(r.enrollmentNo)) {
      invalid.push(`Duplicate enrollment ${r.enrollmentNo}: ${seen.get(r.enrollmentNo)} and ${r.name}`);
    }
    seen.set(r.enrollmentNo, r.name);
  }

  return { rows, deferredCount, invalid };
}

async function main() {
  const { rows, deferredCount, invalid } = parseSheet(XLSX_PATH);

  const bySection = new Map<string, number>();
  for (const r of rows) bySection.set(r.section, (bySection.get(r.section) ?? 0) + 1);

  console.log(`Parsed ${XLSX_PATH}`);
  console.log(`  Active rows to import: ${rows.length}`);
  for (const [sec, n] of [...bySection.entries()].sort()) console.log(`    ${sec}: ${n}`);
  console.log(`  Deferred (specialization not yet mapped to a section):`);
  for (const [spec, n] of [...deferredCount.entries()].sort()) console.log(`    ${spec}: ${n}`);
  if (invalid.length) {
    console.log(`  INVALID rows (not imported): ${invalid.length}`);
    for (const m of invalid) console.log(`    - ${m}`);
  }

  // ---- Target sections must already be seeded ----
  const sections = await prisma.classSection.findMany({ where: { name: { in: Object.values(SPECIALIZATION_SECTION) } } });
  const sectionIdByName = new Map(sections.map((s) => [s.name, s.id]));
  for (const name of Object.values(SPECIALIZATION_SECTION)) {
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
