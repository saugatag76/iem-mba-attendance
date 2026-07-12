/*
 * One-time import of the real MBA 26-28 admissions roster, replacing the
 * seeded/fake students (5-per-section dummy accounts) while preserving the
 * demo account used for live demos.
 *
 * Source: "26-28 MBA FULL ADMISSISON (5).xlsx" — sheet "MASTER" is authoritative
 * (only sheet with phone numbers; its Section column was cross-checked 100%
 * consistent with the per-section SEC A/B/C sheets).
 *
 * Rules applied:
 *   - Section "L" = left admission -> skipped entirely.
 *   - 3 students appear twice (same phone/email, two sections) because they moved
 *     sections after the per-section sheets were made. Since phone is the unique
 *     login username, each keeps ONE section — resolved per user decision below.
 *   - KUNAL DUTTA's phone was mistyped with 9 digits; corrected to the real 10-digit number.
 *
 * Safety:
 *   - Only wipes students matching the SEEDED pattern (email ending @iem.edu,
 *     excluding demo.student@iem.edu) — never touches real (@iem.internal) students,
 *     so this script is safe to re-run.
 *   - Deletes EventAttendance rows for wiped students first (no onDelete cascade
 *     on that relation — see schema.prisma EventAttendance.student).
 *   - Upserts real students by phone (idempotent — re-running updates, not duplicates).
 *
 * Run:  npx tsx scripts/import-real-students.ts [path-to-xlsx] [--apply]
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
const XLSX_PATH = args.find((a) => !a.startsWith("--")) ?? "26-28 MBA FULL ADMISSISON (5).xlsx";

// Section letter in the sheet -> ClassSection.name already seeded in the DB.
const SECTION_NAME: Record<string, string> = { A: "Sec A", B: "Sec B", C: "Sec C" };

// Students listed under two sections in MASTER (same phone/email) — pick one.
const SECTION_OVERRIDE: Record<string, string> = {
  "7488147052": "B", // SHASHANK SHEKHAR: keep B, drop C
  "8420806207": "A", // ANUSHPA PANJA: keep A, drop C
  "6299805456": "B", // SHIVAM KUMAR PATHAK: keep B, drop C
};

// One corrected phone (was 9 digits in the sheet).
const PHONE_FIX: Record<string, string> = {
  "891081080": "8910861080", // KUNAL DUTTA
};

function norm(s: any): string {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}
function normPhone(p: any): string {
  const digits = String(p ?? "").replace(/[^0-9]/g, "");
  return PHONE_FIX[digits] ?? digits;
}
function phoneEmail(phone: string): string {
  return `p${phone}@iem.internal`;
}
function titleCase(name: string): string {
  return name
    .toLowerCase()
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

type Row = { name: string; phone: string; mail: string; section: string; rawSection: string };

function parseMaster(path: string): { rows: Row[]; skippedL: number; invalid: string[] } {
  const wb = XLSX.readFile(path);
  const sheet: any[][] = XLSX.utils.sheet_to_json(wb.Sheets["MASTER"], { header: 1, raw: false, defval: "" });
  // Header at index 2: SL.NO, Name, Phone, Mail, Course, Section, ...
  const dataRows = sheet.slice(3).filter((r) => norm(r[1]) !== "");

  const rows: Row[] = [];
  const invalid: string[] = [];
  let skippedL = 0;
  const seenPhones = new Map<string, Row>();

  for (const r of dataRows) {
    const name = titleCase(norm(r[1]));
    const rawSection = norm(r[5]).toUpperCase();
    if (rawSection === "L") {
      skippedL++;
      continue;
    }
    const section = SECTION_NAME[rawSection];
    if (!section) {
      invalid.push(`${name}: unrecognized section "${rawSection}"`);
      continue;
    }
    const phone = normPhone(r[2]);
    if (!/^\d{10,12}$/.test(phone)) {
      invalid.push(`${name}: invalid phone "${norm(r[2])}" -> "${phone}"`);
      continue;
    }
    const mail = norm(r[3]);

    // Resolve the "listed twice" cases via the explicit override.
    if (seenPhones.has(phone)) {
      const override = SECTION_OVERRIDE[phone];
      if (!override) {
        invalid.push(`${name}: duplicate phone ${phone} with no override rule (sections ${seenPhones.get(phone)!.section} & ${section})`);
        continue;
      }
      // Keep the row whose sheet-section matches the override; drop the other.
      if (rawSection !== override) continue; // this occurrence is the one to drop
      // This occurrence wins — replace the previously kept one.
      const idx = rows.findIndex((x) => x.phone === phone);
      if (idx >= 0) rows.splice(idx, 1);
    }

    const row: Row = { name, phone, mail, section, rawSection };
    seenPhones.set(phone, row);
    rows.push(row);
  }

  return { rows, skippedL, invalid };
}

async function main() {
  const { rows, skippedL, invalid } = parseMaster(XLSX_PATH);

  const bySection = new Map<string, number>();
  for (const r of rows) bySection.set(r.section, (bySection.get(r.section) ?? 0) + 1);

  console.log(`Parsed ${XLSX_PATH}`);
  console.log(`  Active rows to import: ${rows.length}`);
  for (const [sec, n] of [...bySection.entries()].sort()) console.log(`    ${sec}: ${n}`);
  console.log(`  Skipped (section L, left admission): ${skippedL}`);
  if (invalid.length) {
    console.log(`  INVALID rows (not imported): ${invalid.length}`);
    for (const m of invalid) console.log(`    - ${m}`);
  }

  // ---- Identify seeded/fake students to wipe (never the demo account, never real @iem.internal ones) ----
  const fakeStudents = await prisma.user.findMany({
    where: {
      role: "STUDENT",
      email: { endsWith: "@iem.edu" },
      NOT: { email: "demo.student@iem.edu" },
    },
    select: { id: true, email: true, name: true },
  });
  console.log(`\nSeeded/fake students to wipe: ${fakeStudents.length}`);
  for (const s of fakeStudents.slice(0, 5)) console.log(`    - ${s.email} (${s.name})`);
  if (fakeStudents.length > 5) console.log(`    ... and ${fakeStudents.length - 5} more`);

  const preservedDemo = await prisma.user.findUnique({ where: { email: "demo.student@iem.edu" }, select: { email: true, name: true } });
  console.log(`Preserved (not touched): ${preservedDemo ? `${preservedDemo.email} (${preservedDemo.name})` : "demo.student@iem.edu not found"}`);

  // ---- Existing real students (for upsert reporting) ----
  const sections = await prisma.classSection.findMany({ where: { name: { in: Object.values(SECTION_NAME) } } });
  const sectionIdByName = new Map(sections.map((s) => [s.name, s.id]));
  for (const name of Object.values(SECTION_NAME)) {
    if (!sectionIdByName.has(name)) throw new Error(`ClassSection "${name}" not found — run the base seed first.`);
  }

  const existingByPhone = new Map(
    (await prisma.user.findMany({ where: { role: "STUDENT", phone: { not: null } }, select: { id: true, phone: true } })).map((u) => [u.phone!, u.id]),
  );
  const willCreate = rows.filter((r) => !existingByPhone.has(r.phone)).length;
  const willUpdate = rows.filter((r) => existingByPhone.has(r.phone)).length;

  console.log(`\n${APPLY ? "APPLYING" : "DRY RUN — nothing written (pass --apply to write)"}`);
  console.log(`Will create: ${willCreate}   Will update (existing phone): ${willUpdate}`);

  if (!APPLY) {
    await prisma.$disconnect();
    return;
  }

  // ---- Wipe fakes ----
  const fakeIds = fakeStudents.map((s) => s.id);
  if (fakeIds.length) {
    await prisma.eventAttendance.deleteMany({ where: { studentId: { in: fakeIds } } });
    const { count } = await prisma.user.deleteMany({ where: { id: { in: fakeIds } } });
    console.log(`\nWiped ${count} seeded/fake students.`);
  }

  // ---- Upsert real students ----
  const passwordHash = await bcrypt.hash(DEFAULT_STUDENT_PASSWORD, 10);
  let created = 0, updated = 0;
  const createdBySection = new Map<string, number>();

  for (const r of rows) {
    const classSectionId = sectionIdByName.get(r.section)!;
    const existingId = existingByPhone.get(r.phone);

    if (existingId) {
      await prisma.user.update({
        where: { id: existingId },
        data: { name: r.name, email: phoneEmail(r.phone) },
      });
      await prisma.enrollment.deleteMany({ where: { studentId: existingId } });
      await prisma.enrollment.create({ data: { studentId: existingId, classSectionId } });
      updated++;
    } else {
      const student = await prisma.user.create({
        data: {
          email: phoneEmail(r.phone),
          phone: r.phone,
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
  console.log(`\nDefault password for all newly created students: ${DEFAULT_STUDENT_PASSWORD} (forced change on first login)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
